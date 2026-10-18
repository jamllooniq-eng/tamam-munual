import type { CountryId, CountrySettings } from './lib/countries';

/** A product as the storefront sees it (no internal fields like the sheet number). */
export interface Product {
  id: number;
  title: string;
  country: CountryId;
  price: number;
  old_price: number | null;
  category: string | null;
  description?: string | null;
  features?: string[];
  images: string[];
  /** null = not tracked (unlimited) */
  stock: number | null;
}

export type View = 'home' | 'product' | 'success' | '404' | 'unavailable';

export interface Route {
  view: View;
  productId?: number;
  category?: string;
  search?: string;
}

export interface PageData {
  route: Route;
  /** Settings of every enabled country */
  countries: CountrySettings[];
  products?: Product[];
  product?: Product | null;
  related?: Product[];
}

export interface OrderRequest {
  orderId?: string;
  item_id: number;
  count: number;
  cus_name: string;
  cus_num1: string;
  region: string;
  address: string;
  national_address?: string;
  fbc?: string;
  fbp?: string;
  ttp?: string;
  ttclid?: string;
  externalId?: string;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  error?: string;
  /** Which field the error belongs to (so the form can show it under that field) */
  field?: 'name' | 'phone' | 'region' | 'addr' | 'nat';
  duplicate?: boolean;
  total?: number;
}
