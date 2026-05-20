-- Add async agent check-in queue and heartbeat telemetry

create table if not exists public.agent_checkin_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  device_id text not null,
  payload_type text not null default 'inventory_snapshot',
  payload jsonb not null,
  attempts int not null default 0,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  last_attempted_at timestamptz,
  processed_at timestamptz
);

create index if not exists agent_checkin_queue_tenant_id_idx on public.agent_checkin_queue(tenant_id);
create index if not exists agent_checkin_queue_device_id_idx on public.agent_checkin_queue(device_id);
create index if not exists agent_checkin_queue_status_idx on public.agent_checkin_queue(status);

alter table if exists public.agent_heartbeats
  add column if not exists collection_duration_ms int,
  add column if not exists telemetry_retry_count int,
  add column if not exists telemetry_memory_bytes bigint,
  add column if not exists telemetry_queue_depth int;

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
    hb.memory_usage_percent,
    hb.collection_duration_ms,
    hb.telemetry_retry_count,
    hb.telemetry_memory_bytes,
    hb.telemetry_queue_depth
  from public.agent_heartbeats hb;
