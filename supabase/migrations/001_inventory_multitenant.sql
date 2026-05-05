create extension if not exists pgcrypto;

create type public.asset_status as enum (
  'Em uso',
  'Atencao',
  'Manutencao',
  'Estoque'
);

create type public.asset_criticality as enum (
  'Baixa',
  'Media',
  'Alta'
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  segment text not null,
  compliance integer not null default 0 check (compliance between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  city text,
  created_at timestamptz not null default now()
);

create table public.assets (
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

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  title text not null,
  description text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index tenant_members_user_id_idx on public.tenant_members(user_id);
create index units_tenant_id_idx on public.units(tenant_id);
create index assets_tenant_id_updated_at_idx on public.assets(tenant_id, updated_at desc);
create index activities_tenant_id_occurred_at_idx on public.activities(tenant_id, occurred_at desc);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.units enable row level security;
alter table public.assets enable row level security;
alter table public.activities enable row level security;

create function public.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members member
    where member.tenant_id = target_tenant_id
      and member.user_id = auth.uid()
  );
$$;

create function public.is_tenant_admin(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members member
    where member.tenant_id = target_tenant_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  );
$$;

create policy "Members can read their tenants"
on public.tenants
for select
using (public.is_tenant_member(id));

create policy "Members can read memberships in their tenants"
on public.tenant_members
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage memberships"
on public.tenant_members
for all
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "Members can read tenant units"
on public.units
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage units"
on public.units
for all
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

create policy "Members can read tenant assets"
on public.assets
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage assets"
on public.assets
for all
using (
  exists (
    select 1
    from public.tenant_members member
    where member.tenant_id = assets.tenant_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin', 'operator')
  )
)
with check (
  exists (
    select 1
    from public.tenant_members member
    where member.tenant_id = assets.tenant_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin', 'operator')
  )
);

create policy "Members can read tenant activities"
on public.activities
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can create activities"
on public.activities
for insert
with check (
  exists (
    select 1
    from public.tenant_members member
    where member.tenant_id = activities.tenant_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin', 'operator')
  )
);

create function public.get_tenant_summaries()
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
