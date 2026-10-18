/**
 * Supabase (server-only) data layer.
 *
 * Uses the Supabase REST API directly with the service key, which lives ONLY in Netlify
 * environment variables. Tables have RLS enabled with no public policies, so nothing is
 * readable from the browser except the public image bucket.
 */

import { COUNTRY_IDS, CountryId, CountrySettings, defaultSettings, isCountryId } from '../src/lib/countries';
import type { Product } from '../src/types';

export const IMAGE_BUCKET = 'product-images';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export function isDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { apikey: SUPABASE_KEY };
  // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys don't need it.
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  return headers;
}

async function sb(pathAndQuery: string, init: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SUPABASE_URL}${pathAndQuery}`, {
      ...init,
      signal: controller.signal,
      headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function sbJson<T>(pathAndQuery: string, init: RequestInit = {}, timeoutMs = 6000): Promise<T> {
  const res = await sb(pathAndQuery, init, timeoutMs);
  if (!res.ok) throw new Error(`Supabase ${init.method || 'GET'} ${pathAndQuery.split('?')[0]} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** One retry for reads the storefront can't do without (a slow cold start shouldn't fail a page). */
async function readWithRetry<T>(pathAndQuery: string, timeoutMs = 3000): Promise<T> {
  try {
    return await sbJson<T>(pathAndQuery, {}, timeoutMs);
  } catch {
    return await sbJson<T>(pathAndQuery, {}, timeoutMs);
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ProductRow extends Product {
  sheet: 1 | 2;
  product_code: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const PRODUCT_COLUMNS = 'id,title,country,price,old_price,category,description,features,images,stock,sheet,product_code,is_active,created_at,updated_at';
const CARD_COLUMNS = 'id,title,country,price,old_price,category,images,stock';

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
}

export function sanitizeProduct(raw: any): ProductRow {
  return {
    id: Number(raw.id),
    title: String(raw.title || ''),
    country: isCountryId(raw.country) ? raw.country : 'IQ',
    price: Number(raw.price) || 0,
    old_price: raw.old_price != null && Number(raw.old_price) > 0 ? Number(raw.old_price) : null,
    category: raw.category ? String(raw.category) : null,
    description: raw.description ? String(raw.description) : null,
    features: strArray(raw.features),
    images: strArray(raw.images),
    stock: raw.stock === null || raw.stock === undefined ? null : Math.max(0, Number(raw.stock) || 0),
    sheet: Number(raw.sheet) === 2 ? 2 : 1,
    product_code: raw.product_code ? String(raw.product_code) : null,
    is_active: raw.is_active !== false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

/** Public shape: never leaks the sheet number or internal code to the browser. */
export function toPublicProduct(row: ProductRow, full = true): Product {
  const p: Product = {
    id: row.id,
    title: row.title,
    country: row.country,
    price: row.price,
    old_price: row.old_price,
    category: row.category,
    images: full ? row.images : row.images.slice(0, 2),
    stock: row.stock,
  };
  if (full) {
    p.description = row.description;
    p.features = row.features;
  }
  return p;
}

/** Active products for the home page (cards only). */
export async function listActiveProducts(): Promise<Product[]> {
  const rows = await readWithRetry<any[]>(`/rest/v1/products?is_active=eq.true&select=${CARD_COLUMNS}&order=created_at.desc&limit=500`);
  return rows.map((r) => toPublicProduct(sanitizeProduct(r), false));
}

/** One product (fresh). `null` when it doesn't exist. */
export async function getProduct(id: number): Promise<ProductRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await readWithRetry<any[]>(`/rest/v1/products?id=eq.${id}&select=${PRODUCT_COLUMNS}&limit=1`);
  return rows[0] ? sanitizeProduct(rows[0]) : null;
}

export async function listRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const rows = await readWithRetry<any[]>(
    `/rest/v1/products?is_active=eq.true&id=neq.${product.id}&select=${CARD_COLUMNS}&order=created_at.desc&limit=40`
  ).catch(() => []);
  const cards = rows.map((r) => toPublicProduct(sanitizeProduct(r), false));
  // Same country first (same currency and shipping), then the rest
  cards.sort((a, b) => Number(b.country === product.country) - Number(a.country === product.country));
  return cards.slice(0, limit);
}

export async function adminListProducts(): Promise<ProductRow[]> {
  const rows = await sbJson<any[]>(`/rest/v1/products?select=${PRODUCT_COLUMNS}&order=created_at.desc`, {}, 8000);
  return rows.map(sanitizeProduct);
}

export type ProductInput = Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>;

export async function adminCreateProduct(input: ProductInput): Promise<ProductRow> {
  const rows = await sbJson<any[]>('/rest/v1/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(input),
  }, 8000);
  return sanitizeProduct(rows[0]);
}

export async function adminUpdateProduct(id: number, input: Partial<ProductInput>): Promise<ProductRow> {
  const before = input.images ? await getProduct(id).catch(() => null) : null;
  const rows = await sbJson<any[]>(`/rest/v1/products?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
  }, 8000);
  if (!rows[0]) throw new Error('Product not found');
  const updated = sanitizeProduct(rows[0]);
  if (before && input.images) {
    const kept = new Set(updated.images);
    await deleteUnusedImages(before.images.filter((u) => !kept.has(u)));
  }
  return updated;
}

export async function adminDeleteProduct(id: number): Promise<void> {
  const existing = await getProduct(id).catch(() => null);
  await sbJson(`/rest/v1/products?id=eq.${id}`, { method: 'DELETE' }, 8000);
  if (existing) await deleteUnusedImages(existing.images);
}

export async function decrementStock(id: number, qty: number): Promise<void> {
  await sbJson('/rest/v1/rpc/decrement_stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid: id, qty }),
  }, 6000);
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

function sanitizeCountry(raw: any): CountrySettings | null {
  if (!isCountryId(raw?.id)) return null;
  const d = defaultSettings(raw.id);
  return {
    id: raw.id,
    enabled: raw.enabled !== false,
    free_shipping: raw.free_shipping !== false,
    shipping_fee: Math.max(0, Number(raw.shipping_fee) || 0),
    free_over: Math.max(0, Number(raw.free_over) || 0),
    delivery_text: String(raw.delivery_text || d.delivery_text),
    banner: raw.banner ? String(raw.banner) : d.banner,
    national_address: raw.national_address === true,
  };
}

/** All 7 countries in a fixed order (missing rows fall back to defaults). */
export async function getAllCountrySettings(): Promise<CountrySettings[]> {
  let rows: any[] = [];
  try {
    rows = await readWithRetry<any[]>('/rest/v1/countries?select=*&order=sort.asc');
  } catch (err) {
    console.warn('[db] countries read failed, using defaults:', (err as Error).message);
  }
  const byId = new Map<string, CountrySettings>();
  for (const r of rows) {
    const s = sanitizeCountry(r);
    if (s) byId.set(s.id, s);
  }
  return COUNTRY_IDS.map((id) => byId.get(id) || defaultSettings(id));
}

export async function adminUpdateCountry(id: CountryId, patch: Partial<CountrySettings>): Promise<CountrySettings> {
  const { id: _ignored, ...rest } = patch as any;
  const rows = await sbJson<any[]>('/rest/v1/countries?on_conflict=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id, ...rest, updated_at: new Date().toISOString() }),
  }, 8000);
  return sanitizeCountry(rows[0]) || defaultSettings(id);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
export const ORDER_STATUSES: OrderStatus[] = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export interface OrderRow {
  id?: number;
  order_no: string;
  product_id: number | null;
  product_title: string;
  product_code: string | null;
  country: string;
  currency: string;
  quantity: number;
  unit_price: number;
  shipping: number;
  total: number;
  customer_name: string;
  phone: string;
  region: string;
  address: string;
  national_address: string | null;
  sheet: number;
  status?: OrderStatus;
  created_at?: string;
}

/** Save an order (ignores a duplicate order number, so a retried background run is harmless). */
export async function insertOrder(order: OrderRow): Promise<boolean> {
  const res = await sb('/rest/v1/orders?on_conflict=order_no', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(order),
  }, 8000);
  if (!res.ok) {
    console.error(`[db] order insert failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return false;
  }
  return true;
}

export async function adminListOrders(limit = 300): Promise<OrderRow[]> {
  return sbJson<OrderRow[]>(`/rest/v1/orders?select=*&order=created_at.desc&limit=${Math.min(1000, Math.max(1, limit))}`, {}, 8000);
}

export async function adminUpdateOrderStatus(id: number, status: OrderStatus): Promise<void> {
  await sbJson(`/rest/v1/orders?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  }, 8000);
}

export async function adminDeleteOrder(id: number): Promise<void> {
  await sbJson(`/rest/v1/orders?id=eq.${id}`, { method: 'DELETE' }, 8000);
}

// ---------------------------------------------------------------------------
// Small key/value store (change markers)
// ---------------------------------------------------------------------------

export async function kvSet(key: string, data: unknown): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await sb('/rest/v1/cache_entries?on_conflict=key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key, data, updated_at: new Date().toISOString() }),
    }, 3000);
  } catch {
    // best effort
  }
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (!isDbConfigured()) return null;
  try {
    const rows = await sbJson<any[]>(`/rest/v1/cache_entries?key=eq.${encodeURIComponent(key)}&select=data&limit=1`, {}, 3000);
    return rows[0] ? (rows[0].data as T) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export async function uploadProductImage(bytes: Buffer, contentType: string, extension: string): Promise<string> {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const res = await sb(`/storage/v1/object/${IMAGE_BUCKET}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
    body: bytes,
  }, 20000);
  if (!res.ok) throw new Error(`Image upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${name}`;
}

/** Only files inside OUR public bucket can be deleted; any other URL is ignored. */
function storageObjectName(url: string): string | null {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;
  if (!url || !url.startsWith(prefix)) return null;
  const name = decodeURIComponent(url.slice(prefix.length).split('?')[0]);
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) return null;
  return name;
}

/** Delete image files no remaining product uses. Best effort, never throws. */
async function deleteUnusedImages(urls: string[]): Promise<void> {
  try {
    const candidates = [...new Set(urls)].filter((u) => storageObjectName(u) !== null);
    if (candidates.length === 0) return;
    const all = await adminListProducts();
    const used = new Set(all.flatMap((p) => p.images));
    const names = candidates.filter((u) => !used.has(u)).map((u) => storageObjectName(u)!);
    if (names.length === 0) return;
    await sb(`/storage/v1/object/${IMAGE_BUCKET}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: names }),
    }, 10000);
  } catch (err: any) {
    console.warn('[db] image cleanup error:', err?.message || err);
  }
}
