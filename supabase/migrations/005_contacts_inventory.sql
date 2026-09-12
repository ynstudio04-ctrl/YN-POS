-- YN POS: contacts and stock adjustments
create table if not exists customers(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists suppliers(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists employees(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  role text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists stock_movements(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null check(quantity <> 0),
  reason text,
  created_at timestamptz not null default now()
);
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table employees enable row level security;
alter table stock_movements enable row level security;
drop policy if exists "customers public access" on customers;
drop policy if exists "suppliers public access" on suppliers;
drop policy if exists "employees public access" on employees;
drop policy if exists "stock movements public access" on stock_movements;
create policy "customers public access" on customers for all to anon, authenticated using (true) with check (true);
create policy "suppliers public access" on suppliers for all to anon, authenticated using (true) with check (true);
create policy "employees public access" on employees for all to anon, authenticated using (true) with check (true);
create policy "stock movements public access" on stock_movements for all to anon, authenticated using (true) with check (true);

create or replace function public.adjust_stock(p_product_id uuid, p_quantity integer, p_reason text default 'Manual stock adjustment')
returns products
language plpgsql
security definer
set search_path = public
as $$
declare result products;
begin
  if p_quantity = 0 then raise exception 'Stock quantity cannot be zero'; end if;
  update products set stock_quantity = stock_quantity + p_quantity, updated_at = now()
  where id = p_product_id and is_active = true
  returning * into result;
  if result.id is null then raise exception 'Product not found'; end if;
  if result.stock_quantity < 0 then raise exception 'Stock cannot go below zero'; end if;
  insert into stock_movements(product_id,quantity,reason) values(p_product_id,p_quantity,nullif(trim(p_reason),''));
  return result;
end;
$$;
revoke all on function public.adjust_stock(uuid,integer,text) from public;
grant execute on function public.adjust_stock(uuid,integer,text) to anon, authenticated;
