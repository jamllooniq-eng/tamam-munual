/**
 * Local development server (npm run dev). On Netlify the same code runs as functions.
 * It wraps the Netlify function handlers, so local behaviour = production behaviour.
 */
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

type Handler = (event: any, context?: any) => Promise<any>;

function toEvent(req: Request, rawBody: string) {
  const url = new URL(req.originalUrl, 'http://localhost');
  return {
    httpMethod: req.method,
    path: url.pathname,
    rawQuery: url.search.replace(/^\?/, ''),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(',') : String(v ?? '')])),
    body: rawBody || null,
  };
}

async function main() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  process.env.URL = process.env.URL || `http://localhost:${port}`;

  app.use(express.text({ type: '*/*', limit: '8mb' }));

  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });

  const fn = (file: string) => async (req: Request, res: Response) => {
    const mod = await vite.ssrLoadModule(`/netlify/functions/${file}.ts`);
    const handler: Handler = mod.handler;
    const out = await handler(toEvent(req, typeof req.body === 'string' ? req.body : ''), {});
    res.status(out.statusCode || 200).set(out.headers || {}).send(out.body ?? '');
  };

  app.all('/api/checkout', fn('checkout'));
  app.all('/.netlify/functions/checkout-background', async (req, res) => {
    // Netlify answers 202 at once and runs the function in the background
    res.status(202).send('');
    const mod = await vite.ssrLoadModule('/netlify/functions/checkout-background.ts');
    mod.handler(toEvent(req, typeof req.body === 'string' ? req.body : ''), {}).catch((e: any) => console.error(e));
  });
  app.all('/api/admin', fn('admin'));
  app.all('/api/meta-config', fn('meta-config'));
  app.all('/.netlify/functions/track', fn('track'));
  app.get('/sitemap.xml', fn('sitemap'));
  app.get('/robots.txt', fn('robots'));
  app.get('/admin', (_req, res) => res.sendFile(path.resolve('public/admin.html')));
  // Netlify Image CDN stand-in: just redirect to the original image
  app.get('/.netlify/images', (req, res) => res.redirect(String(req.query.url || '')));

  app.use(vite.middlewares);

  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;
      const tpl = await vite.transformIndexHtml(url, fs.readFileSync(path.resolve('index.html'), 'utf-8'));
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx');
      const r = await render(url, `http://localhost:${port}`);
      res.status(r.status).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(tpl.replace('<!--app-head-->', r.head).replace('<!--app-html-->', r.html).replace('<!--app-data-->', r.dataScript));
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      console.error(e);
      res.status(500).send(String(e?.stack || e));
    }
  });

  app.listen(port, () => console.log(`[tamam] http://localhost:${port}  (admin: /admin)`));
}

main();
