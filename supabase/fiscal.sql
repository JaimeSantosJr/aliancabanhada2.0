-- Alianca Banhada — campos fiscais / NF-e (rode apos security.sql)
-- Depois preencha env STORE_* / NEXT_PUBLIC_STORE_* e NFE_PROVIDER

alter table public.orders
  add column if not exists customer_document text,
  add column if not exists nfe_status text,
  add column if not exists nfe_number text,
  add column if not exists nfe_access_key text,
  add column if not exists nfe_pdf_url text,
  add column if not exists nfe_xml_url text,
  add column if not exists nfe_issued_at timestamptz,
  add column if not exists nfe_error text;

alter table public.profiles
  add column if not exists document text;

comment on column public.orders.customer_document is 'CPF ou CNPJ do comprador para NF-e';
comment on column public.orders.nfe_status is 'none | pending | issued | error | cancelled';
