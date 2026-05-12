create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'asset_status'
  ) then
    create type public.asset_status as enum (
      'Em uso',
      'Atencao',
      'Manutencao',
      'Estoque'
    );
  end if;

  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'asset_criticality'
  ) then
    create type public.asset_criticality as enum (
      'Baixa',
      'Media',
      'Alta'
    );
  end if;
end $$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text
);

alter table public.tenants add column if not exists slug text;
alter table public.tenants add column if not exists segment text;
alter table public.tenants add column if not exists compliance integer;
alter table public.tenants add column if not exists created_at timestamptz;
alter table public.tenants add column if not exists updated_at timestamptz;
alter table public.tenants add column if not exists cnpj text;
alter table public.tenants add column if not exists contact_name text;
alter table public.tenants add column if not exists contact_email text;
alter table public.tenants add column if not exists contact_phone text;
alter table public.tenants add column if not exists address_line text;
alter table public.tenants add column if not exists city text;
alter table public.tenants add column if not exists state text;
alter table public.tenants add column if not exists postal_code text;
alter table public.tenants add column if not exists logo_url text;
alter table public.tenants add column if not exists agent_api_key text;

update public.tenants
set
  name = coalesce(nullif(name, ''), 'Empresa ' || left(id::text, 8)),
  segment = coalesce(nullif(segment, ''), 'Sem segmento'),
  compliance = coalesce(compliance, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

update public.tenants
set slug = lower(
  trim(
    both '-' from regexp_replace(
      coalesce(nullif(slug, ''), name || '-' || left(id::text, 8)),
      '[^A-Za-z0-9]+',
      '-',
      'g'
    )
  )
)
where slug is null or slug = '';

alter table public.tenants alter column name set not null;
alter table public.tenants alter column slug set not null;
alter table public.tenants alter column segment set not null;
alter table public.tenants alter column compliance set default 0;
alter table public.tenants alter column compliance set not null;
alter table public.tenants alter column created_at set default now();
alter table public.tenants alter column created_at set not null;
alter table public.tenants alter column updated_at set default now();
alter table public.tenants alter column updated_at set not null;

create unique index if not exists tenants_slug_unique_idx on public.tenants(slug);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  tag text not null,
  type text not null,
  model text not null,
  owner text not null,
  location text not null,
  status public.asset_status not null default 'Estoque',
  criticality public.asset_criticality not null default 'Baixa',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, tag)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  title text not null,
  description text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.global_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.global_admins (user_id)
select auth_user.id
from auth.users auth_user
where auth_user.email = 'admin.global@inventario-ti.com'
on conflict (user_id) do nothing;

create index if not exists tenant_members_user_id_idx on public.tenant_members(user_id);
create index if not exists units_tenant_id_idx on public.units(tenant_id);
create index if not exists assets_tenant_id_updated_at_idx on public.assets(tenant_id, updated_at desc);
create index if not exists activities_tenant_id_occurred_at_idx on public.activities(tenant_id, occurred_at desc);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.units enable row level security;
alter table public.assets enable row level security;
alter table public.activities enable row level security;
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

create or replace function public.get_tenant_summaries()
returns table (
  tenant_id uuid,
  units bigint,
  assets bigint,
  pending bigint
)
language sql
stable
as $$
  select
    tenant.id as tenant_id,
    count(distinct unit.id) as units,
    count(distinct asset.id) as assets,
    count(distinct asset.id) filter (
      where asset.status in ('Atencao', 'Manutencao')
    ) as pending
  from public.tenants tenant
  left join public.units unit on unit.tenant_id = tenant.id
  left join public.assets asset on asset.tenant_id = tenant.id
  group by tenant.id;
$$;

drop policy if exists "Members can read their tenants" on public.tenants;
create policy "Members can read their tenants"
on public.tenants
for select
using (public.is_tenant_member(id));

drop policy if exists "Members can read memberships in their tenants" on public.tenant_members;
create policy "Members can read memberships in their tenants"
on public.tenant_members
for select
using (public.is_tenant_member(tenant_id));

drop policy if exists "Tenant admins can manage memberships" on public.tenant_members;
create policy "Tenant admins can manage memberships"
on public.tenant_members
for all
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

drop policy if exists "Members can read tenant units" on public.units;
create policy "Members can read tenant units"
on public.units
for select
using (public.is_tenant_member(tenant_id));

drop policy if exists "Tenant admins can manage units" on public.units;
create policy "Tenant admins can manage units"
on public.units
for all
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

drop policy if exists "Members can read tenant assets" on public.assets;
create policy "Members can read tenant assets"
on public.assets
for select
using (public.is_tenant_member(tenant_id));

drop policy if exists "Tenant operators can manage assets" on public.assets;
create policy "Tenant operators can manage assets"
on public.assets
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Members can read tenant activities" on public.activities;
create policy "Members can read tenant activities"
on public.activities
for select
using (public.is_tenant_member(tenant_id));

drop policy if exists "Tenant operators can create activities" on public.activities;
create policy "Tenant operators can create activities"
on public.activities
for insert
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Global admins can read global admins" on public.global_admins;
create policy "Global admins can read global admins"
on public.global_admins
for select
using (public.is_global_admin());

notify pgrst, 'reload schema';
