import React, { useEffect, useState } from 'react';
import { formatMoney, getCountry } from '../lib/countries';
import { trackPurchase } from '../lib/tracking.client';
import { Check } from './Icons';
import { Announcement, Logo } from './Layout';
import { SUCCESS_KEY } from './ProductPage';

interface LastOrder {
  orderId: string;
  productId: number;
  productTitle: string;
  country: string;
  qty: number;
  total: number;
  name: string;
  phone: string;
  region: string;
  address: string;
  nat?: string;
  tracked?: boolean;
}

export function Success() {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SUCCESS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as LastOrder;
      setOrder(o);
      if (!o.tracked) {
        trackPurchase({ orderId: o.orderId, productId: o.productId, productName: o.productTitle, total: o.total, count: o.qty, country: o.country, name: o.name, phone: o.phone });
        sessionStorage.setItem(SUCCESS_KEY, JSON.stringify({ ...o, tracked: true }));
      }
    } catch {
      // no stored order: generic message
    }
  }, []);

  const c = order ? getCountry(order.country) : null;

  return (
    <>
      <Announcement text="شكراً لطلبك من تمام شوب" />
      <main className="wrap">
        <div className="ty">
          <div className="ck"><Check /></div>
          <h1>تم استلام طلبك</h1>
          <p>{order ? `راح نتصل بيك على الرقم ${order.phone} حتى نأكد الطلب.` : 'راح نتصل بيك قريباً حتى نأكد الطلب.'}</p>
          {order && c && (
            <div className="ty-box num">
              <div><span>رقم الطلب</span><b>{order.orderId}</b></div>
              <div><span>المنتج</span><b>{order.productTitle} × {order.qty}</b></div>
              <div><span>العنوان</span><b>{c.name}، {order.region}، {order.address}</b></div>
              {order.nat && <div><span>العنوان الوطني</span><b>{order.nat}</b></div>}
              <div><span>المبلغ عند الاستلام</span><b>{formatMoney(order.total, order.country)}</b></div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="btn" href="/">ارجع للمتجر</a>
            {order && <a className="btn out" href={`/product/${order.productId}`}>صفحة المنتج</a>}
          </div>
        </div>
      </main>
      <footer className="lfoot"><div className="wrap"><Logo href="/" /><small>© {new Date().getFullYear()} تمام شوب</small></div></footer>
    </>
  );
}

export function Notice({ kind }: { kind: '404' | 'unavailable' }) {
  return (
    <>
      <Announcement text="تمام شوب · الدفع عند الاستلام" />
      <main className="wrap">
        <div className="notice">
          {kind === '404' ? (
            <>
              <h1>الصفحة غير موجودة</h1>
              <p>يمكن الرابط قديم أو المنتج انشال. تقدر تشوف باقي المنتجات بالمتجر.</p>
            </>
          ) : (
            <>
              <h1>المنتج غير متوفر حالياً</h1>
              <p>صار خلل مؤقت أو المنتج متوقف. حاول بعد شوية، أو شوف باقي المنتجات.</p>
            </>
          )}
          <a className="btn" href="/">ارجع للمتجر</a>
        </div>
      </main>
      <footer className="lfoot"><div className="wrap"><Logo href="/" /></div></footer>
    </>
  );
}
