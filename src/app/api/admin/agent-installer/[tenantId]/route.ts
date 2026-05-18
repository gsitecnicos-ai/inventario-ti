import { createAdminSupabaseClient, requireGlobalAdmin } from "@/lib/supabase-server";

type TenantAgentRow = {
  id: string;
  slug: string | null;
  name: string;
  agent_api_key: string | null;
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

  if (configuredOrigin?.trim()) {
    return configuredOrigin.trim().replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
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
    .select("id, slug, name, agent_api_key")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Empresa nao encontrada." },
      { status: 404 },
    );
  }

  const tenant = data as TenantAgentRow;

  if (!tenant.slug || !tenant.agent_api_key) {
    return Response.json(
      { error: "Empresa sem slug ou chave do agente." },
      { status: 400 },
    );
  }

  const origin = getAppOrigin(request);
  const endpoint = `${origin}/api/agent/checkin`;
  const agentUrl = `${origin}/downloads/inventario-ti-agent-windows-amd64.exe`;
  const taskName = "Inventario TI Agent";
  const script = `# Inventario TI Agent - instalador Windows
# Execute este script como Administrador no endpoint do cliente.
$ErrorActionPreference = 'Stop'

$InstallDir = Join-Path $env:ProgramData 'InventarioTIAgent'
$AgentPath = Join-Path $InstallDir 'inventario-ti-agent.exe'
$ConfigPath = Join-Path $InstallDir 'config.json'
$AgentUrl = ${psString(agentUrl)}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $AgentUrl -OutFile $AgentPath -UseBasicParsing

if (!(Test-Path $AgentPath)) {
  throw "Nao foi possivel baixar o agente em $AgentPath"
}

$Config = [ordered]@{
  endpoint = ${psString(endpoint)}
  tenant_slug = ${psString(tenant.slug)}
  api_key = ${psString(tenant.agent_api_key)}
  interval_minutes = 10
}

$Config | ConvertTo-Json -Depth 3 | Set-Content -Path $ConfigPath -Encoding UTF8

$Action = New-ScheduledTaskAction -Execute $AgentPath -WorkingDirectory $InstallDir
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
Register-ScheduledTask -TaskName ${psString(taskName)} -Action $Action -Trigger $Trigger -Principal $Principal -Description 'Envia inventario de ativos para Inventario TI' -Force | Out-Null
Start-ScheduledTask -TaskName ${psString(taskName)}

Write-Host 'Inventario TI Agent instalado com sucesso.'
Write-Host "Config: $ConfigPath"
`;
  const fileName = `${safeFileName(tenant.name) || "empresa"}-agent-installer.ps1`;

  return new Response(script, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
