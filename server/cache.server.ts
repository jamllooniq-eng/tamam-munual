/**
 * CDN cache policy (Netlify)
 *
 * Pages are kept in Netlify's durable CDN cache so an ad click opens instantly. After a change in
 * the dashboard the affected pages are purged by tag and re-rendered right away.
 *
 * - With NETLIFY_PURGE_API_TOKEN set: pages stay cached for 1 hour (changes still show at once,
 *   because they are purged).
 * - Without it: pages are cached for 60 seconds only, so a change shows within a minute.
 */

import { purgeCache } from '@netlify/functions';
import { getGalleryImage } from '../src/lib/image';

export const TAG_PAGES = 'pages';
export const TAG_LISTING = 'listing';

export function productTag(id: string | number): string {
  return `product-${String(id).replace(/[^0-9a-z-]/gi, '')}`;
}

export function isPurgeConfigured(): boolean {
  return Boolean((process.env.NETLIFY_PURGE_API_TOKEN || '').trim());
}

export function cachedHeaders(tags: string[]): Record<string, string> {
  const maxAge = isPurgeConfigured() ? 3600 : 60;
  return {
    // Browsers always re-check with Netlify (cheap), so they never keep an old page themselves
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Netlify-CDN-Cache-Control': `public, durable, max-age=${maxAge}, stale-while-revalidate=604800`,
    'Netlify-Cache-Tag': tags.join(','),
  };
}

/** Purge the given tags. Never throws. */
export async function purgeTags(tags: string[]): Promise<boolean> {
  const unique = [...new Set(tags.filter(Boolean))];
  if (unique.length === 0 || !isPurgeConfigured()) return false;
  try {
    const siteID = (process.env.TAMAM_SITE_ID || process.env.SITE_ID || '').trim() || undefined;
    await purgeCache({ tags: unique, ...(siteID ? { siteID } : {}) });
    return true;
  } catch (err: any) {
    console.warn('[cache] purge failed:', err?.message || err);
    return false;
  }
}

function siteOrigin(): string {
  return (process.env.APP_URL || process.env.URL || '').replace(/\/+$/, '');
}

async function fetchQuietly(url: string, headers: Record<string, string>, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TamamCacheWarmer/1.0', ...headers }, signal: controller.signal });
    await res.arrayBuffer().catch(() => undefined);
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface WarmTarget {
  path: string;
  image?: string;
}

/** Render pages (and their main image) so the CDN holds them before customers arrive. Never throws. */
export async function warmTargets(targets: WarmTarget[], options: { delayMs?: number; deadlineMs?: number; max?: number } = {}): Promise<number> {
  const origin = siteOrigin();
  if (!origin) return 0;
  const seen = new Set<string>();
  const list = targets.filter((t) => !seen.has(t.path) && seen.add(t.path)).slice(0, options.max ?? 40);
  if (options.delayMs) await new Promise((r) => setTimeout(r, options.delayMs));
  const stopAt = options.deadlineMs ? Date.now() + options.deadlineMs : Infinity;
  let warmed = 0;
  let i = 0;
  const worker = async () => {
    while (i < list.length && Date.now() < stopAt) {
      const t = list[i++];
      const jobs = [fetchQuietly(`${origin}${t.path}`, { Accept: 'text/html' }, 10000)];
      if (t.image) {
        const img = getGalleryImage(t.image).src;
        jobs.push(fetchQuietly(`${origin}${img}`, { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' }, 10000));
      }
      const [ok] = await Promise.all(jobs);
      if (ok) warmed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, list.length) }, worker));
  return warmed;
}
