-- Alertas automáticos, regras de compliance e status de conformidade

-- Tabela de alertas automáticos
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  alert_type text not null, -- 'disk_full', 'av_disabled', 'agent_offline', 'agent_outdated', 'compliance_violation'
  severity text not null default 'medium', -- 'low', 'medium', 'high', 'critical'
  title text not null,
  description text,
  device_id text,
  hostname text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists alerts_tenant_id_idx on public.alerts(tenant_id);
create index if not exists alerts_asset_id_idx on public.alerts(asset_id);
create index if not exists alerts_alert_type_idx on public.alerts(alert_type);
create index if not exists alerts_severity_idx on public.alerts(severity);
create index if not exists alerts_resolved_at_idx on public.alerts(resolved_at);
create index if not exists alerts_detected_at_idx on public.alerts(detected_at desc);

alter table public.alerts enable row level security;

create policy "Members can read alerts"
on public.alerts
for select
using (public.is_tenant_member(tenant_id));

create policy "Agents can insert alerts"
on public.alerts
for insert
with check (tenant_id is not null);

-- Tabela de regras de compliance
create table if not exists public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_type text not null, -- 'forbidden_software', 'required_av', 'min_windows_version', 'disk_threshold', 'uptime_check'
  name text not null,
  description text,
  enabled boolean default true,
  severity text not null default 'medium',
  parameters jsonb, -- { "software_name": "xyz", "min_version": "1.0", "threshold_percent": 80 }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_rules_tenant_id_idx on public.compliance_rules(tenant_id);
create index if not exists compliance_rules_rule_type_idx on public.compliance_rules(rule_type);
create index if not exists compliance_rules_enabled_idx on public.compliance_rules(enabled);

alter table public.compliance_rules enable row level security;

create policy "Members can read compliance_rules"
on public.compliance_rules
for select
using (public.is_tenant_member(tenant_id));

create policy "Admins can manage compliance_rules"
on public.compliance_rules
for all
using (public.is_tenant_member(tenant_id))
with check (public.is_tenant_member(tenant_id));

-- Tabela de status de compliance por asset
create table if not exists public.device_compliance_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  compliance_score numeric(5,2) not null default 100.0, -- 0-100
  violations_count int default 0,
  critical_violations int default 0,
  has_antivirus boolean default false,
  windows_updated boolean default null,
  forbidden_software_found text[], -- Array de softwares proibidos encontrados
  last_check_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_compliance_status_tenant_id_idx on public.device_compliance_status(tenant_id);
create index if not exists device_compliance_status_asset_id_idx on public.device_compliance_status(asset_id);
create index if not exists device_compliance_status_compliance_score_idx on public.device_compliance_status(compliance_score);
create index if not exists device_compliance_status_last_check_at_idx on public.device_compliance_status(last_check_at desc);

alter table public.device_compliance_status enable row level security;

create policy "Members can read device_compliance_status"
on public.device_compliance_status
for select
using (public.is_tenant_member(tenant_id));

create policy "System can upsert device_compliance_status"
on public.device_compliance_status
for insert
with check (tenant_id is not null);

-- Helper function para gerar alerta
create or replace function public.create_alert(
  p_tenant_id uuid,
  p_asset_id uuid,
  p_alert_type text,
  p_severity text,
  p_title text,
  p_description text default null,
  p_device_id text default null,
  p_hostname text default null,
  p_metadata jsonb default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into public.alerts (
    tenant_id, asset_id, alert_type, severity, title, description,
    device_id, hostname, metadata
  )
  values (p_tenant_id, p_asset_id, p_alert_type, p_severity, p_title, p_description,
          p_device_id, p_hostname, p_metadata)
  on conflict (tenant_id, asset_id, alert_type)
    do update set
      resolved_at = null,
      updated_at = now()
    where alerts.resolved_at is not null
  returning id;
$$;

-- Helper function para resolver alerta
create or replace function public.resolve_alert(
  p_alert_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.alerts
  set resolved_at = now(), updated_at = now()
  where id = p_alert_id and resolved_at is null;
$$;

-- View com alertas não resolvidos
create or replace view public.active_alerts as
select
  a.id,
  a.tenant_id,
  a.asset_id,
  a.alert_type,
  a.severity,
  a.title,
  a.description,
  a.device_id,
  a.hostname,
  a.detected_at,
  extract(epoch from (now() - a.detected_at))::int / 60 as minutes_since_detection
from public.alerts a
where a.resolved_at is null
order by a.severity, a.detected_at desc;

-- View com estatísticas de compliance
create or replace view public.compliance_summary as
select
  dcs.tenant_id,
  count(distinct dcs.asset_id) as total_devices,
  count(distinct case when dcs.compliance_score = 100 then dcs.asset_id end) as compliant_devices,
  round(avg(dcs.compliance_score)::numeric, 2) as avg_compliance_score,
  count(distinct case when dcs.has_antivirus then dcs.asset_id end) as devices_with_antivirus,
  count(distinct case when dcs.critical_violations > 0 then dcs.asset_id end) as devices_with_critical_violations
from public.device_compliance_status dcs
group by dcs.tenant_id;
