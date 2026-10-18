import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const origin = (process.env.APP_URL || `https://${event.headers['host'] || ''}`).replace(/\/+$/, '');
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    body: `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /success\n\nSitemap: ${origin}/sitemap.xml\n`,
  };
};
