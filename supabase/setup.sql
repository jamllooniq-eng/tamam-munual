-- =============================================================================
-- تمام شوب - إعداد قاعدة البيانات (Supabase)
-- الصق هذا الملف كاملاً في: Supabase > SQL Editor > New query ثم اضغط Run
-- آمن للتشغيل أكثر من مرة (ما يمسح بياناتك).
-- =============================================================================

-- 1) المنتجات (تضاف من لوحة التحكم /admin)
create table if not exists public.products (
  id            bigint generated always as identity primary key,
  title         text        not null check (char_length(title) between 2 and 200),
  country       text        not null default 'IQ' check (country in ('IQ','SA','KW','AE','QA','BH','OM')),
  price         numeric     not null check (price > 0),
  old_price     numeric     check (old_price is null or old_price >= 0),
  category      text,
  description   text,
  features      jsonb       not null default '[]'::jsonb,
  images        jsonb       not null default '[]'::jsonb,
  stock         integer     check (stock is null or stock >= 0),
  sheet         smallint    not null default 1 check (sheet in (1, 2)),
  product_code  text,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists products_active_idx on public.products (is_active, created_at desc);

-- 2) إعدادات الدول (الشحن والشريط العلوي)
create table if not exists public.countries (
  id                text primary key check (id in ('IQ','SA','KW','AE','QA','BH','OM')),
  enabled           boolean not null default true,
  free_shipping     boolean not null default true,
  shipping_fee      numeric not null default 0 check (shipping_fee >= 0),
  free_over         numeric not null default 0 check (free_over >= 0),
  delivery_text     text    not null default '48 ساعة',
  banner            text,
  national_address  boolean not null default false,
  sort              smallint not null default 0,
  updated_at        timestamptz not null default now()
);

insert into public.countries (id, enabled, free_shipping, shipping_fee, free_over, delivery_text, banner, national_address, sort) values
  ('IQ', true, true, 5000, 0, '48 ساعة', 'توصيل مجاني للعراق خلال 48 ساعة · الدفع عند الاستلام', false, 1),
  ('SA', true, true, 25,   0, '48 ساعة', 'توصيل مجاني للسعودية خلال 48 ساعة · الدفع عند الاستلام', true, 2),
  ('KW', true, true, 2,    0, '48 ساعة', 'توصيل مجاني للكويت خلال 48 ساعة · الدفع عند الاستلام', false, 3),
  ('AE', true, true, 20,   0, '48 ساعة', 'توصيل مجاني للإمارات خلال 48 ساعة · الدفع عند الاستلام', false, 4),
  ('QA', true, true, 20,   0, '48 ساعة', 'توصيل مجاني لقطر خلال 48 ساعة · الدفع عند الاستلام', false, 5),
  ('BH', true, true, 2,    0, '48 ساعة', 'توصيل مجاني للبحرين خلال 48 ساعة · الدفع عند الاستلام', false, 6),
  ('OM', true, true, 2,    0, '48 ساعة', 'توصيل مجاني لعُمان خلال 48 ساعة · الدفع عند الاستلام', false, 7)
on conflict (id) do nothing;

-- 3) الطلبات (نسخة بلوحة التحكم، والطلب يروح كذلك للشيت وتلغرام)
create table if not exists public.orders (
  id                bigint generated always as identity primary key,
  order_no          text        not null unique,
  product_id        bigint,
  product_title     text        not null,
  product_code      text,
  country           text        not null,
  currency          text        not null,
  quantity          integer     not null default 1,
  unit_price        numeric     not null default 0,
  shipping          numeric     not null default 0,
  total             numeric     not null default 0,
  customer_name     text        not null,
  phone             text        not null,
  region            text,
  address           text,
  national_address  text,
  sheet             smallint    not null default 1,
  status            text        not null default 'new' check (status in ('new','confirmed','shipped','delivered','cancelled')),
  created_at        timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- 4) ذاكرة صغيرة (علامات التحديث)
create table if not exists public.cache_entries (
  key        text        primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

-- 5) إنقاص المخزون بعد كل طلب (بأمان، ما ينزل تحت الصفر)
create or replace function public.decrement_stock(pid bigint, qty integer)
returns void language sql security definer set search_path = public as $$
  update public.products
     set stock = greatest(stock - qty, 0), updated_at = now()
   where id = pid and stock is not null;
$$;

-- 6) الحماية: تفعيل RLS بدون أي صلاحيات عامة.
--    يعني لا أحد يقرأ أو يكتب من المتصفح؛ فقط سيرفر الموقع بالمفتاح السري.
alter table public.products      enable row level security;
alter table public.countries     enable row level security;
alter table public.orders        enable row level security;
alter table public.cache_entries enable row level security;

-- 7) مخزن صور المنتجات (قراءة عامة حتى تظهر الصور بالمتجر، والرفع من السيرفر فقط)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 8) صلاحيات المفتاح السري (مطلوبة في مشاريع Supabase الجديدة)
grant usage on schema public to service_role;
grant all on table public.products, public.countries, public.orders, public.cache_entries to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.decrement_stock(bigint, integer) to service_role;
revoke execute on function public.decrement_stock(bigint, integer) from public, anon, authenticated;
