-- Complete tenant isolation hardening.
-- Service-role agent routes still bypass RLS, but authenticated client access is tenant-scoped.

do $$
declare
  missing_columns text;
begin
  select string_agg(format('%I.%I', expected.table_schema, expected.table_name), ', ')
  into missing_columns
  from (
    values
      ('public', 'tenant_members'),
      ('public', 'units'),
      ('public', 'assets'),
      ('public', 'activities'),
      ('public', 'agent_heartbeats'),
      ('public', 'software_inventory'),
      ('public', 'asset_software'),
      ('public', 'hardware_history')
  ) as expected(table_schema, table_name)
  where to_regclass(format('%I.%I', expected.table_schema, expected.table_name)) is not null
    and not exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = expected.table_schema
        and column_info.table_name = expected.table_name
        and column_info.column_name = 'tenant_id'
    );

  if missing_columns is not null then
    raise exception
      'RLS migration blocked: these tenant-scoped tables exist without tenant_id: %. Apply/repair their schema migrations before 008_complete_tenant_rls.sql.',
      missing_columns;
  end if;
end $$;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.units enable row level security;
alter table public.assets enable row level security;
alter table public.activities enable row level security;
alter table public.global_admins enable row level security;
alter table public.agent_heartbeats enable row level security;
alter table public.software_inventory enable row level security;
alter table public.asset_software enable row level security;
alter table public.hardware_history enable row level security;

alter table public.tenants force row level security;
alter table public.tenant_members force row level security;
alter table public.units force row level security;
alter table public.assets force row level security;
alter table public.activities force row level security;
alter table public.global_admins force row level security;
alter table public.agent_heartbeats force row level security;
alter table public.software_inventory force row level security;
alter table public.asset_software force row level security;
alter table public.hardware_history force row level security;

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

drop policy if exists "Members can read their tenants" on public.tenants;
drop policy if exists "Tenant admins can update their tenants" on public.tenants;

create policy "Members can read their tenants"
on public.tenants
for select
using (public.is_tenant_member(id));

create policy "Tenant admins can update their tenants"
on public.tenants
for update
using (public.is_tenant_admin(id))
with check (public.is_tenant_admin(id));

drop policy if exists "Members can read memberships in their tenants" on public.tenant_members;
drop policy if exists "Tenant admins can manage memberships" on public.tenant_members;

create policy "Members can read memberships in their tenants"
on public.tenant_members
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage memberships"
on public.tenant_members
for all
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

drop policy if exists "Members can read tenant units" on public.units;
drop policy if exists "Tenant admins can manage units" on public.units;

create policy "Members can read tenant units"
on public.units
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant admins can manage units"
on public.units
for all
using (public.is_tenant_admin(tenant_id))
with check (public.is_tenant_admin(tenant_id));

drop policy if exists "Members can read tenant assets" on public.assets;
drop policy if exists "Tenant operators can manage assets" on public.assets;

create policy "Members can read tenant assets"
on public.assets
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage assets"
on public.assets
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Members can read tenant activities" on public.activities;
drop policy if exists "Tenant operators can create activities" on public.activities;
drop policy if exists "Tenant operators can manage activities" on public.activities;

create policy "Members can read tenant activities"
on public.activities
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage activities"
on public.activities
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Global admins can read global admins" on public.global_admins;
drop policy if exists "Global admins can manage global admins" on public.global_admins;

create policy "Global admins can manage global admins"
on public.global_admins
for all
using (public.is_global_admin())
with check (public.is_global_admin());

drop policy if exists "Members can read agent heartbeats" on public.agent_heartbeats;
drop policy if exists "Agents can insert heartbeats" on public.agent_heartbeats;
drop policy if exists "Agents can update their heartbeats" on public.agent_heartbeats;
drop policy if exists "Tenant operators can manage agent heartbeats" on public.agent_heartbeats;

create policy "Members can read agent heartbeats"
on public.agent_heartbeats
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage agent heartbeats"
on public.agent_heartbeats
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Members can read software inventory" on public.software_inventory;
drop policy if exists "Tenant operators can manage software inventory" on public.software_inventory;

create policy "Members can read software inventory"
on public.software_inventory
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage software inventory"
on public.software_inventory
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Members can read asset software" on public.asset_software;
drop policy if exists "Tenant operators can manage asset software" on public.asset_software;

create policy "Members can read asset software"
on public.asset_software
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage asset software"
on public.asset_software
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

drop policy if exists "Members can read hardware history" on public.hardware_history;
drop policy if exists "Tenant operators can manage hardware history" on public.hardware_history;

create policy "Members can read hardware history"
on public.hardware_history
for select
using (public.is_tenant_member(tenant_id));

create policy "Tenant operators can manage hardware history"
on public.hardware_history
for all
using (public.is_tenant_operator(tenant_id))
with check (public.is_tenant_operator(tenant_id));

do $$
declare
  has_device boolean;
  has_hostname boolean;
  has_last boolean;
  has_cpu boolean;
  has_mem boolean;
  has_tenant boolean;
  has_asset boolean;
  tenant_expr text;
  asset_expr text;
  device_expr text;
  hostname_expr text;
  last_expr text;
  status_expr text;
  minutes_expr text;
  cpu_expr text;
  mem_expr text;
  view_sql text;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_heartbeats' and column_name = 'tenant_id'
  ) into has_tenant;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_heartbeats' and column_name = 'asset_id'
  ) into has_asset;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_heartbeats' and column_name = 'device_id'
  ) into has_device;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_heartbeats' and column_name = 'hostname'
  ) into has_hostname;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_heartbeats' and column_name = 'last_heartbeat_at'
  ) into has_last;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_heartbeats' and column_name = 'cpu_usage_percent'
  ) into has_cpu;

  select exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_heartbeats' and column_name = 'memory_usage_percent'
  ) into has_mem;

  tenant_expr := case when has_tenant then 'hb.tenant_id' else 'null::uuid' end;
  asset_expr := case when has_asset then 'hb.asset_id' else 'null::uuid' end;
  device_expr := case when has_device then 'hb.device_id' else ''''::text end;
  hostname_expr := case when has_hostname then 'hb.hostname' else ''''::text end;
  last_expr := case when has_last then 'hb.last_heartbeat_at' else 'null::timestamptz' end;

  if has_last then
    status_expr := 'case when ' || last_expr || ' > now() - interval ''10 minutes'' then ''online'' when ' || last_expr || ' > now() - interval ''1 hour'' then ''idle'' else ''offline'' end';
    minutes_expr := 'extract(epoch from (now() - ' || last_expr || '))::int / 60';
  else
    status_expr := '''offline''';
    minutes_expr := 'null::int';
  end if;

  cpu_expr := case when has_cpu then 'hb.cpu_usage_percent' else 'null::numeric' end;
  mem_expr := case when has_mem then 'hb.memory_usage_percent' else 'null::numeric' end;

  view_sql := format($f$
create or replace view public.agent_status_summary
with (security_invoker = true)
as
select
  %s as tenant_id,
  %s as asset_id,
  %s as device_id,
  %s as hostname,
  %s as status,
  %s as last_heartbeat_at,
  %s as minutes_since_heartbeat,
  %s as cpu_usage_percent,
  %s as memory_usage_percent
from public.agent_heartbeats hb;
$f$, tenant_expr, asset_expr, device_expr, hostname_expr, status_expr, last_expr, minutes_expr, cpu_expr, mem_expr);

  execute view_sql;
end $$;

notify pgrst, 'reload schema';
