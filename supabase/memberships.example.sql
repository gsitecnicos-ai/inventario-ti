-- Replace the email and tenant slug, then run after the user signs up.
-- Use supabase/global-admin.example.sql for a user that must access all tenants.
insert into public.tenant_members (tenant_id, user_id, role)
select tenant.id, auth_user.id, 'owner'
from public.tenants tenant
join auth.users auth_user on auth_user.email = 'usuario@empresa.com'
where tenant.slug = 'aurora'
on conflict (tenant_id, user_id) do update
set role = excluded.role;
