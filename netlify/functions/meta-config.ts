import type { Handler } from '@netlify/functions';

/** Public tracking config for the browser (pixel IDs only; access tokens never leave the server). */
export const handler: Handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  body: JSON.stringify({
    pixelId: (process.env.META_PIXEL_ID || '').trim(),
    tiktokPixelId: (process.env.TIKTOK_PIXEL_ID || '').trim(),
    iqdToUsdRate: Number(process.env.IQD_TO_USD_RATE) || 1400,
  }),
});
