-- Agent Heartbeats table for lightweight periodic check-ins
-- Separates from heavy inventory updates for real-time agent status

create table if not exists public.agent_heartbeats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  device_id text not null,
  hostname text not null,
  ip_address text,
  status text not null default 'online',
  uptime_seconds bigint,
  cpu_usage_percent numeric(5,2),
  memory_usage_percent numeric(5,2),
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast queries
create index if not exists agent_heartbeats_tenant_id_idx on public.agent_heartbeats(tenant_id);
create index if not exists agent_heartbeats_asset_id_idx on public.agent_heartbeats(asset_id);
create index if not exists agent_heartbeats_device_id_idx on public.agent_heartbeats(device_id);
create index if not exists agent_heartbeats_updated_at_idx on public.agent_heartbeats(updated_at desc);

-- RLS for heartbeats (same as assets)
alter table public.agent_heartbeats enable row level security;

create policy "Members can read agent heartbeats"
on public.agent_heartbeats
for select
using (public.is_tenant_member(tenant_id));

create policy "Agents can insert heartbeats"
on public.agent_heartbeats
for insert
with check (tenant_id is not null);

create policy "Agents can update their heartbeats"
on public.agent_heartbeats
for update
using (tenant_id is not null)
with check (tenant_id is not null);

-- Helper function to get agent online status
create or replace function public.get_agent_status(device_id_param text, tenant_id_param uuid, heartbeat_threshold_minutes int default 10)
returns table (
  status text,
  last_heartbeat timestamptz,
  minutes_since_heartbeat int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when hb.last_heartbeat_at > now() - (heartbeat_threshold_minutes || ' minutes')::interval then 'online'
      else 'offline'
    end as status,
    hb.last_heartbeat_at,
    extract(epoch from (now() - hb.last_heartbeat_at))::int / 60 as minutes_since_heartbeat
  from public.agent_heartbeats hb
  where hb.device_id = device_id_param
    and hb.tenant_id = tenant_id_param
  order by hb.updated_at desc
  limit 1;
$$;

-- View for agent status summary
create or replace view public.agent_status_summary as
  select
    hb.tenant_id,
    hb.asset_id,
    hb.device_id,
    hb.hostname,
    case
      when hb.last_heartbeat_at > now() - interval '10 minutes' then 'online'
      when hb.last_heartbeat_at > now() - interval '1 hour' then 'idle'
      else 'offline'
    end as status,
    hb.last_heartbeat_at,
    extract(epoch from (now() - hb.last_heartbeat_at))::int / 60 as minutes_since_heartbeat,
    hb.cpu_usage_percent,
    hb.memory_usage_percent
  from public.agent_heartbeats hb;
