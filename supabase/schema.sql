-- Aliança Banhada — schema e-commerce
-- Cole e execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/lcbbsmgmdhxqsnwtlghu/sql/new

-- ========== PRODUCTS ==========
alter table public.products
  add column if not exists slug text;

update public.products set slug = id::text where slug is null;

-- ========== PROFILES ==========
alter table public.profiles
  add column if not exists is_admin boolean default false,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text;

-- ========== ORDERS ==========
alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists shipping_street text,
  add column if not exists shipping_number text,
  add column if not exists shipping_complement text,
  add column if not exists shipping_neighborhood text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists shipping_zip text,
  add column if not exists payment_method text default 'pix',
  add column if not exists payment_status text default 'pending',
  add column if not exists notes text,
  add column if not exists order_number text;

create sequence if not exists order_number_seq start 1001;

-- ========== ORDER ITEMS ==========
alter table public.order_items
  add column if not exists unit_price numeric(12,2),
  add column if not exists size text,
  add column if not exists product_name text;

-- ========== NEWSLETTER ==========
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- ========== CONTACT ==========
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  created_at timestamptz default now()
);

-- ========== CUSTOM ORDERS ==========
create table if not exists public.custom_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  email text not null,
  phone text,
  product_type text not null check (product_type in ('alianca', 'solitario')),
  material text not null check (material in ('Ouro banhado', 'Ouro')),
  size text,
  engraving text,
  description text not null,
  budget numeric(12,2),
  status text default 'novo',
  created_at timestamptz default now()
);

-- ========== PROFILE TRIGGER ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== HELPER ADMIN (evita recursão RLS) ==========
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ========== RLS ==========
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.custom_orders enable row level security;

-- Products: public read, admin write
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);

drop policy if exists "products_admin_all" on public.products;
create policy "products_admin_all" on public.products for all using (public.is_admin());

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (
  auth.uid() = id or public.is_admin()
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Orders
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select using (
  auth.uid() = user_id or public.is_admin()
);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders for insert with check (auth.uid() = user_id);

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders for update using (public.is_admin());

-- Order items
drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items for select using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items for insert with check (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);

-- Newsletter / contact / custom — anyone can insert
drop policy if exists "newsletter_insert" on public.newsletter_subscribers;
create policy "newsletter_insert" on public.newsletter_subscribers for insert with check (true);

drop policy if exists "newsletter_admin_read" on public.newsletter_subscribers;
create policy "newsletter_admin_read" on public.newsletter_subscribers for select using (public.is_admin());

drop policy if exists "contact_insert" on public.contact_messages;
create policy "contact_insert" on public.contact_messages for insert with check (true);

drop policy if exists "contact_admin_read" on public.contact_messages;
create policy "contact_admin_read" on public.contact_messages for select using (public.is_admin());

drop policy if exists "custom_insert" on public.custom_orders;
create policy "custom_insert" on public.custom_orders for insert with check (true);

drop policy if exists "custom_select" on public.custom_orders;
create policy "custom_select" on public.custom_orders for select using (
  auth.uid() = user_id or public.is_admin()
);

drop policy if exists "custom_admin_update" on public.custom_orders;
create policy "custom_admin_update" on public.custom_orders for update using (public.is_admin());


-- Seed materials: half solid gold
update public.products set material = 'Ouro'
where id in (
  '7d8a3306-b8a3-42d4-b29c-a28324aceff0',
  'd26cacd3-fde6-4451-be1a-0fd16a939d90',
  'c5078374-e2d7-4319-8d43-4ee3fbb10889'
);

update public.products set size_range = '12,13,14,15,16,17,18,19,20,21,22,23,24'
where size_range is null or size_range like '%P%' or size_range like '%M%';

-- Torne o admin padrão (conta já criada no Auth):
-- Arquivo completo: supabase/create-admin.sql
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'jaimegsantosj@gmail.com';

insert into public.profiles (id, email, full_name, is_admin)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', 'Jaime Santos'),
  true
from auth.users
where email = 'jaimegsantosj@gmail.com'
on conflict (id) do update
set
  is_admin = true,
  email = excluded.email,
  full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);
