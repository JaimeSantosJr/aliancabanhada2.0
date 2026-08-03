-- Confirma o email do admin e concede is_admin
-- Rode no SQL Editor: https://supabase.com/dashboard/project/lcbbsmgmdhxqsnwtlghu/sql/new

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
