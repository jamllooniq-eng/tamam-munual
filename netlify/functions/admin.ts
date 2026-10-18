import type { Handler } from '@netlify/functions';
import crypto from 'crypto';
import {
  adminCreateProduct,
  adminDeleteOrder,
  adminDeleteProduct,
  adminListOrders,
  adminListProducts,
  adminUpdateCountry,
  adminUpdateOrderStatus,
  adminUpdateProduct,
  getAllCountrySettings,
  isDbConfigured,
  ORDER_STATUSES,
  OrderStatus,
  ProductInput,
  uploadProductImage,
} from '../../server/db.server';
import { isPurgeConfigured, productTag, purgeTags, TAG_LISTING, TAG_PAGES, warmTargets } from '../../server/cache.server';
import { iqdToUsdRate, sheetName, sheetUrl } from '../../server/checkout.server';
import { isTikTokConfigured } from '../../server/tiktok.server';
import { CountrySettings, isCountryId } from '../../src/lib/countries';

/**
 * Admin API for /admin.
 * Auth: one password in the Netlify env var ADMIN_PASSWORD. Login returns a signed token valid
 * for 7 days; changing the password logs every device out.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 10;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Our own Supabase storage (also allows http:// when testing locally)
const OWN_STORAGE = `${(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '')}/storage/v1/object/public/`;
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const password = () => (process.env.ADMIN_PASSWORD || '').trim();

function tokenKey(): string {
  return crypto.createHash('sha256').update(`tamam-admin:${password()}:${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`).digest('hex');
}

function issueToken(): string {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${crypto.createHmac('sha256', tokenKey()).update(exp).digest('hex')}`;
}

function isValidToken(token: string): boolean {
  if (!token || !password()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(crypto.createHmac('sha256', tokenKey()).update(exp).digest('hex'));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseProduct(body: any, partial: boolean): { value?: Partial<ProductInput>; error?: string } {
  const out: Partial<ProductInput> = {};
  const has = (k: string) => !partial || body[k] !== undefined;

  if (has('title')) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 200) return { error: 'اسم المنتج مطلوب (من 2 إلى 200 حرف).' };
    out.title = title;
  }
  if (has('country')) {
    if (!isCountryId(body.country)) return { error: 'اختر دولة المنتج.' };
    out.country = body.country;
  }
  if (has('price')) {
    const price = num(body.price);
    if (price === null || price <= 0 || price > 100_000_000) return { error: 'سعر المنتج لازم يكون رقم أكبر من صفر.' };
    out.price = price;
  }
  if (has('old_price')) {
    const old = num(body.old_price);
    if (old !== null && (old < 0 || old > 100_000_000)) return { error: 'السعر قبل الخصم غير صحيح.' };
    out.old_price = old && old > 0 ? old : null;
  }
  if (has('category')) out.category = String(body.category || '').trim().slice(0, 60) || null;
  if (has('description')) {
    const d = String(body.description || '').trim();
    if (d.length > 10000) return { error: 'الوصف طويل جداً (الحد 10000 حرف).' };
    out.description = d || null;
  }
  if (has('features')) {
    const f = (Array.isArray(body.features) ? body.features : String(body.features || '').split('\n'))
      .map((x: any) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((x: string) => x.slice(0, 200));
    out.features = f;
  }
  if (has('images')) {
    const imgs = (Array.isArray(body.images) ? body.images : [])
      .map((u: any) => String(u || '').trim())
      .filter((u: string) => /^https:\/\/[^\s"'<>]+$/.test(u) || (OWN_STORAGE && u.startsWith(OWN_STORAGE) && !/[\s"'<>]/.test(u)));
    if (!partial && imgs.length === 0) return { error: 'أضف صورة وحدة على الأقل.' };
    if (imgs.length > 10) return { error: 'الحد الأقصى 10 صور للمنتج.' };
    out.images = imgs;
  }
  if (has('stock')) {
    const s = num(body.stock);
    if (s !== null && (s < 0 || s > 1_000_000 || !Number.isInteger(s))) return { error: 'الكمية المتوفرة لازم تكون رقم صحيح.' };
    out.stock = s;
  }
  if (has('sheet')) {
    const sh = Number(body.sheet);
    if (sh !== 1 && sh !== 2) return { error: 'اختر شيت 1 أو شيت 2.' };
    out.sheet = sh as 1 | 2;
  }
  if (has('product_code')) {
    const code = String(body.product_code ?? '').trim();
    if (code.length > 64) return { error: 'رمز المنتج طويل جداً (الحد 64 حرف).' };
    out.product_code = code || null;
  }
  if (has('is_active')) out.is_active = body.is_active !== false;
  return { value: out };
}

function parseCountry(body: any): { value?: Partial<CountrySettings>; error?: string } {
  const out: Partial<CountrySettings> = {};
  if (body.enabled !== undefined) out.enabled = body.enabled !== false;
  if (body.free_shipping !== undefined) out.free_shipping = body.free_shipping !== false;
  if (body.national_address !== undefined) out.national_address = body.national_address === true;
  if (body.shipping_fee !== undefined) {
    const v = num(body.shipping_fee);
    if (v === null || v < 0) return { error: 'كلفة التوصيل غير صحيحة.' };
    out.shipping_fee = v;
  }
  if (body.free_over !== undefined) {
    const v = num(body.free_over);
    if (v !== null && v < 0) return { error: 'قيمة "مجاني فوق" غير صحيحة.' };
    out.free_over = v || 0;
  }
  if (body.delivery_text !== undefined) {
    const t = String(body.delivery_text || '').trim().slice(0, 40);
    if (!t) return { error: 'اكتب مدة التوصيل.' };
    out.delivery_text = t;
  }
  if (body.banner !== undefined) out.banner = String(body.banner || '').trim().slice(0, 200) || null;
  return { value: out };
}

function settingsStatus() {
  const set = (k: string) => Boolean((process.env[k] || '').trim());
  return {
    sheet1: { name: sheetName(1), ok: Boolean(sheetUrl(1)) },
    sheet2: { name: sheetName(2), ok: Boolean(sheetUrl(2)) },
    telegram: set('TELEGRAM_BOT_TOKEN') && set('TELEGRAM_CHAT_ID'),
    metaPixel: set('META_PIXEL_ID'),
    metaCapi: set('META_PIXEL_ID') && set('META_ACCESS_TOKEN'),
    tiktok: isTikTokConfigured() || set('TIKTOK_PIXEL_ID'),
    purge: isPurgeConfigured(),
    appUrl: (process.env.APP_URL || process.env.URL || '').trim(),
    iqdToUsdRate: iqdToUsdRate(),
  };
}

/** After a product change: refresh its page and the home page on the CDN. */
async function refreshProduct(id: number, image?: string, visible = true) {
  const purged = await purgeTags([productTag(id), TAG_LISTING]);
  if (purged) {
    const targets = [{ path: '/' }, ...(visible ? [{ path: `/product/${id}`, image }] : [])];
    await warmTargets(targets, { delayMs: 1500, deadlineMs: 15000 });
  }
}

export const handler: Handler = async (event) => {
  if (!password()) return json(503, { error: 'لوحة التحكم غير مفعّلة: أضف ADMIN_PASSWORD في متغيرات Netlify.' });
  if (password().length < MIN_PASSWORD_LENGTH)
    return json(503, { error: `كلمة سر لوحة التحكم قصيرة. خلّي ADMIN_PASSWORD ${MIN_PASSWORD_LENGTH} أحرف على الأقل.` });
  if (!isDbConfigured())
    return json(503, { error: 'قاعدة البيانات غير مربوطة: أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في متغيرات Netlify.' });

  const action = event.queryStringParameters?.action || '';
  let body: any = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: 'طلب غير صالح.' });
  }

  if (action === 'login') {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
    if (!safeEqual(String(body.password || ''), password())) {
      await new Promise((r) => setTimeout(r, 800));
      return json(401, { error: 'كلمة السر غير صحيحة.' });
    }
    return json(200, { token: issueToken() });
  }

  const auth = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (!isValidToken(auth.startsWith('Bearer ') ? auth.slice(7) : '')) {
    return json(401, { error: 'انتهت الجلسة، سجّل الدخول مرة ثانية.' });
  }
  if (action !== 'bootstrap' && action !== 'orders' && event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  try {
    switch (action) {
      case 'bootstrap': {
        const [products, countries, orders] = await Promise.all([adminListProducts(), getAllCountrySettings(), adminListOrders(500)]);
        return json(200, { products, countries, orders, settings: settingsStatus() });
      }
      case 'orders': {
        return json(200, { orders: await adminListOrders(Number(event.queryStringParameters?.limit) || 500) });
      }
      case 'product-create': {
        const parsed = parseProduct(body, false);
        if (parsed.error) return json(400, { error: parsed.error });
        const v = parsed.value as ProductInput;
        const product = await adminCreateProduct({
          title: v.title, country: v.country, price: v.price, old_price: v.old_price ?? null, category: v.category ?? null,
          description: v.description ?? null, features: v.features ?? [], images: v.images, stock: v.stock ?? null,
          sheet: v.sheet ?? 1, product_code: v.product_code ?? null, is_active: v.is_active ?? true,
        });
        await refreshProduct(product.id, product.images[0], product.is_active);
        return json(200, { product });
      }
      case 'product-update': {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'رقم المنتج غير صالح.' });
        const parsed = parseProduct(body, true);
        if (parsed.error) return json(400, { error: parsed.error });
        if (parsed.value?.images && parsed.value.images.length === 0) return json(400, { error: 'أضف صورة وحدة على الأقل.' });
        const product = await adminUpdateProduct(id, parsed.value || {});
        await refreshProduct(product.id, product.images[0], product.is_active);
        return json(200, { product });
      }
      case 'product-delete': {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'رقم المنتج غير صالح.' });
        await adminDeleteProduct(id);
        await refreshProduct(id, undefined, false);
        return json(200, { success: true });
      }
      case 'upload': {
        const ext = IMAGE_TYPES[String(body.contentType || '')];
        if (!ext) return json(400, { error: 'نوع الصورة غير مدعوم (JPG أو PNG أو WEBP فقط).' });
        const bytes = Buffer.from(String(body.data || ''), 'base64');
        if (bytes.length === 0) return json(400, { error: 'الصورة فارغة.' });
        if (bytes.length > MAX_IMAGE_BYTES) return json(400, { error: 'حجم الصورة كبير (الحد 4 ميغا).' });
        return json(200, { url: await uploadProductImage(bytes, String(body.contentType), ext) });
      }
      case 'country-update': {
        if (!isCountryId(body.id)) return json(400, { error: 'دولة غير معروفة.' });
        const parsed = parseCountry(body);
        if (parsed.error) return json(400, { error: parsed.error });
        const country = await adminUpdateCountry(body.id, parsed.value || {});
        // Shipping and banners show on every page
        if (await purgeTags([TAG_PAGES])) await warmTargets([{ path: '/' }], { delayMs: 1500, deadlineMs: 10000 });
        return json(200, { country });
      }
      case 'order-status': {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'رقم الطلب غير صالح.' });
        if (!ORDER_STATUSES.includes(body.status)) return json(400, { error: 'حالة غير معروفة.' });
        await adminUpdateOrderStatus(id, body.status as OrderStatus);
        return json(200, { success: true });
      }
      case 'order-delete': {
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) return json(400, { error: 'رقم الطلب غير صالح.' });
        await adminDeleteOrder(id);
        return json(200, { success: true });
      }
      default:
        return json(404, { error: 'Unknown action' });
    }
  } catch (err: any) {
    console.error(`[admin] ${action} failed:`, err?.message || err);
    return json(500, { error: 'تعذر الاتصال بقاعدة البيانات، حاول مرة ثانية.' });
  }
};
