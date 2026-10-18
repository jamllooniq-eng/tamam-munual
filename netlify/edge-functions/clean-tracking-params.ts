/**
 * Ad clicks arrive with tracking parameters (?fbclid=..., ?utm_source=..., ?ttclid=...), and every value is
 * different. Netlify's cache would treat each click as a different page and render it again on the server.
 *
 * This edge function removes ONLY known tracking parameters through an internal rewrite:
 * - the cache sees one clean URL (/product/123), so every ad click gets the same ready page;
 * - the browser's address bar is unchanged, so the Meta / TikTok pixels still read fbclid / ttclid there;
 * - parameters the site uses (q, search, category, page, ...) are never touched.
 *
 * If the URL has no tracking parameter, nothing happens and the request continues as normal.
 */

// Click IDs and campaign tags added by ad platforms and newsletters (never used by the site itself)
const TRACKING_PARAM =
  /^(utm_[a-z0-9_]+|fbclid|gclid|gclsrc|gbraid|wbraid|dclid|msclkid|ttclid|twclid|igshid|li_fat_id|mc_cid|mc_eid|_ga|_gl|srsltid|yclid|scclid|epik)$/i;

export default async (request: Request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return;

  const url = new URL(request.url);
  if (!url.search) return;

  let removed = false;
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) {
      url.searchParams.delete(key);
      removed = true;
    }
  }
  if (!removed) return;

  // Internal rewrite (200, same site, address bar unchanged)
  return new URL(url.pathname + url.search, request.url);
};

export const config = {
  path: ['/', '/product/*'],
};
