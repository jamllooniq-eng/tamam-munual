/**
 * Server-side Meta Conversions API (CAPI).
 * Hashed customer matching (fn, ph, st, country, external_id, fbp, fbc, ip, ua) and the same
 * event_id as the browser pixel, so Meta counts each action once.
 * Does nothing unless META_PIXEL_ID and META_ACCESS_TOKEN are set.
 */

import crypto from 'crypto';

const META_GRAPH_VERSION = (process.env.META_GRAPH_VERSION || 'v23.0').trim();

export function sha256(val: string): string {
  if (!val) return '';
  return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
}

function normalizeText(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function externalIdField(value?: string): string[] | undefined {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v.length > 128) return undefined;
  return [/^[a-f0-9]{64}$/.test(v) ? v : sha256(v)];
}

function cleanIp(ip?: string): string | undefined {
  let v = (ip || '').split(',')[0].trim();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  return v || undefined;
}

function fbField(v?: string): string | undefined {
  return typeof v === 'string' && v.trim().startsWith('fb.') ? v.trim() : undefined;
}

function compact(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      const arr = v.filter((x) => typeof x === 'string' && x.length > 0);
      if (arr.length) out[k] = arr;
    } else out[k] = v;
  }
  return out;
}

export interface MetaEventParams {
  eventName: 'ViewContent' | 'InitiateCheckout' | 'Purchase';
  eventId: string;
  orderId?: string;
  productId: string | number;
  productName: string;
  valueUsd: number;
  count: number;
  countryCode: string; // IQ, SA...
  /** International digits without + (e.g. 9647701234567) */
  phoneE164?: string;
  customerName?: string;
  region?: string;
  clientIp?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
  sourceUrl?: string;
  externalId?: string;
}

export async function sendMetaEvent(p: MetaEventParams): Promise<boolean> {
  const pixelId = (process.env.META_PIXEL_ID || '').trim();
  const accessToken = (process.env.META_ACCESS_TOKEN || '').trim();
  if (!pixelId || !accessToken) return true;

  try {
    const userData = compact({
      ph: p.phoneE164 ? [sha256(p.phoneE164)] : undefined,
      fn: p.customerName ? [sha256(normalizeText(p.customerName).split(' ')[0] || '')] : undefined,
      st: p.region ? [sha256(normalizeText(p.region))] : undefined,
      country: [sha256(p.countryCode.toLowerCase())],
      external_id: externalIdField(p.externalId),
      client_ip_address: cleanIp(p.clientIp),
      client_user_agent: p.userAgent?.trim() || undefined,
      fbc: fbField(p.fbc),
      fbp: fbField(p.fbp),
    });

    const customData: Record<string, any> = {
      content_ids: [String(p.productId)],
      content_name: p.productName,
      content_type: 'product',
      value: p.valueUsd,
      currency: 'USD',
      num_items: p.count,
    };
    if (p.orderId) customData.order_id = p.orderId;

    const payload: Record<string, any> = {
      data: [
        {
          event_name: p.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: p.eventId,
          action_source: 'website',
          event_source_url: p.sourceUrl || process.env.APP_URL || undefined,
          user_data: userData,
          custom_data: customData,
        },
      ],
      access_token: accessToken,
    };
    const testCode = (process.env.META_TEST_EVENT_CODE || '').trim();
    if (testCode) payload.test_event_code = testCode;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      console.error(`Meta CAPI (${p.eventName}) error:`, (await res.text()).slice(0, 400));
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`Meta CAPI (${p.eventName}) failed:`, err?.message || err);
    return false;
  }
}
