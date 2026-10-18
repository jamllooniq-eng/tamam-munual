/**
 * TikTok Events API (server-side). Inactive unless TIKTOK_PIXEL_ID and TIKTOK_ACCESS_TOKEN are set.
 * Every event carries the same event_id as the browser pixel, so TikTok counts it once.
 */

import { sha256 } from './meta.server';

const TIKTOK_ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

export type TikTokEventName = 'ViewContent' | 'InitiateCheckout' | 'CompletePayment';

export interface TikTokServerEvent {
  event: TikTokEventName;
  eventId: string;
  productId: string | number;
  productName: string;
  unitUsd: number;
  count: number;
  valueUsd: number;
  clientIp?: string;
  userAgent?: string;
  ttp?: string;
  ttclid?: string;
  /** International digits without + */
  phoneE164?: string;
  sourceUrl?: string;
}

export function isTikTokConfigured(): boolean {
  return Boolean((process.env.TIKTOK_PIXEL_ID || '').trim() && (process.env.TIKTOK_ACCESS_TOKEN || '').trim());
}

export async function sendTikTokEvent(p: TikTokServerEvent): Promise<boolean> {
  if (!isTikTokConfigured()) return false;
  const pixelId = (process.env.TIKTOK_PIXEL_ID || '').trim();
  const accessToken = (process.env.TIKTOK_ACCESS_TOKEN || '').trim();
  const testEventCode = (process.env.TIKTOK_TEST_EVENT_CODE || '').trim();

  const user: Record<string, string> = {};
  if (p.ttp) user.ttp = p.ttp;
  if (p.ttclid) user.ttclid = p.ttclid;
  if (p.clientIp) user.ip = p.clientIp.split(',')[0].trim();
  if (p.userAgent) user.user_agent = p.userAgent;
  if (p.phoneE164) user.phone = sha256(`+${p.phoneE164}`);

  const body: Record<string, unknown> = {
    event_source: 'web',
    event_source_id: pixelId,
    data: [
      {
        event: p.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: p.eventId,
        user,
        page: p.sourceUrl ? { url: p.sourceUrl } : undefined,
        properties: {
          currency: 'USD',
          value: p.valueUsd,
          content_type: 'product',
          contents: [{ content_id: String(p.productId), content_name: p.productName, price: p.unitUsd, quantity: p.count }],
        },
      },
    ],
  };
  if (testEventCode) body.test_event_code = testEventCode;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(TIKTOK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': accessToken },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || (json && typeof json.code === 'number' && json.code !== 0)) {
      console.warn(`[TikTok] ${p.event} not accepted:`, json?.message || res.status);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`[TikTok] ${p.event} failed:`, err?.message || err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
