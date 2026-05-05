create table if not exists public.global_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.global_admins enable row level security;

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.global_admins admin
    where admin.user_id = auth.uid()
  );
$$;

create or replace function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.tenant_members member
      where member.tenant_id = target_tenant_id
        and member.user_id = auth.uid()
    );
$$;

create or replace function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.tenant_members member
      where member.tenant_id = target_tenant_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    );
$$;

create or replace function public.is_tenant_operator(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.tenant_members member
      where member.tenant_id = target_tenant_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin', 'operator')
    );
$$;

create or replace function public.can_manage_assets()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_global_admin()
    or exists (
      select 1
      from public.tenant_members member
      where member.user_id = auth.uid()
        and member.role in ('owner', 'admin', 'operator')
    );
$$;

create policy "Global admins can read global admins"
on public.global_admins
for select
using (public.is_global_admin());

drop policy if exists "Tenant operators can manage assets" on public.assets;

create policy "Tenant operators can manage assets"
on public.assets
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Tenant operators can create activities" on public.activities;

create policy "Tenant operators can create activities"
on public.activities
for insert
with check (public.is_tenant_operator(tenant_id));
