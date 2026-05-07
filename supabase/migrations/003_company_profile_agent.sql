alter table public.tenants
  add column if not exists cnpj text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists address_line text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists logo_url text,
  add column if not exists agent_api_key text;

create unique index if not exists tenants_agent_api_key_idx
on public.tenants(agent_api_key)
where agent_api_key is not null;
