import type { Handler } from '@netlify/functions';
import { isDbConfigured, listActiveProducts } from '../../server/db.server';

export const handler: Handler = async (event) => {
  const origin = (process.env.APP_URL || `https://${event.headers['host'] || ''}`).replace(/\/+$/, '');
  const today = new Date().toISOString().split('T')[0];
  let urls = [`<url><loc>${origin}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`];
  try {
    if (isDbConfigured()) {
      const products = await listActiveProducts();
      urls = urls.concat(products.map((p) => `<url><loc>${origin}/product/${p.id}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`));
    }
  } catch {
    // home only
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
  };
};
