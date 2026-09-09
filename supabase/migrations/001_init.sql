create extension if not exists pgcrypto;

create table if not exists categories(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists products(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  sku text,
  category_id uuid references categories(id) on delete set null,
  price numeric(12,2) not null default 0 check(price >= 0),
  stock_quantity integer not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales(
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment_method text not null check(payment_method in ('cash','card','qr')),
  cash_received numeric(12,2),
  change_amount numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists sale_items(
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,
  quantity integer not null check(quantity > 0),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create table if not exists settings(
  id integer primary key default 1,
  store_name text not null default 'YN POS',
  currency text not null default 'USD',
  tax_enabled boolean not null default false,
  tax_percent numeric(5,2) not null default 10,
  sound boolean not null default true,
  vibration boolean not null default true,
  scanner_quality text not null default 'fast',
  theme text not null default 'dark',
  allow_negative_stock boolean not null default false
);

-- Safe to re-run against an existing database.
alter table sales add column if not exists cash_received numeric(12,2);
alter table sales add column if not exists change_amount numeric(12,2);

alter table products enable row level security;
alter table categories enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table settings enable row level security;

drop policy if exists "products public access" on products;
drop policy if exists "categories public access" on categories;
drop policy if exists "sales public access" on sales;
drop policy if exists "sale items public access" on sale_items;
drop policy if exists "settings public access" on settings;

-- This app is designed as a single-store POS without login.
-- These policies allow the browser anon key to read/write POS data.
-- If you add Supabase Auth later, replace these with authenticated-user policies.
create policy "products public access" on products for all to anon, authenticated using (true) with check (true);
create policy "categories public access" on categories for all to anon, authenticated using (true) with check (true);
create policy "sales public access" on sales for all to anon, authenticated using (true) with check (true);
create policy "sale items public access" on sale_items for all to anon, authenticated using (true) with check (true);
create policy "settings public access" on settings for all to anon, authenticated using (true) with check (true);

insert into settings(id) values(1) on conflict (id) do nothing;

create or replace function public.create_sale(
  p_subtotal numeric,
  p_discount numeric,
  p_tax numeric,
  p_total numeric,
  p_payment_method text,
  p_cash_received numeric,
  p_change_amount numeric,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid := gen_random_uuid();
  item jsonb;
  nextnum bigint;
  receipt text;
  allow_negative boolean;
  current_stock integer;
begin
  if p_payment_method not in ('cash','card','qr') then
    raise exception 'Invalid payment method';
  end if;

  select allow_negative_stock into allow_negative from settings where id = 1;

  -- Lock products while checking/decrementing stock so two checkouts
  -- cannot sell the same last unit at the same time.
  for item in select * from jsonb_array_elements(p_items)
  loop
    select stock_quantity into current_stock
    from products
    where id = (item->>'product_id')::uuid
      and is_active = true
    for update;

    if current_stock is null then
      raise exception 'Product not found';
    end if;

    if not allow_negative and current_stock < (item->>'quantity')::int then
      raise exception 'Insufficient stock';
    end if;
  end loop;

  -- Portable receipt-number allocation using an advisory lock.
  perform pg_advisory_xact_lock(hashtext('yn-pos-receipt-number'));
  select coalesce(max((regexp_match(receipt_number, '([0-9]+)$'))[1]::bigint), 0) + 1
    into nextnum
  from sales;
  receipt := '#YN-' || lpad(nextnum::text, 6, '0');

  insert into sales(
    id, receipt_number, subtotal, discount, tax, total,
    payment_method, cash_received, change_amount
  ) values (
    sid, receipt, p_subtotal, p_discount, p_tax, p_total,
    p_payment_method, p_cash_received, p_change_amount
  );

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into sale_items(
      sale_id, product_id, product_name, quantity, unit_price, line_total
    ) values (
      sid,
      (item->>'product_id')::uuid,
      item->>'product_name',
      (item->>'quantity')::int,
      (item->>'unit_price')::numeric,
      (item->>'line_total')::numeric
    );

    update products
    set stock_quantity = stock_quantity - (item->>'quantity')::int,
        updated_at = now()
    where id = (item->>'product_id')::uuid;
  end loop;

  return sid;
end;
$$;

revoke all on function public.create_sale(numeric,numeric,numeric,numeric,text,numeric,numeric,jsonb) from public;
grant execute on function public.create_sale(numeric,numeric,numeric,numeric,text,numeric,numeric,jsonb) to anon, authenticated;
