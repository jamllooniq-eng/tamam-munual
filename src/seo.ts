import { formatMoney, getCountry } from './lib/countries';
import { getGalleryImage } from './lib/image';
import type { Product, Route } from './types';

const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function headTags(opts: { route: Route; product?: Product | null; origin: string; canonical: string }): string {
  const { route, product, origin, canonical } = opts;
  const store = 'تمام شوب';
  let title = `${store} | منتجات مختارة، توصيل للعراق والخليج والدفع عند الاستلام`;
  let desc = 'تمام شوب: اطلب بدون تسجيل، ونوصل لباب بيتك بالعراق ودول الخليج. الدفع نقداً عند الاستلام.';
  let image = '';
  const tags: string[] = [];

  if (route.view === 'product' && product) {
    const c = getCountry(product.country);
    title = `${product.title} | ${store}`;
    const d = (product.description || '').replace(/\s+/g, ' ').trim();
    desc = `${product.title} بسعر ${formatMoney(product.price, c.id)}. توصيل ${c.to} والدفع عند الاستلام.${d ? ' ' + d.slice(0, 110) : ''}`;
    if (product.images[0]) {
      image = product.images[0];
      const g = getGalleryImage(product.images[0]);
      // Preload the main photo (largest element on the page)
      tags.push(`<link rel="preload" as="image" href="${esc(g.src)}" imagesrcset="${esc(g.srcSet)}" imagesizes="(max-width: 900px) 100vw, 640px" fetchpriority="high">`);
    }
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      image: product.images.slice(0, 5),
      description: d || product.title,
      sku: String(product.id),
      offers: {
        '@type': 'Offer',
        url: canonical,
        priceCurrency: c.currency,
        price: product.price,
        availability: product.stock !== null && product.stock <= 0 ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
    };
    tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  } else if (route.view === 'success') {
    title = `تم استلام طلبك | ${store}`;
  } else if (route.view === '404') {
    title = `الصفحة غير موجودة | ${store}`;
  }

  const noindex = route.view === 'success' || route.view === '404' || route.view === 'unavailable';
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:type" content="${route.view === 'product' ? 'product' : 'website'}">`,
    `<meta property="og:site_name" content="${store}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    ...tags,
  ]
    .filter(Boolean)
    .join('\n    ')
    .replace(/__ORIGIN__/g, origin);
}
