import type { Handler } from '@netlify/functions';
import { deliverOrder, signInternalPayload, validateOrder } from '../../server/checkout.server';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

/**
 * POST /api/checkout
 * Validates the order (price and product from the database), answers the customer at once, and
 * hands the recording (dashboard, sheet, Telegram, Meta, TikTok) to the background function.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { success: false, error: 'Method Not Allowed' });

  let body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { success: false, error: 'طلب غير صالح.' });
  }

  const clientIp =
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['client-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const userAgent = event.headers['user-agent'];

  try {
    const result = await validateOrder(body, { clientIp, userAgent });
    if (!result.ok) return json(result.status, result.response);
    const order = result.order;

    // Hand off to the background function (signed so nobody can post fake orders to it)
    const host = event.headers['host'] || 'localhost';
    const proto = event.headers['x-forwarded-proto'] || 'https';
    const origin = (process.env.URL || `${proto}://${host}`).replace(/\/+$/, '');
    const serialized = JSON.stringify(order);
    let handedOff = false;
    try {
      const res = await fetch(`${origin}/.netlify/functions/checkout-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tamam-signature': signInternalPayload(serialized) },
        body: serialized,
      });
      handedOff = res.ok; // background functions answer 202 once queued
      if (!handedOff) console.error(`[checkout] background function answered ${res.status}`);
    } catch (err) {
      console.error('[checkout] could not reach the background function:', (err as Error).message);
    }

    // Fallback: record it right here instead of losing it (the customer waits a moment longer)
    if (!handedOff) await deliverOrder(order, { sheetDelays: [0, 700] });

    return json(200, { success: true, orderId: order.orderId, total: order.total });
  } catch (err) {
    console.error('[checkout] unexpected error:', err);
    return json(500, { success: false, error: 'صار خطأ أثناء إرسال الطلب، حاول مرة ثانية.' });
  }
};
