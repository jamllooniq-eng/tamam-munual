import type { Handler } from '@netlify/functions';
import { warmTargets } from '../../server/cache.server';
import { isDbConfigured, listActiveProducts } from '../../server/db.server';

/**
 * Runs automatically after every successful deploy (Netlify signs these calls).
 * A new deploy starts with an empty CDN cache: pre-render the home page and every product page
 * so the first ad visitors after a deploy don't wait for the server.
 */
export const handler: Handler = async (event) => {
  let context = 'production';
  try {
    context = JSON.parse(event.body || '{}')?.payload?.context || context;
  } catch {
    // assume production
  }
  if (context !== 'production') return { statusCode: 200, body: `skipped (${context})` };
  const targets: { path: string; image?: string }[] = [{ path: '/' }];
  try {
    if (isDbConfigured()) {
      for (const p of await listActiveProducts()) targets.push({ path: `/product/${p.id}`, image: p.images[0] });
    }
  } catch {
    // home only
  }
  const warmed = await warmTargets(targets, { deadlineMs: 40000, max: 60 });
  return { statusCode: 200, body: JSON.stringify({ warmed }) };
};
