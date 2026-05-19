import { createAdminSupabaseClient, requireGlobalAdmin } from "@/lib/supabase-server";
import { createHash, randomUUID } from "node:crypto";

type TenantAgentRow = {
  id: string;
  slug: string | null;
  name: string;
  agent_api_key: string | null;
  agent_api_key_hash: string | null;
};

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getAppOrigin(request: Request) {
  const configuredOrigin =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const allowHttp = process.env.ALLOW_HTTP === "true" || process.env.NODE_ENV === "development";

  if (configuredOrigin?.trim()) {
    const trimmed = configuredOrigin.trim().replace(/\/+$/, "");
    try {
      const u = new URL(trimmed);
      if (!allowHttp && u.protocol === "http:") {
        u.protocol = "https:";
        return u.toString().replace(/\/+$/, "");
      }
      return trimmed;
    } catch (err) {
      return trimmed;
    }
  }

  const reqOrigin = new URL(request.url).origin;
  if (!allowHttp) {
    return reqOrigin.replace(/^http:/, "https:");
  }
  return reqOrigin;
}

function psString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  await requireGlobalAdmin();

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada." },
      { status: 500 },
    );
  }

  const { tenantId } = await params;
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, agent_api_key, agent_api_key_hash")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Empresa nao encontrada." },
      { status: 404 },
    );
  }

  const tenant = data as TenantAgentRow;

  if (!tenant.slug) {
    return Response.json(
      { error: "Empresa sem slug." },
      { status: 400 },
    );
  }

  // Determine plaintext API key to embed in installer. If the tenant has a legacy
  // plaintext `agent_api_key`, use it. Otherwise generate a new key, store its
  // SHA256 hash in `agent_api_key_hash` and use the generated plaintext once.
  let plaintextKey: string | null = null;

  if (tenant.agent_api_key) {
    plaintextKey = tenant.agent_api_key;
  } else if (tenant.agent_api_key_hash) {
    // Key is already hashed; rotate and return a fresh key for the installer.
    plaintextKey = `agt_${randomUUID().replaceAll("-", "")}`;
    const newHash = createHash("sha256").update(plaintextKey).digest("hex");
    await supabase.from("tenants").update({ agent_api_key_hash: newHash }).eq("id", tenantId);
  } else {
    // No key present; create one and persist its hash.
    plaintextKey = `agt_${randomUUID().replaceAll("-", "")}`;
    const newHash = createHash("sha256").update(plaintextKey).digest("hex");
    await supabase.from("tenants").update({ agent_api_key_hash: newHash }).eq("id", tenantId);
  }

  const origin = getAppOrigin(request);
  const endpoint = `${origin}/api/agent/checkin`;
  const heartbeatEndpoint = `${origin}/api/agent/heartbeat`;
  const updateEndpoint = `${origin}/api/agent/update`;
  const agentUrl = `${origin}/downloads/inventario-ti-agent-windows-amd64.exe`;
  const serviceName = "InventarioTIAgent";
  const legacyTaskName = "Inventario TI Agent";
  const script = `# Inventario TI Agent - instalador Windows
# Execute este script como Administrador no endpoint do cliente.
$ErrorActionPreference = 'Stop'

$InstallDir = Join-Path $env:ProgramData 'InventarioTIAgent'
$AgentPath = Join-Path $InstallDir 'inventario-ti-agent.exe'
$ConfigPath = Join-Path $InstallDir 'config.json'
$AgentUrl = ${psString(agentUrl)}
$ServiceName = ${psString(serviceName)}
$LegacyTaskName = ${psString(legacyTaskName)}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $AgentUrl -OutFile $AgentPath -UseBasicParsing

if (!(Test-Path $AgentPath)) {
  throw "Nao foi possivel baixar o agente em $AgentPath"
}

$Config = [ordered]@{
  endpoint = ${psString(endpoint)}
  heartbeat_endpoint = ${psString(heartbeatEndpoint)}
  update_endpoint = ${psString(updateEndpoint)}
  tenant_slug = ${psString(tenant.slug)}
    api_key = ${psString(plaintextKey)}
  heartbeat_minutes = 5
  inventory_hours = 12
  update_minutes = 60
  interval_minutes = 10
  service_name = $ServiceName
}

$Config | ConvertTo-Json -Depth 3 | Set-Content -Path $ConfigPath -Encoding UTF8

$LegacyTask = Get-ScheduledTask -TaskName $LegacyTaskName -ErrorAction SilentlyContinue
if ($LegacyTask) {
  Stop-ScheduledTask -TaskName $LegacyTaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $LegacyTaskName -Confirm:$false
}

$ExistingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($ExistingService) {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  & $AgentPath uninstall
}

& $AgentPath install
sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/300000 | Out-Null
sc.exe failureflag $ServiceName 1 | Out-Null
Start-Service -Name $ServiceName

Write-Host 'Inventario TI Agent instalado com sucesso.'
Write-Host "Config: $ConfigPath"
Write-Host "Servico: $ServiceName"
`;
  const fileName = `${safeFileName(tenant.name) || "empresa"}-agent-installer.ps1`;

  return new Response(script, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
