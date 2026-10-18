import React, { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import type { PageData } from './types';

declare global {
  interface Window {
    __INITIAL_DATA__?: PageData & { whatsapp?: string };
  }
}

const root = document.getElementById('root')!;
const data = window.__INITIAL_DATA__ || { route: { view: '404' as const }, countries: [] };
const app = (
  <StrictMode>
    <App data={data} />
  </StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
