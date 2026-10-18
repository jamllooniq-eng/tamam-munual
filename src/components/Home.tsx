import React, { useMemo, useState } from 'react';
import { CountrySettings, formatMoney, getCountry } from '../lib/countries';
import { getOptimizedImageUrl } from '../lib/image';
import type { Product } from '../types';
import { Cash, Exchange, Eye, Truck } from './Icons';
import { Announcement, Footer, Header } from './Layout';
import { CardImage, ProductCard } from './ProductCard';

interface Props {
  products: Product[];
  countries: CountrySettings[];
  whatsapp?: string;
  initialCategory?: string;
  initialSearch?: string;
}

function updateUrl(category: string, q: string) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (category !== 'الكل') params.set('category', category);
  if (q) params.set('q', q);
  const qs = params.toString();
  window.history.replaceState(null, '', `/${qs ? `?${qs}` : ''}${window.location.hash}`);
}

export function Home({ products, countries, whatsapp, initialCategory, initialSearch }: Props) {
  const byCountry = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const live = useMemo(() => products.filter((p) => byCountry.get(p.country)?.enabled), [products, byCountry]);
  const cats = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of live) {
      const k = p.category || 'عام';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [live]);

  const [cat, setCat] = useState(initialCategory && cats.has(initialCategory) ? initialCategory : 'الكل');
  const [q, setQ] = useState(initialSearch || '');

  const list = live.filter((p) => (cat === 'الكل' || (p.category || 'عام') === cat) && (!q || p.title.includes(q.trim())));
  const hero = live[0];
  const onCountries = countries.filter((c) => c.enabled);
  const anyFree = onCountries.some((c) => c.free_shipping);

  const pickCat = (k: string, scroll = false) => {
    setCat(k);
    updateUrl(k, q);
    if (scroll) document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Announcement text={`نوصل للعراق ودول الخليج${anyFree ? ' · توصيل مجاني' : ''} · الدفع عند الاستلام`} />
      <Header
        whatsapp={whatsapp}
        search={q}
        onSearch={(v) => {
          setQ(v);
          updateUrl(cat, v);
          if (v) document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />
      <main>
        <section className="hero">
          <div className="wrap">
            <div>
              <span className="eyebrow">{anyFree ? 'توصيل مجاني خلال 48 ساعة' : 'توصيل لباب البيت'}</span>
              <h1>
                قطع مختارة بعناية،
                <br />
                تصلك إلى باب بيتك
              </h1>
              <p>اختار المنتج، اكتب اسمك ورقمك، ونتصل بيك نأكد الطلب. تدفع بعملة بلدك لما يوصلك وتفحصه.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a className="btn gold" href="#products">تسوّق الآن</a>
                <a className="btn ghost" href="#how">كيف تطلب؟</a>
              </div>
              <div className="hero-pts">
                <span>{anyFree ? 'توصيل مجاني' : 'توصيل سريع'}</span>
                <span>الدفع عند الاستلام</span>
                <span>استبدال خلال 7 أيام</span>
              </div>
            </div>
            {hero && (
              <a className="hero-art" href={`/product/${hero.id}`} aria-label={hero.title}>
                <div className="frame" />
                <div className="main">
                  {hero.images[0] ? (
                    <img src={getOptimizedImageUrl(hero.images[0], { width: 720, quality: 72 })} alt={hero.title} fetchPriority="high" />
                  ) : (
                    <div className="img-ph" />
                  )}
                </div>
                <div className="chip">
                  <b>{hero.title.length > 30 ? `${hero.title.slice(0, 30)}…` : hero.title}</b>
                  <span className="pr num">{formatMoney(hero.price, hero.country)}</span>
                  <span>{byCountry.get(hero.country)?.free_shipping ? 'توصيل مجاني' : 'توصيل'} · {getCountry(hero.country).name}</span>
                </div>
              </a>
            )}
          </div>
        </section>

        {cats.size > 1 && (
          <section className="sec" style={{ paddingBottom: 0 }}>
            <div className="wrap">
              <div className="sec-h">
                <span className="eyebrow">الأقسام</span>
                <h2>تسوّق حسب القسم</h2>
              </div>
              <div className="cols">
                {[...cats.entries()].map(([k, arr]) => (
                  <button key={k} className="col" type="button" onClick={() => pickCat(k, true)}>
                    <div className="ci"><CardImage url={arr[0].images[0]} alt="" /></div>
                    <b>{k}</b>
                    <span>{arr.length} منتج</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="sec" id="products">
          <div className="wrap">
            <div className="sec-h">
              <div>
                <span className="eyebrow">المتجر</span>
                <h2>{q ? `نتائج البحث عن "${q}"` : 'وصل حديثاً'}</h2>
                <p>{list.length} منتج</p>
              </div>
              {cats.size > 1 && (
                <div className="tabs" role="tablist">
                  {['الكل', ...cats.keys()].map((k) => (
                    <button key={k} type="button" aria-pressed={k === cat} onClick={() => pickCat(k)}>
                      {k}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid">
              {list.length ? (
                list.map((p, i) => <ProductCard key={p.id} p={p} settings={byCountry.get(p.country)} eager={i < 4} />)
              ) : (
                <div className="empty">
                  {live.length ? 'ما لكينا منتجات تطابق اختيارك. جرّب قسم ثاني أو كلمة ثانية.' : 'المنتجات راح تنزل قريباً.'}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="usp">
          <div className="wrap">
            <div><Truck size={26} /><div><b>{anyFree ? 'توصيل مجاني' : 'توصيل لباب البيت'}</b><span>خلال 48 ساعة</span></div></div>
            <div><Cash size={26} /><div><b>الدفع عند الاستلام</b><span>نقداً للمندوب</span></div></div>
            <div><Eye size={26} /><div><b>افحص قبل ما تدفع</b><span>المنتج بإيدك أولاً</span></div></div>
            <div><Exchange size={26} /><div><b>استبدال 7 أيام</b><span>إذا بيه مشكلة</span></div></div>
          </div>
        </div>

        <section className="band" id="how">
          <div className="wrap">
            <div>
              <span className="eyebrow">كيف تطلب</span>
              <h2>ثلاث خطوات <em>فقط</em></h2>
              <p>ماكو حساب، ماكو سلة، وماكو دفع إلكتروني. الطلب ياخذ أقل من دقيقة.</p>
            </div>
            <div className="steps">
              <div><b>تعبي الفورم</b><span>الاسم والرقم والعنوان بصفحة المنتج</span></div>
              <div><b>نتصل بيك</b><span>نأكد الطلب والعنوان</span></div>
              <div><b>يوصلك وتدفع</b><span>تفحص المنتج وتدفع للمندوب</span></div>
            </div>
          </div>
        </section>

        {onCountries.length > 0 && (
          <section className="sec">
            <div className="wrap">
              <div className="sec-h">
                <div>
                  <span className="eyebrow">التوصيل</span>
                  <h2>نوصل إلى</h2>
                  <p>تفاصيل التوصيل تلقاها بصفحة كل منتج</p>
                </div>
              </div>
              <div className="reach">
                {onCountries.map((s) => {
                  const c = getCountry(s.id);
                  return (
                    <div key={s.id}>
                      <span className="cc">{c.id}</span>
                      <span>{c.name}</span>
                      <em className={s.free_shipping ? 'f' : ''}>{s.free_shipping ? 'توصيل مجاني' : `من ${formatMoney(s.shipping_fee, s.id)}`}</em>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer countries={countries} whatsapp={whatsapp} />
    </>
  );
}
