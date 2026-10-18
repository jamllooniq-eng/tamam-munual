/**
 * Netlify Image CDN helper
 * Automatically delivers optimized images (AVIF/WebP) via Netlify Edge CDN.
 * 
 * In production on Netlify, uses `/.netlify/images?url=...&w=...&q=...`.
 * In development or local preview, safely provides optimized images with fallback.
 */

export interface ImageOptimizerOptions {
  width?: number;
  quality?: number;
  fit?: 'contain' | 'cover' | 'fill';
}

/**
 * Returns an optimized image URL using Netlify Image CDN.
 *
 * @param url Original source image URL
 * @param options Optimization options (width, quality, fit)
 * @returns Optimized image URL string
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  options: ImageOptimizerOptions = {}
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // If local asset or already a netlify image URL, return as is
  if (trimmed.startsWith('/') || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
    return trimmed;
  }

  const { width = 800, quality = 80, fit } = options;

  // Build standard Netlify Image CDN URL
  const encodedUrl = encodeURIComponent(trimmed);
  let cdnPath = `/.netlify/images?url=${encodedUrl}&w=${width}&q=${quality}`;
  if (fit) {
    cdnPath += `&fit=${fit}`;
  }

  return cdnPath;
}

// ---------------------------------------------------------------------------
// Product gallery image (the page's largest element, LCP)
// One definition shared by the gallery, the <head> preload and the cache warmer,
// so the browser always downloads exactly one version of the main image.
// ---------------------------------------------------------------------------

/** Candidate widths: each screen picks the smallest one that is still sharp. */
export const GALLERY_IMAGE_WIDTHS = [480, 720, 1000];
/** 72 kept on purpose: 65 saves only ~10% bytes and measurably softens product photos. */
export const GALLERY_IMAGE_QUALITY = 72;
/** Gallery is full width on phones and about 640px wide on desktop. */
export const GALLERY_IMAGE_SIZES = '(max-width: 900px) 100vw, 640px';

export function getGalleryImage(url: string): { src: string; srcSet: string } {
  const src = getOptimizedImageUrl(url, { width: 1000, quality: GALLERY_IMAGE_QUALITY });
  const srcSet = GALLERY_IMAGE_WIDTHS.map(
    (w) => `${getOptimizedImageUrl(url, { width: w, quality: GALLERY_IMAGE_QUALITY })} ${w}w`
  ).join(', ');
  return { src, srcSet };
}

/** Product card image (home grid, related products). */
export function getCardImage(url: string): { src: string; srcSet: string } {
  const widths = [320, 480, 640];
  return {
    src: getOptimizedImageUrl(url, { width: 480, quality: 70 }),
    srcSet: widths.map((w) => `${getOptimizedImageUrl(url, { width: w, quality: 70 })} ${w}w`).join(', '),
  };
}
export const CARD_IMAGE_SIZES = '(max-width: 900px) 50vw, 300px';
