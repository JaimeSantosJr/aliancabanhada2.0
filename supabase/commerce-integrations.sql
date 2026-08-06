-- Aliança Banhada — cupons, frete cotado e Mercado Pago
-- Execute no SQL Editor após hardening.sql

-- ========== ORDERS: cupom / frete / MP ==========
alter table public.orders
  add column if not exists coupon_code text,
  add column if not exists discount_amount numeric(12,2) default 0,
  add column if not exists shipping_service_id text,
  add column if not exists shipping_service_name text,
  add column if not exists shipping_company text,
  add column if not exists shipping_delivery_days integer,
  add column if not exists mp_preference_id text,
  add column if not exists mp_payment_id text,
  add column if not exists mp_status text,
  add column if not exists mp_init_point text;

-- Normaliza as constraints antigas para os status usados pelo app.
-- O schema inicial de alguns projetos aceitava outros nomes e rejeitava "pending".
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refunded'));

-- Compatibilidade com schema antigo que exige price_at_purchase
alter table public.order_items
  add column if not exists price_at_purchase numeric(12,2),
  add column if not exists unit_price numeric(12,2);

-- ========== COUPONS ==========
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_subtotal numeric(12,2) not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_code_unique unique (code)
);

create index if not exists coupons_code_idx on public.coupons (lower(code));

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id),
  discount_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint coupon_redemptions_order_unique unique (order_id),
  constraint coupon_redemptions_coupon_order unique (coupon_id, order_id)
);

-- ========== RLS ==========
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "coupons_admin_all" on public.coupons;
create policy "coupons_admin_all" on public.coupons
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "coupon_redemptions_admin_all" on public.coupon_redemptions;
create policy "coupon_redemptions_admin_all" on public.coupon_redemptions
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "coupon_redemptions_own_select" on public.coupon_redemptions;
create policy "coupon_redemptions_own_select" on public.coupon_redemptions
  for select
  using (auth.uid() = user_id);

-- ========== Incremento atômico de uso ==========
create or replace function public.redeem_coupon(
  p_coupon_id uuid,
  p_order_id uuid,
  p_user_id uuid,
  p_discount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.coupons%rowtype;
begin
  select * into c from public.coupons where id = p_coupon_id for update;
  if not found then
    return false;
  end if;
  if not c.is_active then
    return false;
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return false;
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return false;
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return false;
  end if;

  if exists (select 1 from public.coupon_redemptions where order_id = p_order_id) then
    return true;
  end if;

  insert into public.coupon_redemptions (coupon_id, order_id, user_id, discount_amount)
  values (p_coupon_id, p_order_id, p_user_id, p_discount);

  update public.coupons
  set used_count = used_count + 1
  where id = p_coupon_id;

  return true;
end;
$$;
