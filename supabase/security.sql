-- Aliança Banhada — rate limit + tentativas de pagamento + frete grátis por produto
-- Execute no SQL Editor após commerce-integrations.sql

-- ========== Rate limits (só service role) ==========
create table if not exists public.security_rate_limits (
  bucket_key text primary key,
  hit_count integer not null default 0,
  window_starts_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;

-- Sem policies para anon/authenticated = ninguém acessa pelo client.
-- A API usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS).

create index if not exists security_rate_limits_locked_idx
  on public.security_rate_limits (locked_until)
  where locked_until is not null;

-- ========== Pedidos: contador de tentativas de pagamento ==========
alter table public.orders
  add column if not exists payment_attempt_count integer not null default 0,
  add column if not exists payment_last_attempt_at timestamptz;

-- ========== Produtos: frete grátis opcional ==========
alter table public.products
  add column if not exists free_shipping boolean not null default false;
