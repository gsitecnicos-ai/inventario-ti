create type public.hardware_history_event as enum (
  'initial_snapshot',
  'ram_upgrade',
  'storage_change',
  'os_change'
);

create table if not exists public.hardware_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  event_type public.hardware_history_event not null,
  hardware_key text not null check (hardware_key in ('ram', 'storage', 'os')),
  old_value text,
  new_value text not null,
  source text not null default 'agent',
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists hardware_history_tenant_observed_idx
  on public.hardware_history(tenant_id, observed_at desc);

create index if not exists hardware_history_asset_observed_idx
  on public.hardware_history(asset_id, observed_at desc);

create index if not exists hardware_history_asset_key_observed_idx
  on public.hardware_history(asset_id, hardware_key, observed_at desc);

alter table public.hardware_history enable row level security;

create policy "Members can read hardware history"
on public.hardware_history
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage hardware history"
on public.hardware_history
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));
