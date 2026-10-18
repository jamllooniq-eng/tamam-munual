import React, { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { MEANINGFUL_QUERY_PARAMS, parseRoute } from './routing';
import { headTags } from './seo';
import type { PageData } from './types';
import { getAllCountrySettings, getProduct, isDbConfigured, listActiveProducts, listRelatedProducts, toPublicProduct } from '../server/db.server';

export { MEANINGFUL_QUERY_PARAMS };

export interface RenderResult {
  html: string;
  head: string;
  dataScript: string;
  status: number;
  productId?: number;
}

export async function render(url: string, origin: string): Promise<RenderResult> {
  const [pathname, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  const route = parseRoute(pathname, params);
  let status = 200;
  const data: PageData & { whatsapp?: string } = { route, countries: [], whatsapp: (process.env.WHATSAPP_NUMBER || '').trim() || undefined };

  try {
    if (route.view === 'home') {
      if (!isDbConfigured()) {
        data.products = [];
        data.countries = await getAllCountrySettings();
      } else {
        const [countries, products] = await Promise.all([getAllCountrySettings(), listActiveProducts()]);
        data.countries = countries;
        data.products = products;
      }
    } else if (route.view === 'product' && route.productId) {
      const [countries, row] = await Promise.all([getAllCountrySettings(), isDbConfigured() ? getProduct(route.productId) : Promise.resolve(null)]);
      data.countries = countries;
      if (!row || !row.is_active) {
        status = 404;
        data.route = { view: '404' };
      } else {
        data.product = toPublicProduct(row, true);
        data.related = await listRelatedProducts(data.product, 4).catch(() => []);
      }
    } else if (route.view === 'success') {
      // Order details live in the visitor's browser (sessionStorage)
    } else {
      status = 404;
    }
  } catch (err) {
    console.error('[ssr] data load failed:', (err as Error).message);
    if (route.view === 'product') {
      status = 503;
      data.route = { view: 'unavailable' };
    } else {
      status = 503;
      data.products = data.products || [];
    }
  }

  const html = renderToString(
    <StrictMode>
      <App data={data} />
    </StrictMode>
  );

  const clean = new URLSearchParams();
  for (const k of MEANINGFUL_QUERY_PARAMS) {
    const v = params.get(k);
    if (v) clean.set(k, v);
  }
  const qs = clean.toString();
  const base = (process.env.APP_URL || origin).replace(/\/+$/, '');
  const head = headTags({ route: data.route, product: data.product, origin: base, canonical: `${base}${pathname}${qs ? `?${qs}` : ''}` });

  const dataScript = `<script>window.__INITIAL_DATA__=${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
  return { html, head, dataScript, status, productId: data.product?.id };
}
