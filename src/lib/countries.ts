/**
 * Countries the store sells to. Static facts live here (currency, phone format, regions);
 * the editable part (shipping, banner, delivery time, on/off) lives in the `countries` table
 * and is edited from the dashboard.
 */

export type CountryId = 'IQ' | 'SA' | 'KW' | 'AE' | 'QA' | 'BH' | 'OM';

export interface CountryInfo {
  id: CountryId;
  name: string;
  /** "للعراق" — used in sentences like "توصيل مجاني للعراق" */
  to: string;
  /** "كل محافظات العراق" */
  everywhere: string;
  currency: string; // ISO code
  currencyName: string;
  symbol: string;
  decimals: 0 | 3;
  dial: string; // country calling code without +
  phonePlaceholder: string;
  phonePattern: RegExp;
  phoneHint: string;
  regionLabel: string;
  regions: string[];
  /** 1 USD = usdRate units of this currency (fixed pegs; IQ is overridden by IQD_TO_USD_RATE) */
  usdRate: number;
}

export const COUNTRY_LIST: CountryInfo[] = [
  {
    id: 'IQ', name: 'العراق', to: 'للعراق', everywhere: 'كل محافظات العراق',
    currency: 'IQD', currencyName: 'دينار عراقي', symbol: 'د.ع', decimals: 0,
    dial: '964', phonePlaceholder: '07XX XXX XXXX', phonePattern: /^07\d{9}$/, phoneHint: '11 رقم يبدأ بـ 07',
    regionLabel: 'المحافظة',
    regions: ['بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'بابل', 'ذي قار', 'الأنبار', 'ديالى', 'كركوك', 'واسط', 'ميسان', 'المثنى', 'الديوانية', 'صلاح الدين', 'دهوك', 'السليمانية', 'حلبجة'],
    usdRate: 1400,
  },
  {
    id: 'SA', name: 'السعودية', to: 'للسعودية', everywhere: 'كل مدن السعودية',
    currency: 'SAR', currencyName: 'ريال سعودي', symbol: 'ر.س', decimals: 0,
    dial: '966', phonePlaceholder: '05X XXX XXXX', phonePattern: /^05\d{8}$/, phoneHint: '10 أرقام يبدأ بـ 05',
    regionLabel: 'المدينة',
    regions: ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الأحساء', 'الطائف', 'بريدة', 'تبوك', 'أبها', 'خميس مشيط', 'حائل', 'جازان', 'نجران', 'ينبع', 'الجبيل', 'القطيف', 'حفر الباطن', 'مدينة أخرى'],
    usdRate: 3.75,
  },
  {
    id: 'KW', name: 'الكويت', to: 'للكويت', everywhere: 'كل محافظات الكويت',
    currency: 'KWD', currencyName: 'دينار كويتي', symbol: 'د.ك', decimals: 3,
    dial: '965', phonePlaceholder: '5XXX XXXX', phonePattern: /^[569]\d{7}$/, phoneHint: '8 أرقام يبدأ بـ 5 أو 6 أو 9',
    regionLabel: 'المحافظة',
    regions: ['العاصمة', 'حولي', 'الفروانية', 'الأحمدي', 'الجهراء', 'مبارك الكبير'],
    usdRate: 0.307,
  },
  {
    id: 'AE', name: 'الإمارات', to: 'للإمارات', everywhere: 'كل الإمارات',
    currency: 'AED', currencyName: 'درهم إماراتي', symbol: 'د.إ', decimals: 0,
    dial: '971', phonePlaceholder: '05X XXX XXXX', phonePattern: /^05\d{8}$/, phoneHint: '10 أرقام يبدأ بـ 05',
    regionLabel: 'الإمارة',
    regions: ['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة'],
    usdRate: 3.6725,
  },
  {
    id: 'QA', name: 'قطر', to: 'لقطر', everywhere: 'كل قطر',
    currency: 'QAR', currencyName: 'ريال قطري', symbol: 'ر.ق', decimals: 0,
    dial: '974', phonePlaceholder: '3XXX XXXX', phonePattern: /^[3567]\d{7}$/, phoneHint: '8 أرقام يبدأ بـ 3 أو 5 أو 6 أو 7',
    regionLabel: 'البلدية',
    regions: ['الدوحة', 'الريان', 'الوكرة', 'الخور', 'أم صلال', 'الضعاين', 'الشمال', 'الشيحانية'],
    usdRate: 3.64,
  },
  {
    id: 'BH', name: 'البحرين', to: 'للبحرين', everywhere: 'كل البحرين',
    currency: 'BHD', currencyName: 'دينار بحريني', symbol: 'د.ب', decimals: 3,
    dial: '973', phonePlaceholder: '3XXX XXXX', phonePattern: /^[369]\d{7}$/, phoneHint: '8 أرقام يبدأ بـ 3 أو 6 أو 9',
    regionLabel: 'المحافظة',
    regions: ['العاصمة', 'المحرق', 'الشمالية', 'الجنوبية'],
    usdRate: 0.376,
  },
  {
    id: 'OM', name: 'عُمان', to: 'لعُمان', everywhere: 'كل محافظات عُمان',
    currency: 'OMR', currencyName: 'ريال عماني', symbol: 'ر.ع', decimals: 3,
    dial: '968', phonePlaceholder: '9XXX XXXX', phonePattern: /^[79]\d{7}$/, phoneHint: '8 أرقام يبدأ بـ 9 أو 7',
    regionLabel: 'المحافظة',
    regions: ['مسقط', 'ظفار', 'شمال الباطنة', 'جنوب الباطنة', 'الداخلية', 'الظاهرة', 'شمال الشرقية', 'جنوب الشرقية', 'البريمي', 'الوسطى', 'مسندم'],
    usdRate: 0.3845,
  },
];

export const COUNTRY_IDS = COUNTRY_LIST.map((c) => c.id);

export function getCountry(id: string | null | undefined): CountryInfo {
  return COUNTRY_LIST.find((c) => c.id === id) || COUNTRY_LIST[0];
}

export function isCountryId(id: unknown): id is CountryId {
  return typeof id === 'string' && (COUNTRY_IDS as string[]).includes(id);
}

/** Editable per-country settings (table `countries`). */
export interface CountrySettings {
  id: CountryId;
  enabled: boolean;
  free_shipping: boolean;
  shipping_fee: number;
  free_over: number;
  delivery_text: string;
  banner: string | null;
  national_address: boolean;
}

export function defaultSettings(id: CountryId): CountrySettings {
  const c = getCountry(id);
  return {
    id,
    enabled: true,
    free_shipping: true,
    shipping_fee: 0,
    free_over: 0,
    delivery_text: '48 ساعة',
    banner: `توصيل مجاني ${c.to} خلال 48 ساعة · الدفع عند الاستلام`,
    national_address: id === 'SA',
  };
}

/** Round an amount to the currency's precision. */
export function roundMoney(value: number, id: string): number {
  const c = getCountry(id);
  const f = c.decimals === 3 ? 1000 : 1;
  return Math.round((Number(value) || 0) * f) / f;
}

/** "35,000 د.ع" / "12.500 د.ك" */
export function formatMoney(value: number, id: string): string {
  const c = getCountry(id);
  const n = Number(value) || 0;
  const s =
    c.decimals === 3
      ? n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
      : Math.round(n).toLocaleString('en-US');
  return `${s} ${c.symbol}`;
}

/** Shipping cost for a subtotal under a country's settings. */
export function shippingCost(subtotal: number, s: CountrySettings | undefined): number {
  if (!s || s.free_shipping) return 0;
  if (s.free_over > 0 && subtotal >= s.free_over) return 0;
  return Number(s.shipping_fee) || 0;
}

/** Amount in USD (for Meta / TikTok, which want one currency). */
export function toUsd(value: number, id: string, iqdRate?: number): number {
  const c = getCountry(id);
  const rate = c.id === 'IQ' && iqdRate ? iqdRate : c.usdRate;
  return Number(((Number(value) || 0) / rate).toFixed(2));
}

// ---------------------------------------------------------------------------
// Phone numbers
// ---------------------------------------------------------------------------

const EASTERN: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/** Arabic/Persian digits -> 0-9, and strip spaces, dashes, + and brackets. */
export function normalizeDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩۰-۹]/g, (ch) => EASTERN[ch] || ch)
    .replace(/[^\d]/g, '');
}

/**
 * Bring a typed number to the country's local format (what the pattern checks), accepting the
 * common ways people type it: with the country code (+964 / 00964), or without the leading 0.
 */
export function normalizePhone(raw: string, id: string): string {
  const c = getCountry(id);
  let d = normalizeDigits(raw);
  if (d.startsWith('00' + c.dial)) d = d.slice(2 + c.dial.length);
  else if (d.startsWith(c.dial) && d.length > c.dial.length + 7) d = d.slice(c.dial.length);
  // Countries whose local format starts with 0
  if ((c.id === 'IQ' || c.id === 'SA' || c.id === 'AE') && !d.startsWith('0') && d.length >= 9) d = '0' + d;
  return d;
}

export function validatePhone(raw: string, id: string): { ok: boolean; phone: string; error?: string } {
  const c = getCountry(id);
  const phone = normalizePhone(raw, id);
  if (!phone) return { ok: false, phone, error: 'اكتب رقم الهاتف' };
  if (!c.phonePattern.test(phone)) return { ok: false, phone, error: `الرقم غير صحيح. المطلوب: ${c.phoneHint}` };
  return { ok: true, phone };
}

/** International digits without + (e.g. 9647701234567) for Meta / TikTok matching. */
export function toE164Digits(localPhone: string, id: string): string {
  const c = getCountry(id);
  const d = normalizeDigits(localPhone).replace(/^0+/, '');
  return d ? `${c.dial}${d}` : '';
}
