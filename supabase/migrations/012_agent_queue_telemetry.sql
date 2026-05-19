-- Fila de processamento assíncrono de inventário do agente e armazenamento de telemetria

create table if not exists public.agent_inventory_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  device_id text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_inventory_jobs_tenant_id_idx on public.agent_inventory_jobs(tenant_id);
create index if not exists agent_inventory_jobs_status_idx on public.agent_inventory_jobs(status);
create index if not exists agent_inventory_jobs_created_at_idx on public.agent_inventory_jobs(created_at desc);

alter table public.agent_inventory_jobs enable row level security;

create policy "Members can read agent inventory jobs"
  on public.agent_inventory_jobs
  for select
  using (public.is_tenant_member(tenant_id));

create policy "System can insert agent inventory jobs"
  on public.agent_inventory_jobs
  for insert
  with check (tenant_id is not null);

create policy "System can update agent inventory jobs"
  on public.agent_inventory_jobs
  for update
  using (tenant_id is not null)
  with check (tenant_id is not null);

create table if not exists public.agent_telemetry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  device_id text not null,
  hostname text,
  payload_type text not null,
  data jsonb not null,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_telemetry_tenant_id_idx on public.agent_telemetry(tenant_id);
create index if not exists agent_telemetry_asset_id_idx on public.agent_telemetry(asset_id);
create index if not exists agent_telemetry_payload_type_idx on public.agent_telemetry(payload_type);
create index if not exists agent_telemetry_collected_at_idx on public.agent_telemetry(collected_at desc);

alter table public.agent_telemetry enable row level security;

create policy "Members can read agent telemetry"
  on public.agent_telemetry
  for select
  using (public.is_tenant_member(tenant_id));

create policy "System can insert agent telemetry"
  on public.agent_telemetry
  for insert
  with check (tenant_id is not null);
