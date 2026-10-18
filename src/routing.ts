import type { Route } from './types';

/** Same result in Node (SSR) and in the browser. */
export function parseRoute(pathname: string = '/', search: string | URLSearchParams = ''): Route {
  const params = typeof search === 'string' ? new URLSearchParams(search.replace(/^\?/, '')) : search;
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  const product = path.match(/^\/product\/(\d{1,12})$/);
  if (product) return { view: 'product', productId: Number(product[1]) };

  if (path === '/success') return { view: 'success' };

  if (path === '' || path === '/' || path === '/index.html') {
    const category = (params.get('category') || '').trim() || undefined;
    const search = (params.get('q') || '').trim() || undefined;
    return { view: 'home', category, search };
  }

  return { view: '404' };
}

/** Only these query parameters change what a page shows (everything else is tracking noise). */
export const MEANINGFUL_QUERY_PARAMS = ['q', 'category'];
