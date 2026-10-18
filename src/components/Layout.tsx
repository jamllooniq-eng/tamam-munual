import React, { useEffect, useState } from 'react';
import { COUNTRY_LIST, CountrySettings, formatMoney, getCountry } from '../lib/countries';
import { Chat, Close, Search } from './Icons';

export const STORE_NAME = 'تمام شوب';

export function Logo({ light = false, href }: { light?: boolean; href?: string }) {
  const inner = (
    <span className="lw">
      <b>{STORE_NAME}</b>
      <i>TAMAM</i>
    </span>
  );
  if (href) {
    return (
      <a href={href} className={`logo${light ? ' light' : ''}`} aria-label={STORE_NAME}>
        {inner}
      </a>
    );
  }
  return <span className={`logo${light ? ' light' : ''}`}>{inner}</span>;
}

export function Announcement({ text, sticky = false }: { text: string; sticky?: boolean }) {
  return (
    <div className={`ann${sticky ? ' ann-sticky' : ''}`}>
      <div className="wrap">
        <span className="dia" />
        <span>{text}</span>
        <span className="dia" />
      </div>
    </div>
  );
}

export function whatsappLink(number: string): string {
  const digits = (number || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

export function Header({ whatsapp, search, onSearch }: { whatsapp?: string; search?: string; onSearch?: (q: string) => void }) {
  const [open, setOpen] = useState(Boolean(search));
  const wa = whatsappLink(whatsapp || '');
  return (
    <header className="hdr">
      <div className="wrap">
        <nav className="nav" aria-label="القائمة">
          <a href="/" className="on">الرئيسية</a>
          <a href="/#products">المنتجات</a>
          <a href="/#how">كيف تطلب</a>
          {wa && <a href={wa} target="_blank" rel="noopener">تواصل معنا</a>}
        </nav>
        <span className="ib burger spacer" aria-hidden="true" />
        <Logo href="/" />
        <div className="hdr-end">
          <button className="ib" type="button" aria-label="بحث" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Search />
          </button>
          {wa && (
            <a className="ib" href={wa} target="_blank" rel="noopener" aria-label="تواصل واتساب">
              <Chat />
            </a>
          )}
        </div>
      </div>
      {open && (
        <div className="search-row">
          <div className="wrap">
            <input
              id="q"
              type="search"
              autoFocus
              defaultValue={search || ''}
              placeholder="ابحث عن منتج…"
              aria-label="بحث"
              onChange={(e) => onSearch?.(e.target.value)}
            />
          </div>
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Policies (open over the page)
// ---------------------------------------------------------------------------

export type PolicyKey = 'privacy' | 'terms' | 'returns';

const POLICIES: Record<PolicyKey, { title: string; body: string[] }> = {
  privacy: {
    title: 'سياسة الخصوصية',
    body: [
      'نطلب منك بس المعلومات اللازمة لتوصيل طلبك: اسم المستلم ورقم الهاتف والعنوان.',
      'نستخدم هذي المعلومات للاتصال بيك لتأكيد الطلب ولتسليمه عن طريق شركة التوصيل فقط، وما نبيعها أو نشاركها مع أي جهة ثانية.',
      'قد نستخدم أدوات قياس الإعلانات (مثل بيكسل ميتا وتيك توك) لمعرفة أداء إعلاناتنا، وهي ما تشوف معلومات طلبك بشكل مقروء.',
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    body: [
      'الأسعار المعروضة نهائية وتشمل التوصيل إذا كان التوصيل مجاني لدولتك.',
      'الطلب يتأكد بعد اتصالنا بيك. إذا ما قدرنا نوصلك بعد عدة محاولات، يتلغى الطلب تلقائياً.',
      'الدفع نقداً عند الاستلام، وتقدر تفحص المنتج قدام المندوب قبل ما تدفع.',
    ],
  },
  returns: {
    title: 'الاستبدال والإرجاع',
    body: [
      'إذا وصلك المنتج بيه عيب أو مو مطابق للوصف، تقدر تستبدله خلال 7 أيام من الاستلام.',
      'لازم يكون المنتج بحالته الأصلية ويّا علبته.',
      'تواصل ويانا وراح نرتب الاستبدال بدون كلفة إضافية عليك.',
    ],
  },
};

export function PolicyModal({ which, onClose }: { which: PolicyKey | null; onClose: () => void }) {
  useEffect(() => {
    if (!which) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [which, onClose]);
  if (!which) return null;
  const p = POLICIES[which];
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={p.title} onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <b>{p.title}</b>
          <button type="button" className="ib" aria-label="إغلاق" onClick={onClose}>
            <Close />
          </button>
        </div>
        {p.body.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
    </div>
  );
}

export function PolicyLinks({ onOpen, whatsapp }: { onOpen: (k: PolicyKey) => void; whatsapp?: string }) {
  const wa = whatsappLink(whatsapp || '');
  return (
    <>
      <a href="#privacy" onClick={(e) => { e.preventDefault(); onOpen('privacy'); }}>سياسة الخصوصية</a>
      <a href="#terms" onClick={(e) => { e.preventDefault(); onOpen('terms'); }}>الشروط والأحكام</a>
      <a href="#returns" onClick={(e) => { e.preventDefault(); onOpen('returns'); }}>الاستبدال والإرجاع</a>
      {wa && <a href={wa} target="_blank" rel="noopener">تواصل معنا</a>}
    </>
  );
}

export function Footer({ countries, whatsapp }: { countries: CountrySettings[]; whatsapp?: string }) {
  const [policy, setPolicy] = useState<PolicyKey | null>(null);
  const on = countries.filter((c) => c.enabled);
  return (
    <footer className="foot">
      <div className="wrap">
        <div>
          <Logo light />
          <p style={{ marginTop: 14, maxWidth: '34ch' }}>متجر للطلب المباشر والدفع عند الاستلام. نوصل للعراق ودول الخليج.</p>
        </div>
        <div>
          <h5>المتجر</h5>
          <ul>
            <li><a href="/#products">كل المنتجات</a></li>
            <li><a href="/#how">كيف تطلب</a></li>
          </ul>
        </div>
        <div>
          <h5>السياسات</h5>
          <div className="foot-links">
            <PolicyLinks onOpen={setPolicy} whatsapp={whatsapp} />
          </div>
        </div>
        <div>
          <h5>نوصل إلى</h5>
          <ul>
            {on.map((s) => {
              const c = getCountry(s.id);
              return <li key={s.id}>{c.name} · {c.currencyName}</li>;
            })}
          </ul>
        </div>
      </div>
      <div className="copy">© {new Date().getFullYear()} {STORE_NAME} · جميع الحقوق محفوظة</div>
      <PolicyModal which={policy} onClose={() => setPolicy(null)} />
    </footer>
  );
}

/** "توصيل مجاني" or the fee, for a country. */
export function shippingLabel(s: CountrySettings | undefined): string {
  if (!s || s.free_shipping) return 'توصيل مجاني';
  return `توصيل ${formatMoney(s.shipping_fee, s.id)}`;
}

export const ALL_COUNTRIES = COUNTRY_LIST;
