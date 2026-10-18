import React from 'react';
import { CountrySettings, formatMoney, getCountry } from '../lib/countries';
import { CARD_IMAGE_SIZES, getCardImage } from '../lib/image';
import type { Product } from '../types';

export function discountPercent(p: Pick<Product, 'price' | 'old_price'>): number {
  return p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
}

export function CardImage({ url, alt, eager = false }: { url?: string; alt: string; eager?: boolean }) {
  if (!url) return <div className="img-ph" aria-hidden="true" />;
  const { src, srcSet } = getCardImage(url);
  return <img src={src} srcSet={srcSet} sizes={CARD_IMAGE_SIZES} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

export function ProductCard({ p, settings, eager = false }: { p: Product; settings?: CountrySettings; eager?: boolean }) {
  const c = getCountry(p.country);
  const off = discountPercent(p);
  const soldOut = p.stock !== null && p.stock <= 0;
  const free = !settings || settings.free_shipping;
  return (
    <a className="card" href={`/product/${p.id}`}>
      <div className="ph">
        <div><CardImage url={p.images[0]} alt={p.title} eager={eager} /></div>
        {p.images[1] && (
          <div className="alt"><CardImage url={p.images[1]} alt="" /></div>
        )}
        {soldOut ? <span className="badge soldout">نفدت الكمية</span> : off ? <span className="badge num">خصم {off}%</span> : null}
        <span className="quick">اطلب الآن</span>
      </div>
      {p.category && <span className="cat">{p.category}</span>}
      <h3>{p.title}</h3>
      <div className="price num">
        <b className={off ? 'on-sale' : ''}>{formatMoney(p.price, p.country)}</b>
        {off ? <s>{formatMoney(p.old_price!, p.country)}</s> : null}
      </div>
      <span className={`ship-mini${free ? ' free' : ''}`}>
        <span className="cc">{c.id}</span>
        {free ? `توصيل مجاني · ${c.name}` : `توصيل إلى ${c.name}`}
      </span>
    </a>
  );
}
