insert into public.tenants (slug, name, segment, compliance)
values
  ('aurora', 'Grupo Aurora', 'Servicos corporativos', 94),
  ('norte-energia', 'Norte Energia', 'Energia', 91),
  ('clara-seguros', 'Clara Seguros', 'Seguros', 88),
  ('metro-saude', 'Metro Saude', 'Saude', 84)
on conflict (slug) do update
set name = excluded.name,
    segment = excluded.segment,
    compliance = excluded.compliance;

insert into public.units (tenant_id, name, city)
select tenant.id, unit_data.name, unit_data.city
from public.tenants tenant
join (
  values
    ('aurora', 'Financeiro', 'Sao Paulo'),
    ('aurora', 'Data center', 'Sao Paulo'),
    ('norte-energia', 'Operacoes', 'Recife'),
    ('clara-seguros', 'Comercial', 'Curitiba'),
    ('metro-saude', 'Unidade Central', 'Rio de Janeiro')
) as unit_data(tenant_slug, name, city)
  on unit_data.tenant_slug = tenant.slug
where not exists (
  select 1 from public.units unit
  where unit.tenant_id = tenant.id and unit.name = unit_data.name
);

insert into public.assets (
  tenant_id,
  unit_id,
  tag,
  type,
  model,
  owner,
  location,
  status,
  criticality,
  updated_at
)
select
  tenant.id,
  unit.id,
  asset_data.tag,
  asset_data.type,
  asset_data.model,
  asset_data.owner,
  asset_data.location,
  asset_data.status::public.asset_status,
  asset_data.criticality::public.asset_criticality,
  asset_data.updated_at::timestamptz
from public.tenants tenant
left join public.units unit
  on unit.tenant_id = tenant.id
join (
  values
    ('aurora', 'Financeiro', 'NTB-1048', 'Notebook', 'ThinkPad T14', 'Mariana Alves', 'Financeiro', 'Em uso', 'Media', '2026-05-04 09:00:00-03'),
    ('norte-energia', 'Operacoes', 'MON-0217', 'Monitor', 'Dell P2422H', 'Paulo Mendes', 'Operacoes', 'Em uso', 'Baixa', '2026-05-04 08:30:00-03'),
    ('aurora', 'Data center', 'SRV-0003', 'Servidor', 'PowerEdge R650', 'Infraestrutura', 'Data center', 'Atencao', 'Alta', '2026-05-03 15:20:00-03'),
    ('clara-seguros', 'Comercial', 'CEL-0891', 'Celular', 'Galaxy A55', 'Ana Ribeiro', 'Comercial', 'Manutencao', 'Media', '2026-05-02 11:40:00-03'),
    ('metro-saude', 'Unidade Central', 'SWI-0144', 'Switch', 'Aruba 2930F', 'Redes', 'Unidade Central', 'Estoque', 'Alta', '2026-05-01 10:10:00-03')
) as asset_data(tenant_slug, unit_name, tag, type, model, owner, location, status, criticality, updated_at)
  on asset_data.tenant_slug = tenant.slug
  and unit.name = asset_data.unit_name
on conflict (tenant_id, tag) do update
set unit_id = excluded.unit_id,
    type = excluded.type,
    model = excluded.model,
    owner = excluded.owner,
    location = excluded.location,
    status = excluded.status,
    criticality = excluded.criticality,
    updated_at = excluded.updated_at;

insert into public.activities (tenant_id, asset_id, title, description, occurred_at)
select
  tenant.id,
  asset.id,
  activity_data.title,
  activity_data.description,
  activity_data.occurred_at::timestamptz
from public.tenants tenant
left join public.assets asset
  on asset.tenant_id = tenant.id
join (
  values
    ('aurora', 'SRV-0003', 'Servidor com alerta de garantia', 'SRV-0003 vence cobertura em 45 dias.', '2026-05-04 09:42:00-03'),
    ('clara-seguros', 'CEL-0891', 'Celular enviado para manutencao', 'CEL-0891 atualizado pelo suporte de campo.', '2026-05-04 08:15:00-03'),
    ('metro-saude', 'SWI-0144', 'Novo switch em estoque', 'SWI-0144 aguardando vinculacao a unidade.', '2026-05-03 16:00:00-03')
) as activity_data(tenant_slug, asset_tag, title, description, occurred_at)
  on activity_data.tenant_slug = tenant.slug
  and asset.tag = activity_data.asset_tag
where not exists (
  select 1
  from public.activities activity
  where activity.tenant_id = tenant.id
    and activity.title = activity_data.title
    and activity.occurred_at = activity_data.occurred_at::timestamptz
);
