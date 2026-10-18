import type { Handler } from '@netlify/functions';
import { sendMetaEvent } from '../../server/meta.server';
import { sendTikTokEvent } from '../../server/tiktok.server';
import { isCountryId } from '../../src/lib/countries';

// Public endpoint for early-funnel events only. Purchase is sent exclusively by the checkout flow.
const ALLOWED = new Set(['ViewContent', 'InitiateCheckout']);
const EVENT_ID = /^[A-Za-z0-9_.:-]{8,120}$/;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const b = JSON.parse(event.body || '{}');
    if (!ALLOWED.has(b.eventName) || !b.productId) return { statusCode: 400, body: '{"success":false}' };
    const eventId = typeof b.eventId === 'string' && EVENT_ID.test(b.eventId) ? b.eventId : `${b.eventName}_${Date.now()}_srv`;
    const clientIp =
      event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const userAgent = event.headers['user-agent'];
    const valueUsd = Math.max(0, Number(b.valueUsd) || 0);
    const count = Math.max(1, Math.min(50, Number(b.count) || 1));
    const name = String(b.productName || `منتج #${b.productId}`).slice(0, 200);
    const [ok] = await Promise.all([
      sendMetaEvent({
        eventName: b.eventName,
        eventId,
        productId: String(b.productId).slice(0, 40),
        productName: name,
        valueUsd,
        count,
        countryCode: isCountryId(b.country) ? b.country : 'IQ',
        clientIp,
        userAgent,
        fbc: b.fbc,
        fbp: b.fbp,
        sourceUrl: typeof b.sourceUrl === 'string' ? b.sourceUrl.slice(0, 500) : undefined,
        externalId: typeof b.externalId === 'string' ? b.externalId : undefined,
      }),
      sendTikTokEvent({
        event: b.eventName,
        eventId,
        productId: String(b.productId).slice(0, 40),
        productName: name,
        unitUsd: Number((valueUsd / count).toFixed(2)),
        count,
        valueUsd,
        clientIp,
        userAgent,
        ttp: typeof b.ttp === 'string' ? b.ttp : undefined,
        ttclid: typeof b.ttclid === 'string' ? b.ttclid : undefined,
        sourceUrl: typeof b.sourceUrl === 'string' ? b.sourceUrl.slice(0, 500) : undefined,
      }).catch(() => false),
    ]);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: ok }) };
  } catch {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '{"success":false}' };
  }
};
