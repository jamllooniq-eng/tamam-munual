import type { Handler } from '@netlify/functions';
import fs from 'fs';
import path from 'path';
import { render, MEANINGFUL_QUERY_PARAMS } from '../../src/entry-server';
import { cachedHeaders, productTag, TAG_LISTING, TAG_PAGES } from '../../server/cache.server';

let template: string | null = null;

/** The built index.html, with the stylesheet inlined (the page paints without an extra request). */
function getTemplate(): string {
  if (template) return template;
  const candidates = [path.resolve(process.cwd(), 'dist/client/index.html'), path.resolve(process.cwd(), 'index.html')];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const dir = path.dirname(p);
    template = fs.readFileSync(p, 'utf-8').replace(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/g, (tag, href) => {
      try {
        const css = fs.readFileSync(path.join(dir, href), 'utf-8');
        return css && !css.includes('</style') ? `<style>${css}</style>` : tag;
      } catch {
        return tag;
      }
    });
    return template;
  }
  throw new Error('index.html template not found');
}

const VARY = `query=${MEANINGFUL_QUERY_PARAMS.join('|')}`;

export const handler: Handler = async (event) => {
  const rawQuery = event.rawQuery || '';
  const url = event.path + (rawQuery ? `?${rawQuery}` : '');
  const origin = `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers['host'] || 'localhost'}`;
  try {
    const { html, head, dataScript, status, productId } = await render(url, origin);
    const body = getTemplate().replace('<!--app-head-->', head).replace('<!--app-html-->', html).replace('<!--app-data-->', dataScript);
    const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8', 'Netlify-Vary': VARY };
    if (status === 200) {
      const tags = productId ? [productTag(productId), TAG_PAGES] : event.path === '/' ? [TAG_LISTING, TAG_PAGES] : [TAG_PAGES];
      Object.assign(headers, cachedHeaders(tags));
    } else if (status === 404) {
      headers['Cache-Control'] = 'public, max-age=60';
      headers['Netlify-CDN-Cache-Control'] = 'public, max-age=300';
      headers['Netlify-Cache-Tag'] = TAG_PAGES;
    } else {
      headers['Cache-Control'] = 'no-store';
    }
    return { statusCode: status, headers, body };
  } catch (err) {
    console.error('[ssr] render failed:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Netlify-Vary': VARY },
      body: `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تمام شوب</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#FAF7F4;color:#1E1716;text-align:center;padding:20px}a{display:inline-block;margin-top:16px;background:#4A1C20;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none}</style></head><body><div><h1>صار خلل مؤقت</h1><p>حدّث الصفحة بعد لحظات.</p><a href="/">الرئيسية</a></div></body></html>`,
    };
  }
};
