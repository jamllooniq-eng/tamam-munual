import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CountrySettings, formatMoney, getCountry, roundMoney, shippingCost, validatePhone } from '../lib/countries';
import { GALLERY_IMAGE_SIZES, getGalleryImage, getOptimizedImageUrl } from '../lib/image';
import { getTrackingIds, trackInitiateCheckout, trackViewContent } from '../lib/tracking.client';
import type { OrderResponse, Product } from '../types';
import { ChevronNext, ChevronPrev, Doc, Exchange, Eye, Lock, Minus, Plus, Question, Truck } from './Icons';
import { Announcement, Logo, PolicyKey, PolicyLinks, PolicyModal } from './Layout';
import { discountPercent, ProductCard } from './ProductCard';

type Field = 'name' | 'phone' | 'region' | 'addr' | 'nat';
type Errors = Partial<Record<Field, string>>;

export const SUCCESS_KEY = 'tamam_last_order';

function newOrderId(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `ORD-${Date.now().toString().slice(-8)}-${rand}`;
}

function Gallery({ product, off }: { product: Product; off: number }) {
  const imgs = product.images;
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const n = imgs.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  const main = imgs[i];
  const g = main ? getGalleryImage(main) : null;
  return (
    <div>
      <div className={`gal${n < 2 ? ' one' : ''}`}>
        {n > 1 && (
          <div className="thumbs">
            {imgs.map((u, k) => (
              <button key={u + k} type="button" aria-pressed={k === i} aria-label={`صورة ${k + 1}`} onClick={() => setI(k)}>
                <img src={getOptimizedImageUrl(u, { width: 160, quality: 60 })} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <div
          className="stage"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current === null || n < 2) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 40) go(dx > 0 ? 1 : -1); // RTL: swipe right = next
          }}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            {g ? (
              <img src={g.src} srcSet={g.srcSet} sizes={GALLERY_IMAGE_SIZES} alt={product.title} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async" />
            ) : (
              <div className="img-ph" />
            )}
          </div>
          {off > 0 && <span className="badge num">خصم {off}%</span>}
          {n > 1 && (
            <>
              <button className="nav-a prev" type="button" aria-label="الصورة السابقة" onClick={() => go(-1)}><ChevronPrev /></button>
              <button className="nav-a next" type="button" aria-label="الصورة التالية" onClick={() => go(1)}><ChevronNext /></button>
              <span className="count num">{i + 1} / {n}</span>
            </>
          )}
        </div>
      </div>
      {n > 1 && (
        <div className="dots" aria-hidden="true">
          {imgs.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}
        </div>
      )}
    </div>
  );
}

function Accordion({ items }: { items: { key: string; icon: React.ReactNode; title: string; body: React.ReactNode; open?: boolean }[] }) {
  return (
    <div className="acc">
      {items.map((it) => (
        <details key={it.key} open={it.open}>
          <summary>{it.icon}{it.title}</summary>
          <div className="body">{it.body}</div>
        </details>
      ))}
    </div>
  );
}

export function ProductPage({ product, settings, related, countries, whatsapp }: {
  product: Product;
  settings: CountrySettings;
  related: Product[];
  countries: CountrySettings[];
  whatsapp?: string;
}) {
  const c = getCountry(product.country);
  const off = discountPercent(product);
  const soldOut = product.stock !== null && product.stock <= 0;
  const maxQty = product.stock === null ? 10 : Math.max(1, Math.min(10, product.stock));
  const byCountry = useMemo(() => new Map(countries.map((s) => [s.id, s])), [countries]);

  const [qty, setQty] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [addr, setAddr] = useState('');
  const [nat, setNat] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [policy, setPolicy] = useState<PolicyKey | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const startedRef = useRef(false);
  const orderIdRef = useRef<string>('');

  const subtotal = roundMoney(product.price * qty, c.id);
  const ship = roundMoney(shippingCost(subtotal, settings), c.id);
  const total = roundMoney(subtotal + ship, c.id);

  useEffect(() => {
    trackViewContent({ id: product.id, title: product.title, price: product.price, country: product.country });
  }, [product.id]);

  useEffect(() => {
    const onScroll = () => {
      const r = formRef.current?.getBoundingClientRect();
      setSticky(Boolean(r && r.bottom < 0));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const started = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackInitiateCheckout({ id: product.id, title: product.title, price: product.price, country: product.country, count: qty });
  };

  const clearErr = (f: Field) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  function validate(): Errors {
    const e: Errors = {};
    const nm = name.trim().replace(/\s+/g, ' ');
    if (!nm) e.name = 'اكتب اسم المستلم';
    else if (nm.split(' ').length < 2) e.name = 'اكتب اسم المستلم (اسمين على الأقل)';
    const ph = validatePhone(phone, c.id);
    if (!ph.ok) e.phone = ph.error;
    if (!region) e.region = `اختر ${c.regionLabel}`;
    if (addr.trim().length < 3) e.addr = 'اكتب العنوان بالتفصيل';
    if (settings.national_address && nat.trim().length < 4) e.nat = 'اكتب العنوان الوطني';
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (sending || soldOut) return;
    setFormError('');
    const e = validate();
    setErrors(e);
    const first = (Object.keys(e) as Field[])[0];
    if (first) {
      document.getElementById(`o-${first}`)?.focus();
      return;
    }
    started();
    setSending(true);
    if (!orderIdRef.current) orderIdRef.current = newOrderId();
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderIdRef.current,
          item_id: product.id,
          count: qty,
          cus_name: name.trim(),
          cus_num1: phone,
          region,
          address: addr.trim(),
          national_address: settings.national_address ? nat.trim() : undefined,
          ...getTrackingIds(),
        }),
      });
      const data: OrderResponse = await res.json().catch(() => ({ success: false }));
      if (data.success && data.orderId) {
        try {
          sessionStorage.setItem(
            SUCCESS_KEY,
            JSON.stringify({
              orderId: data.orderId,
              productId: product.id,
              productTitle: product.title,
              country: product.country,
              qty,
              total: data.total ?? total,
              name: name.trim(),
              phone: validatePhone(phone, c.id).phone,
              region,
              address: addr.trim(),
              nat: settings.national_address ? nat.trim() : '',
              tracked: false,
            })
          );
        } catch {
          // storage blocked: the thank-you page still shows a generic message
        }
        window.location.href = '/success';
        return;
      }
      if (data.field) setErrors({ [data.field]: data.error });
      else setFormError(data.error || 'ما قدرنا نرسل الطلب، تأكد من الإنترنت وحاول مرة ثانية.');
    } catch {
      setFormError('ما قدرنا نرسل الطلب، تأكد من الإنترنت وحاول مرة ثانية.');
    }
    setSending(false);
  }

  const err = (f: Field) =>
    errors[f] ? (
      <span className="err-t" id={`e-${f}`} role="alert">{errors[f]}</span>
    ) : null;

  const shipText = settings.free_shipping
    ? `التوصيل مجاني لـ${c.everywhere}`
    : `التوصيل ${formatMoney(settings.shipping_fee, c.id)}${settings.free_over > 0 ? `، ومجاني فوق ${formatMoney(settings.free_over, c.id)}` : ''}`;

  return (
    <>
      <Announcement text={settings.banner || `${settings.free_shipping ? 'توصيل مجاني' : 'توصيل'} ${c.to} خلال ${settings.delivery_text} · الدفع عند الاستلام`} sticky />
      <main>
        <div className="wrap">
          <div className="pd">
            <Gallery product={product} off={off} />

            <div className="info">
              <h1>{product.title}</h1>
              <div className="price num">
                <b>{formatMoney(product.price, c.id)}</b>
                <span className={`free-pill${settings.free_shipping ? '' : ' paid'}`}>
                  <Truck size={18} />
                  {settings.free_shipping ? 'توصيل مجاني' : `توصيل ${formatMoney(settings.shipping_fee, c.id)}`}
                </span>
                {off > 0 && <s className="was">{formatMoney(product.old_price!, c.id)}</s>}
              </div>
              {product.stock !== null && product.stock > 0 && product.stock <= 10 && (
                <div className="stockline low"><span className="t">باقي {product.stock} قطع فقط بالمخزون</span></div>
              )}

              <form className="oform" id="orderForm" ref={formRef} noValidate onSubmit={submit} onFocus={started}>
                <div className="oform-head">
                  <b>لطلب المنتج، يرجى إدخال معلوماتك</b>
                  <span>نتصل بيك لتأكيد الطلب، والدفع نقداً عند الاستلام</span>
                </div>

                {soldOut ? (
                  <div className="soldout-box">نفدت الكمية من هذا المنتج حالياً.</div>
                ) : (
                  <>
                    <div className="qwrap">
                      <span className="lbl">الكمية</span>
                      <div className="qstep">
                        <button type="button" aria-label="إنقاص الكمية" disabled={qty <= 1} onClick={() => setQty((v) => Math.max(1, v - 1))}><Minus /></button>
                        <output className="num" aria-live="polite">{qty}</output>
                        <button type="button" aria-label="زيادة الكمية" disabled={qty >= maxQty} onClick={() => setQty((v) => Math.min(maxQty, v + 1))}><Plus /></button>
                      </div>
                    </div>

                    <div className="fgrid2">
                      <div className="field">
                        <label htmlFor="o-name">اسم المستلم</label>
                        <input className={`inp${errors.name ? ' err' : ''}`} id="o-name" autoComplete="name" placeholder="اسم المستلم" value={name}
                          onChange={(e) => { setName(e.target.value); clearErr('name'); }} aria-invalid={Boolean(errors.name)} />
                        {err('name')}
                      </div>
                      <div className="field">
                        <label htmlFor="o-phone">رقم الهاتف</label>
                        <input className={`inp num tel${errors.phone ? ' err' : ''}`} id="o-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={c.phonePlaceholder} value={phone}
                          onChange={(e) => { setPhone(e.target.value); clearErr('phone'); }} aria-invalid={Boolean(errors.phone)} />
                        {err('phone')}
                      </div>
                      <div className="field">
                        <label htmlFor="o-region">{c.regionLabel}</label>
                        <select className={`inp${errors.region ? ' err' : ''}`} id="o-region" value={region}
                          onChange={(e) => { setRegion(e.target.value); clearErr('region'); }} aria-invalid={Boolean(errors.region)}>
                          <option value="">اختر {c.regionLabel}</option>
                          {c.regions.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {err('region')}
                      </div>
                      <div className="field">
                        <label htmlFor="o-addr">العنوان بالتفصيل</label>
                        <input className={`inp${errors.addr ? ' err' : ''}`} id="o-addr" autoComplete="street-address" value={addr}
                          placeholder={c.id === 'KW' ? 'المنطقة، القطعة، الشارع، المنزل' : c.id === 'SA' ? 'الحي، الشارع' : 'المنطقة، الشارع، أقرب نقطة دالة'}
                          onChange={(e) => { setAddr(e.target.value); clearErr('addr'); }} aria-invalid={Boolean(errors.addr)} />
                        {err('addr')}
                      </div>
                      {settings.national_address && (
                        <div className="field full">
                          <label htmlFor="o-nat">العنوان الوطني</label>
                          <input className={`inp${errors.nat ? ' err' : ''}`} id="o-nat" autoComplete="off" placeholder="اكتب عنوانك الوطني" value={nat}
                            onChange={(e) => { setNat(e.target.value); clearErr('nat'); }} aria-invalid={Boolean(errors.nat)} />
                          <span className="help">تلقاه بتطبيق سُبل أو توكلنا.</span>
                          {err('nat')}
                        </div>
                      )}
                    </div>

                    <div className="sum num">
                      <div><span>المنتج × {qty}</span><span>{formatMoney(subtotal, c.id)}</span></div>
                      <div><span>التوصيل</span>{ship === 0 ? <span className="free">مجاني</span> : <span>{formatMoney(ship, c.id)}</span>}</div>
                      {ship > 0 && settings.free_over > 0 && (
                        <div className="help"><span>ضيف {formatMoney(settings.free_over - subtotal, c.id)} ويصير التوصيل مجاني</span></div>
                      )}
                      <div className="tot"><span>المجموع</span><span>{formatMoney(total, c.id)}</span></div>
                    </div>

                    {formError && <div className="form-error" role="alert">{formError}</div>}

                    <button className="btn wide cta" type="submit" disabled={sending}>
                      {sending ? <><span className="spin" /> جاري إرسال الطلب…</> : <>تأكيد الطلب · {formatMoney(total, c.id)}</>}
                    </button>
                    <p className="secure"><Lock />معلوماتك محمية، وما تدفع إلا لما يوصلك الطلب</p>
                  </>
                )}
              </form>

              <Accordion
                items={[
                  {
                    key: 'desc',
                    icon: <Doc />,
                    title: 'وصف المنتج',
                    open: true,
                    body: (
                      <>
                        {product.description && <p style={{ whiteSpace: 'pre-line' }}>{product.description}</p>}
                        {product.features && product.features.length > 0 && (
                          <ul className="feat">{product.features.map((f, k) => <li key={k}>{f}</li>)}</ul>
                        )}
                        {!product.description && !product.features?.length && <p>منتج أصلي بجودة عالية.</p>}
                      </>
                    ),
                  },
                  {
                    key: 'ship',
                    icon: <Truck size={20} />,
                    title: 'التوصيل والدفع',
                    body: (
                      <>
                        <p>{shipText}، ويوصلك خلال {settings.delivery_text} من تأكيد الطلب.</p>
                        <p>تدفع نقداً بال{c.currencyName} للمندوب بعد ما تفحص المنتج.</p>
                      </>
                    ),
                  },
                  {
                    key: 'ret',
                    icon: <Exchange size={20} />,
                    title: 'الاستبدال والإرجاع',
                    body: <p>إذا وصلك المنتج بيه مشكلة أو مو مطابق للوصف، تقدر تستبدله خلال 7 أيام من الاستلام.</p>,
                  },
                  {
                    key: 'q',
                    icon: <Question />,
                    title: 'أسئلة شائعة',
                    body: (
                      <>
                        <p><b>متى تتصلون بيّ؟</b><br />خلال ساعات من الطلب حتى نأكد العنوان والكمية.</p>
                        <p><b>أكدر ألغي الطلب؟</b><br />إي، كلنا بالمكالمة قبل الشحن.</p>
                        {settings.national_address && <p><b>ليش تطلبون العنوان الوطني؟</b><br />شركات الشحن بالسعودية تحتاجه حتى توصل لبابك بالضبط.</p>}
                      </>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </div>

        <section className="trustband">
          <div className="wrap">
            <div><i><Truck /></i><span><b>{settings.free_shipping ? 'توصيل مجاني' : 'توصيل لباب البيت'}</b><span>{settings.free_shipping ? `لـ${c.everywhere} خلال ${settings.delivery_text}` : `خلال ${settings.delivery_text}`}</span></span></div>
            <div><i><Eye /></i><span><b>افحص قبل ما تدفع</b><span>تدفع بال{c.currencyName} بس إذا عجبك</span></span></div>
            <div><i><Exchange /></i><span><b>استبدال خلال 7 أيام</b><span>إذا وصلك المنتج بيه مشكلة</span></span></div>
          </div>
        </section>

        {related.length > 0 && (
          <section className="lsec" style={{ borderTop: 0 }}>
            <div className="wrap" style={{ maxWidth: 1280 }}>
              <div className="lsec-h">
                <span className="eyebrow">من نفس المتجر</span>
                <h2>قد يعجبك أيضاً</h2>
              </div>
              <div className="grid">
                {related.map((p) => <ProductCard key={p.id} p={p} settings={byCountry.get(p.country)} />)}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="lfoot">
        <div className="wrap">
          <Logo href="/" />
          <nav><PolicyLinks onOpen={setPolicy} whatsapp={whatsapp} /></nav>
          <small>© {new Date().getFullYear()} تمام شوب</small>
        </div>
      </footer>
      <PolicyModal which={policy} onClose={() => setPolicy(null)} />

      {!soldOut && (
        <div className={`sticky-buy${sticky ? ' show' : ''}`} aria-hidden={!sticky}>
          <div className="wrap">
            <div className="mph">{product.images[0] && <img src={getOptimizedImageUrl(product.images[0], { width: 120, quality: 60 })} alt="" />}</div>
            <div className="t">
              <b>{product.title}</b>
              <span className="num">{formatMoney(total, c.id)}</span>
            </div>
            <button className="btn" type="button" tabIndex={sticky ? 0 : -1}
              onClick={() => {
                formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => document.getElementById('o-name')?.focus({ preventScroll: true }), 450);
              }}>
              اطلب الآن
            </button>
          </div>
        </div>
      )}
    </>
  );
}
