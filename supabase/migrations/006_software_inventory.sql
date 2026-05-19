-- Software inventory catalog and asset-to-software relation
-- Separates software metadata from asset install relationships.

create table if not exists public.software_inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  version text not null default '',
  publisher text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists software_inventory_unique_idx
  on public.software_inventory(tenant_id, name, version, publisher);

create table if not exists public.asset_software (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  software_inventory_id uuid not null references public.software_inventory(id) on delete cascade,
  installed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists asset_software_unique_idx
  on public.asset_software(asset_id, software_inventory_id);

create index if not exists software_inventory_tenant_id_idx on public.software_inventory(tenant_id);
create index if not exists asset_software_asset_id_idx on public.asset_software(asset_id);
create index if not exists asset_software_software_inventory_id_idx on public.asset_software(software_inventory_id);

alter table public.software_inventory enable row level security;
alter table public.asset_software enable row level security;

create policy "Members can read software inventory"
on public.software_inventory
for select
using (public.is_tenant_member(tenant_id));

create policy "Members can read asset software"
on public.asset_software
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage software inventory"
on public.software_inventory
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

create policy "Tenant operators can manage asset software"
on public.asset_software
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));
