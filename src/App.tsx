import React, { useEffect } from 'react';
import { initTracking } from './lib/tracking.client';
import type { PageData } from './types';
import { Home } from './components/Home';
import { ProductPage } from './components/ProductPage';
import { Notice, Success } from './components/Success';

export default function App({ data }: { data: PageData & { whatsapp?: string } }) {
  useEffect(() => {
    initTracking();
  }, []);

  const { route, countries } = data;

  if (route.view === 'home') {
    return (
      <Home
        products={data.products || []}
        countries={countries}
        whatsapp={data.whatsapp}
        initialCategory={route.category}
        initialSearch={route.search}
      />
    );
  }

  if (route.view === 'product' && data.product) {
    const settings = countries.find((c) => c.id === data.product!.country);
    if (settings && settings.enabled) {
      return <ProductPage product={data.product} settings={settings} related={data.related || []} countries={countries} whatsapp={data.whatsapp} />;
    }
    return <Notice kind="unavailable" />;
  }

  if (route.view === 'success') return <Success />;
  return <Notice kind={route.view === 'unavailable' ? 'unavailable' : '404'} />;
}
