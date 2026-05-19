-- Add agent_api_key_hash and migrate existing plaintext agent_api_key to SHA256 hash

alter table public.tenants
  add column if not exists agent_api_key_hash text;

-- Populate hash column from legacy plaintext keys if present
update public.tenants
set agent_api_key_hash = encode(digest(agent_api_key, 'sha256'), 'hex')
where agent_api_key is not null;

-- Keep uniqueness similar to previous index on agent_api_key
create unique index if not exists tenants_agent_api_key_hash_idx
  on public.tenants(agent_api_key_hash)
  where agent_api_key_hash is not null;

-- Do not drop legacy `agent_api_key` here to preserve compatibility. Admin UI will stop returning plaintext.

notify pgrst, 'reload schema';
