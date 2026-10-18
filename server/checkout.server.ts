/**
 * Order processing: validation (price and product always come from the database, never from the
 * browser), duplicate protection, and delivery to the dashboard, Google Sheet 1/2, Telegram,
 * Meta CAPI and TikTok.
 */

import crypto from 'crypto';
import {
  formatMoney,
  getCountry,
  roundMoney,
  shippingCost,
  toE164Digits,
  toUsd,
  validatePhone,
} from '../src/lib/countries';
import type { OrderRequest, OrderResponse } from '../src/types';
import { decrementStock, getAllCountrySettings, getProduct, insertOrder, isDbConfigured } from './db.server';
import { sendMetaEvent } from './meta.server';
import { sendTikTokEvent } from './tiktok.server';

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

export function sheetUrl(sheet: number): string {
  if (sheet === 2) return (process.env.GOOGLE_SHEET_2_URL || process.env.GOOGLE_SHEET_WEBHOOK_URL_MANUAL || '').trim();
  return (process.env.GOOGLE_SHEET_1_URL || process.env.GOOGLE_SHEET_WEBHOOK_URL || '').trim();
}

export function sheetName(sheet: number): string {
  if (sheet === 2) return (process.env.SHEET_2_NAME || '').trim() || 'شيت 2';
  return (process.env.SHEET_1_NAME || '').trim() || 'شيت 1';
}

export function iqdToUsdRate(): number {
  return Number(process.env.IQD_TO_USD_RATE) || 1400;
}

// ---------------------------------------------------------------------------
// Internal signature (checkout -> checkout-background)
// ---------------------------------------------------------------------------

function internalSecret(): string {
  const explicit = (process.env.CHECKOUT_SECRET || '').trim();
  if (explicit) return explicit;
  const base = `${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}|${process.env.TELEGRAM_BOT_TOKEN || ''}|${sheetUrl(1)}|${sheetUrl(2)}`;
  if (base === '|||') return '';
  return crypto.createHash('sha256').update(`tamam-internal:${base}`).digest('hex');
}

export function signInternalPayload(body: string): string {
  const secret = internalSecret();
  return secret ? crypto.createHmac('sha256', secret).update(body).digest('hex') : '';
}

export function verifyInternalSignature(body: string, signature: string | undefined): boolean {
  const expected = signInternalPayload(body);
  if (!expected || !signature) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidOrder {
  orderId: string;
  productId: number;
  productTitle: string;
  productCode: string | null;
  sheet: 1 | 2;
  country: string;
  currency: string;
  quantity: number;
  unitPrice: number;
  shipping: number;
  total: number;
  name: string;
  phone: string;
  region: string;
  address: string;
  nationalAddress: string | null;
  createdAt: string; // Baghdad time, human readable
  // tracking
  fbc?: string;
  fbp?: string;
  ttp?: string;
  ttclid?: string;
  externalId?: string;
  clientIp?: string;
  userAgent?: string;
}

export function generateOrderId(): string {
  return `ORD-${Date.now().toString().slice(-8)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function resolveOrderId(raw: unknown): string {
  return typeof raw === 'string' && /^ORD-[A-Za-z0-9-]{4,40}$/.test(raw.trim()) ? raw.trim() : generateOrderId();
}

/** Same phone + same product within 5 minutes = the same order (double tap, retry). Per server copy. */
const recentOrders = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

function str(v: unknown, max = 500): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function validateOrder(
  body: Partial<OrderRequest>,
  meta: { clientIp?: string; userAgent?: string } = {}
): Promise<{ ok: true; order: ValidOrder } | { ok: false; response: OrderResponse; status: number }> {
  const fail = (error: string, field?: OrderResponse['field'], status = 400) => ({ ok: false as const, status, response: { success: false, error, field } });

  if (!isDbConfigured()) return fail('المتجر غير مربوط بقاعدة البيانات حالياً.', undefined, 503);

  const productId = Number(body.item_id);
  if (!Number.isInteger(productId) || productId <= 0) return fail('المنتج غير محدد، حدّث الصفحة وحاول مرة ثانية.');

  let product;
  let settingsList;
  try {
    [product, settingsList] = await Promise.all([getProduct(productId), getAllCountrySettings()]);
  } catch (err) {
    console.error('[checkout] database read failed:', (err as Error).message);
    return fail('صار خلل مؤقت، حاول مرة ثانية بعد لحظات.', undefined, 503);
  }
  if (!product || !product.is_active) return fail('عذراً، هذا المنتج غير متوفر حالياً.');

  const c = getCountry(product.country);
  const settings = settingsList.find((s) => s.id === c.id);
  if (!settings || !settings.enabled) return fail('عذراً، التوصيل لهذه الدولة متوقف حالياً.');

  const name = str(body.cus_name, 80);
  if (!name) return fail('اكتب اسم المستلم', 'name');
  if (name.split(' ').filter(Boolean).length < 2) return fail('اكتب اسم المستلم (اسمين على الأقل)', 'name');

  const phoneCheck = validatePhone(String(body.cus_num1 || ''), c.id);
  if (!phoneCheck.ok) return fail(phoneCheck.error!, 'phone');

  const region = str(body.region, 60);
  if (!c.regions.includes(region)) return fail(`اختر ${c.regionLabel}`, 'region');

  const address = str(body.address, 300);
  if (address.length < 3) return fail('اكتب العنوان بالتفصيل', 'addr');

  let nationalAddress: string | null = null;
  if (settings.national_address) {
    nationalAddress = str(body.national_address, 120);
    if (nationalAddress.length < 4) return fail('اكتب العنوان الوطني', 'nat');
  }

  const maxQty = product.stock === null ? 10 : Math.min(10, product.stock);
  if (maxQty <= 0) return fail('عذراً، نفدت الكمية من هذا المنتج.');
  const quantity = Math.max(1, Math.min(maxQty, Math.floor(Number(body.count) || 1)));

  // Duplicate protection
  const key = `${phoneCheck.phone}_${product.id}`;
  const now = Date.now();
  const last = recentOrders.get(key);
  if (last && now - last < DUPLICATE_WINDOW_MS) {
    return {
      ok: false,
      status: 409,
      response: { success: false, duplicate: true, error: 'وصلنا طلبك لهذا المنتج قبل شوية، وراح نتصل بيك للتأكيد.' },
    };
  }
  recentOrders.set(key, now);
  for (const [k, t] of recentOrders) if (now - t > DUPLICATE_WINDOW_MS) recentOrders.delete(k);

  const unitPrice = product.price;
  const subtotal = roundMoney(unitPrice * quantity, c.id);
  const shipping = roundMoney(shippingCost(subtotal, settings), c.id);
  const total = roundMoney(subtotal + shipping, c.id);

  const createdAt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());

  const clean = (v: unknown) => (typeof v === 'string' && v.length < 300 ? v : undefined);

  return {
    ok: true,
    order: {
      orderId: resolveOrderId(body.orderId),
      productId: product.id,
      productTitle: product.title,
      productCode: product.product_code,
      sheet: product.sheet,
      country: c.id,
      currency: c.currency,
      quantity,
      unitPrice,
      shipping,
      total,
      name,
      phone: phoneCheck.phone,
      region,
      address,
      nationalAddress,
      createdAt,
      fbc: clean(body.fbc),
      fbp: clean(body.fbp),
      ttp: clean(body.ttp),
      ttclid: clean(body.ttclid),
      externalId: clean(body.externalId),
      clientIp: meta.clientIp,
      userAgent: meta.userAgent,
    },
  };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

async function wait(ms: number) {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

export async function sendToSheet(sheet: number, data: Record<string, unknown>, delays: number[] = [0, 500, 1500]): Promise<boolean> {
  const url = sheetUrl(sheet);
  if (!url) {
    console.error(`[checkout] ${sheetName(sheet)} has no link (GOOGLE_SHEET_${sheet}_URL is not set).`);
    return false;
  }
  for (const d of delays) {
    try {
      await wait(d);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
        redirect: 'follow',
      }).finally(() => clearTimeout(timer));
      if (res.ok) {
        const text = await res.text().catch(() => '');
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.ok === false) {
            console.error('[checkout] sheet script error:', parsed.error);
            continue;
          }
        } catch {
          // not JSON: a 200 is a success
        }
        return true;
      }
    } catch {
      // retry
    }
  }
  return false;
}

export async function sendTelegram(text: string, delays: number[] = [0, 500, 1500]): Promise<boolean> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return true; // not configured = nothing to do
  for (const d of delays) {
    try {
      await wait(d);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Plain text on purpose: customer-typed "_" or "*" would break Markdown
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (res.ok) return true;
    } catch {
      // retry
    }
  }
  return false;
}

function siteUrl(): string {
  return (process.env.APP_URL || process.env.URL || '').replace(/\/+$/, '');
}

export function telegramMessage(o: ValidOrder): string {
  const c = getCountry(o.country);
  const lines = [
    `📦 طلب جديد · ${sheetName(o.sheet)}`,
    '',
    `المنتج: ${o.productTitle}`,
    `الكمية: ${o.quantity}`,
    `المبلغ: ${formatMoney(o.total, o.country)}${o.shipping ? ` (منها توصيل ${formatMoney(o.shipping, o.country)})` : ''}`,
    '',
    `الاسم: ${o.name}`,
    `الهاتف: ${o.phone}`,
    `الدولة: ${c.name}`,
    `${c.regionLabel}: ${o.region}`,
    `العنوان: ${o.address}`,
  ];
  if (o.nationalAddress) lines.push(`العنوان الوطني: ${o.nationalAddress}`);
  lines.push('', `رقم الطلب: ${o.orderId}`);
  return lines.join('\n');
}

export function sheetPayload(o: ValidOrder): Record<string, unknown> {
  const c = getCountry(o.country);
  return {
    orderId: o.orderId,
    productName: o.productTitle,
    name: o.name,
    phone: o.phone,
    country: c.name,
    governorate: o.region,
    address: o.address,
    nationalAddress: o.nationalAddress || '',
    productId: o.productCode || String(o.productId),
    quantity: o.quantity,
    totalPrice: o.total,
    currency: c.symbol,
    notes: '',
    createdAt: o.createdAt,
  };
}

/**
 * Record the order everywhere. Never throws. The sheet gets a patient retry schedule when this runs
 * in the background function (up to 15 minutes allowed there).
 */
export async function deliverOrder(o: ValidOrder, opts: { sheetDelays?: number[] } = {}): Promise<{ sheet: boolean; telegram: boolean; db: boolean }> {
  const c = getCountry(o.country);
  const sourceUrl = `${siteUrl()}/product/${o.productId}`;
  const rate = iqdToUsdRate();
  const valueUsd = toUsd(o.total, o.country, rate);
  const phoneE164 = toE164Digits(o.phone, o.country);

  const [db, sheet, telegram] = await Promise.all([
    insertOrder({
      order_no: o.orderId,
      product_id: o.productId,
      product_title: o.productTitle,
      product_code: o.productCode,
      country: o.country,
      currency: c.currency,
      quantity: o.quantity,
      unit_price: o.unitPrice,
      shipping: o.shipping,
      total: o.total,
      customer_name: o.name,
      phone: o.phone,
      region: o.region,
      address: o.address,
      national_address: o.nationalAddress,
      sheet: o.sheet,
    })
      .then(async (ok) => {
        if (ok) await decrementStock(o.productId, o.quantity).catch(() => undefined);
        return ok;
      })
      .catch(() => false),
    sendToSheet(o.sheet, sheetPayload(o), opts.sheetDelays),
    sendTelegram(telegramMessage(o)),
    sendMetaEvent({
      eventName: 'Purchase',
      eventId: o.orderId,
      orderId: o.orderId,
      productId: o.productId,
      productName: o.productTitle,
      valueUsd,
      count: o.quantity,
      countryCode: o.country,
      phoneE164,
      customerName: o.name,
      region: o.region,
      clientIp: o.clientIp,
      userAgent: o.userAgent,
      fbc: o.fbc,
      fbp: o.fbp,
      sourceUrl,
      externalId: o.externalId,
    }).catch(() => false),
    sendTikTokEvent({
      event: 'CompletePayment',
      eventId: o.orderId,
      productId: o.productId,
      productName: o.productTitle,
      unitUsd: toUsd(o.unitPrice, o.country, rate),
      count: o.quantity,
      valueUsd,
      clientIp: o.clientIp,
      userAgent: o.userAgent,
      ttp: o.ttp,
      ttclid: o.ttclid,
      phoneE164,
      sourceUrl,
    }).catch(() => false),
  ]);

  if (!sheet || !telegram) {
    const failed = [!sheet && sheetName(o.sheet), !telegram && 'Telegram'].filter(Boolean).join(' + ');
    console.error(`[checkout] order ${o.orderId}: delivery failed for ${failed}`);
    // Emergency alert with the full order, so nothing is lost
    if (telegram || !sheet) {
      await sendTelegram(`🚨 طلب ما انسجّل بـ ${failed}، تابعه يدوياً\n\n${telegramMessage(o)}`, [0, 2000]);
    }
  }
  if (!db) console.error(`[checkout] order ${o.orderId} was not saved to the dashboard database.`);
  return { sheet, telegram, db };
}
