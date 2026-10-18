/**
 * Meta Pixel + TikTok Pixel (browser).
 * Both stay off unless their pixel ID is set in Netlify (META_PIXEL_ID / TIKTOK_PIXEL_ID).
 * Every event uses one event ID shared with the server copy (CAPI / Events API) for deduplication.
 * All values are sent in USD (converted from the product's own currency).
 */

import { toE164Digits, toUsd } from './countries';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    ttq?: any;
    TiktokAnalyticsObject?: string;
  }
}

let initPromise: Promise<void> | null = null;
let ready = false;
let metaPixelId = '';
let metaOn = false;
let tiktokOn = false;
let iqdRate = 1400;
let externalIdHash: string | null = null;

const VISITOR_ID_KEY = 'tamam_vid';
const TTCLID_KEY = '_tt_ttclid';
const FBC_KEY = '_meta_fbc';

async function computeExternalId(): Promise<void> {
  try {
    let vid = localStorage.getItem(VISITOR_ID_KEY);
    if (!vid) {
      vid = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_ID_KEY, vid);
    }
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(vid));
    externalIdHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    externalIdHash = null;
  }
}

function captureClickIds(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const fbclid = q.get('fbclid');
    if (fbclid) sessionStorage.setItem(FBC_KEY, `fb.1.${Date.now()}.${fbclid}`);
    const ttclid = q.get('ttclid');
    if (ttclid) sessionStorage.setItem(TTCLID_KEY, ttclid);
  } catch {
    // storage blocked
  }
}

function readCookie(name: string): string | undefined {
  try {
    const hit = (document.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
  } catch {
    return undefined;
  }
}

/** Browser identifiers the server needs to match events to ads. */
export function getTrackingIds(): { fbp?: string; fbc?: string; ttp?: string; ttclid?: string; externalId?: string } {
  if (typeof window === 'undefined') return {};
  const out: { fbp?: string; fbc?: string; ttp?: string; ttclid?: string; externalId?: string } = {};
  const fbp = readCookie('_fbp');
  if (fbp?.startsWith('fb.')) out.fbp = fbp;
  let fbc = readCookie('_fbc');
  if (!fbc?.startsWith('fb.')) {
    try {
      fbc = sessionStorage.getItem(FBC_KEY) || undefined;
    } catch {
      fbc = undefined;
    }
  }
  if (fbc?.startsWith('fb.')) out.fbc = fbc;
  const ttp = readCookie('_ttp');
  if (ttp) out.ttp = ttp;
  try {
    const ttclid = sessionStorage.getItem(TTCLID_KEY);
    if (ttclid) out.ttclid = ttclid;
  } catch {
    // ignore
  }
  if (externalIdHash) out.externalId = externalIdHash;
  return out;
}

function loadMeta(pixelId: string) {
  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq!('init', pixelId, externalIdHash ? { external_id: externalIdHash } : {});
  window.fbq!('track', 'PageView');
  metaOn = true;
}

function loadTikTok(pixelId: string) {
  /* eslint-disable */
  (function (w: any, d: Document, t: string) {
    w.TiktokAnalyticsObject = t;
    const ttq = (w[t] = w[t] || []);
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function (obj: any, m: string) {
      obj[m] = function () { obj.push([m].concat(Array.prototype.slice.call(arguments, 0))); };
    };
    for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
    ttq.load = function (id: string) {
      const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = src;
      ttq._t = ttq._t || {}; ttq._t[id] = +new Date(); ttq._o = ttq._o || {}; ttq._o[id] = {};
      const s = d.createElement('script'); s.async = true; s.src = `${src}?sdkid=${id}&lib=${t}`;
      const first = d.getElementsByTagName('script')[0]; first.parentNode!.insertBefore(s, first);
    };
    ttq.load(pixelId);
    ttq.page();
  })(window, document, 'ttq');
  /* eslint-enable */
  tiktokOn = true;
}

/** Load the config once and start the pixels. Safe to call many times. */
export function initTracking(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      captureClickIds();
      await computeExternalId();
      try {
        const res = await fetch('/api/meta-config');
        if (!res.ok) return;
        const cfg = await res.json();
        if (typeof cfg.iqdToUsdRate === 'number') iqdRate = cfg.iqdToUsdRate;
        if (cfg.pixelId) {
          metaPixelId = String(cfg.pixelId);
          loadMeta(metaPixelId);
        }
        if (cfg.tiktokPixelId) loadTikTok(String(cfg.tiktokPixelId));
      } catch {
        // blocked or offline: tracking stays off
      }
    })().finally(() => {
      ready = true;
    });
  }
  return initPromise;
}

function whenReady(fn: () => void) {
  if (typeof window === 'undefined') return;
  if (ready || !initPromise) fn();
  else initPromise.then(fn, fn);
}

function newEventId(name: string, productId: string | number): string {
  return `${name}_${String(productId).replace(/[^A-Za-z0-9-]/g, '')}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

interface TrackProduct {
  id: number | string;
  title: string;
  /** Unit price in the product's own currency */
  price: number;
  country: string;
  count?: number;
}

function fire(name: 'ViewContent' | 'InitiateCheckout', p: TrackProduct) {
  const count = p.count || 1;
  const eventId = newEventId(name, p.id);
  whenReady(() => {
    const unitUsd = toUsd(p.price, p.country, iqdRate);
    const valueUsd = Number((unitUsd * count).toFixed(2));
    const params = { content_ids: [String(p.id)], content_name: p.title, content_type: 'product', value: valueUsd, currency: 'USD', num_items: count };
    try {
      if (metaOn && window.fbq) window.fbq('track', name, params, { eventID: eventId });
      if (tiktokOn && window.ttq)
        window.ttq.track(name, { contents: [{ content_id: String(p.id), content_name: p.title, price: unitUsd, quantity: count }], content_type: 'product', value: valueUsd, currency: 'USD' }, { event_id: eventId });
    } catch {
      // ignore
    }
    // Server copy (survives ad blockers); same event ID -> counted once
    try {
      fetch('/.netlify/functions/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ eventName: name, eventId, productId: p.id, productName: p.title, valueUsd, count, country: p.country, sourceUrl: window.location.href, ...getTrackingIds() }),
      }).catch(() => undefined);
    } catch {
      // ignore
    }
  });
}

export const trackViewContent = (p: TrackProduct) => fire('ViewContent', p);
export const trackInitiateCheckout = (p: TrackProduct) => fire('InitiateCheckout', p);

/** Purchase: event ID = order ID (the server sends the same one). */
export function trackPurchase(o: { orderId: string; productId: number | string; productName: string; total: number; count: number; country: string; name?: string; phone?: string }) {
  whenReady(() => {
    const valueUsd = toUsd(o.total, o.country, iqdRate);
    try {
      if (metaOn && window.fbq) {
        const am: Record<string, string> = {};
        if (o.name) am.fn = o.name.trim().split(/\s+/)[0].toLowerCase();
        if (o.phone) am.ph = toE164Digits(o.phone, o.country);
        if (externalIdHash) am.external_id = externalIdHash;
        if (Object.keys(am).length) window.fbq('init', metaPixelId, am);
        window.fbq('track', 'Purchase', { content_ids: [String(o.productId)], content_name: o.productName, content_type: 'product', value: valueUsd, currency: 'USD', num_items: o.count, order_id: o.orderId }, { eventID: o.orderId });
      }
      if (tiktokOn && window.ttq)
        window.ttq.track('CompletePayment', { contents: [{ content_id: String(o.productId), content_name: o.productName, price: Number((valueUsd / Math.max(1, o.count)).toFixed(2)), quantity: o.count }], content_type: 'product', value: valueUsd, currency: 'USD' }, { event_id: o.orderId });
    } catch {
      // ignore
    }
  });
}
