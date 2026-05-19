-- Repair tenant_id on tables that may have been created by older partial migrations.
-- Run this before 008_complete_tenant_rls.sql if the RLS preflight reports missing tenant_id.

alter table public.agent_heartbeats
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.agent_heartbeats
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_heartbeat_at timestamptz not null default now();

update public.agent_heartbeats heartbeat
set tenant_id = asset.tenant_id
from public.assets asset
where heartbeat.tenant_id is null
  and heartbeat.asset_id = asset.id;

do $$
begin
  if exists (select 1 from public.agent_heartbeats where tenant_id is null) then
    raise exception
      'Cannot make agent_heartbeats.tenant_id NOT NULL: rows remain without tenant. Link or remove orphan heartbeats first.';
  end if;
end $$;

alter table public.agent_heartbeats
  alter column tenant_id set not null;

create index if not exists agent_heartbeats_tenant_id_idx
  on public.agent_heartbeats(tenant_id);

alter table public.hardware_history
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.hardware_history
  add column if not exists observed_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists source text not null default 'agent',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.hardware_history history
set tenant_id = asset.tenant_id
from public.assets asset
where history.tenant_id is null
  and history.asset_id = asset.id;

do $$
begin
  if exists (select 1 from public.hardware_history where tenant_id is null) then
    raise exception
      'Cannot make hardware_history.tenant_id NOT NULL: rows remain without tenant. Link or remove orphan history rows first.';
  end if;
end $$;

alter table public.hardware_history
  alter column tenant_id set not null;

create index if not exists hardware_history_tenant_observed_idx
  on public.hardware_history(tenant_id, observed_at desc);

alter table public.software_inventory
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

alter table public.software_inventory
  add column if not exists version text not null default '',
  add column if not exists publisher text not null default '',
  add column if not exists first_seen timestamptz not null default now(),
  add column if not exists last_seen timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'asset_software'
      and column_name = 'software_inventory_id'
  ) then
    update public.software_inventory software
    set tenant_id = linked.tenant_id
    from (
      select
        asset_software.software_inventory_id,
        min(asset.tenant_id) as tenant_id,
        count(distinct asset.tenant_id) as tenant_count
      from public.asset_software asset_software
      join public.assets asset on asset.id = asset_software.asset_id
      group by asset_software.software_inventory_id
    ) linked
    where software.tenant_id is null
      and software.id = linked.software_inventory_id
      and linked.tenant_count = 1;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.software_inventory software
    where software.tenant_id is null
  ) then
    raise exception
      'Cannot make software_inventory.tenant_id NOT NULL: rows remain without a single tenant. Remove orphan/global software rows or split multi-tenant rows first.';
  end if;
end $$;

alter table public.software_inventory
  alter column tenant_id set not null;

create index if not exists software_inventory_tenant_id_idx
  on public.software_inventory(tenant_id);

drop index if exists software_inventory_unique_idx;
create unique index if not exists software_inventory_unique_idx
  on public.software_inventory(tenant_id, name, version, publisher);

notify pgrst, 'reload schema';
