-- Add last_seen_at to agent heartbeats and use it to compute online/offline status

alter table if exists public.agent_heartbeats
  add column if not exists last_seen_at timestamptz not null default now();

update public.agent_heartbeats
set last_seen_at = last_heartbeat_at
where last_seen_at is null
  and last_heartbeat_at is not null;

create index if not exists agent_heartbeats_last_seen_at_idx on public.agent_heartbeats(last_seen_at desc);

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
      when coalesce(hb.last_seen_at, hb.last_heartbeat_at) > now() - (heartbeat_threshold_minutes || ' minutes')::interval then 'online'
      else 'offline'
    end as status,
    coalesce(hb.last_seen_at, hb.last_heartbeat_at) as last_heartbeat,
    extract(epoch from (now() - coalesce(hb.last_seen_at, hb.last_heartbeat_at)))::int / 60 as minutes_since_heartbeat
  from public.agent_heartbeats hb
  where hb.device_id = device_id_param
    and hb.tenant_id = tenant_id_param
  order by hb.updated_at desc
  limit 1;
$$;

create or replace view public.agent_status_summary as
select
  hb.tenant_id,
  hb.asset_id,
  hb.device_id,
  hb.hostname,
  case
    when coalesce(hb.last_seen_at, hb.last_heartbeat_at) > now() - interval '10 minutes' then 'online'
    when coalesce(hb.last_seen_at, hb.last_heartbeat_at) > now() - interval '1 hour' then 'idle'
    else 'offline'
  end as status,
  coalesce(hb.last_seen_at, hb.last_heartbeat_at) as last_seen_at,
  extract(epoch from (now() - coalesce(hb.last_seen_at, hb.last_heartbeat_at)))::int / 60 as minutes_since_heartbeat,
  hb.cpu_usage_percent,
  hb.memory_usage_percent
from public.agent_heartbeats hb;
