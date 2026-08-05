-- Aliança Banhada — hardening + operação
-- Execute no SQL Editor após schema.sql
-- https://supabase.com/dashboard/project/lcbbsmgmdhxqsnwtlghu/sql/new

-- ========== ORDERS: frete + rastreio ==========
alter table public.orders
  add column if not exists shipping_cost numeric(12,2) default 0,
  add column if not exists tracking_code text,
  add column if not exists subtotal numeric(12,2);

-- ========== CONTACT: lido ==========
alter table public.contact_messages
  add column if not exists is_read boolean default false;

-- ========== PRODUCTS: estoque numérico opcional ==========
alter table public.products
  add column if not exists stock_qty integer;

-- ========== Travar is_admin ==========
-- Usuário comum pode atualizar o próprio perfil, MAS não pode alterar is_admin.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
  );

-- Só admin (via security definer) promove outro admin — use SQL manual:
-- update public.profiles set is_admin = true where email = '...';

-- ========== Storage: imagens de produtos ==========
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ========== Número de pedido sequencial ==========
create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  n := nextval('order_number_seq');
  return 'AB-' || lpad(n::text, 6, '0');
end;
$$;

-- ========== Baixa de estoque (boolean) ==========
create or replace function public.mark_products_sold(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set in_stock = false,
      stock_qty = case when stock_qty is null then null else greatest(stock_qty - 1, 0) end
  where id = any(p_ids)
    and coalesce(stock_qty, 1) <= 1;
end;
$$;

-- Admin pode atualizar mensagens (marcar lida)
drop policy if exists "contact_admin_update" on public.contact_messages;
create policy "contact_admin_update" on public.contact_messages
  for update using (public.is_admin());

-- Custom orders: insert sem forjar user_id de terceiros
drop policy if exists "custom_insert" on public.custom_orders;
create policy "custom_insert" on public.custom_orders
  for insert with check (
    user_id is null or user_id = auth.uid()
  );
