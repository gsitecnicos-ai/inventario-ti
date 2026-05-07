import { createAdminSupabaseClient } from "@/lib/supabase-server";

type AgentPayload = {
  tenant_slug?: string;
  api_key?: string;
  device_id?: string;
  hostname?: string;
  os?: string;
  platform?: string;
  cpu?: string;
  ram?: number;
  ip?: string;
};

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada." },
      { status: 500 },
    );
  }

  let payload: AgentPayload;

  try {
    payload = (await request.json()) as AgentPayload;
  } catch {
    return Response.json({ error: "JSON invalido." }, { status: 400 });
  }

  const tenantSlug = readText(payload.tenant_slug);
  const apiKey = readText(payload.api_key);
  const deviceId = readText(payload.device_id);

  if (!tenantSlug || !apiKey || !deviceId) {
    return Response.json(
      { error: "tenant_slug, api_key e device_id sao obrigatorios." },
      { status: 400 },
    );
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, agent_api_key")
    .eq("slug", tenantSlug)
    .single();

  if (tenantError || !tenant || tenant.agent_api_key !== apiKey) {
    return Response.json({ error: "Agente nao autorizado." }, { status: 401 });
  }

  const hostname = readText(payload.hostname) ?? deviceId;
  const osName = readText(payload.os) ?? "Sistema operacional";
  const platform = readText(payload.platform) ?? "desconhecido";
  const cpu = readText(payload.cpu) ?? "CPU nao informada";
  const ip = readText(payload.ip) ?? "IP nao informado";
  const ramGb =
    typeof payload.ram === "number" && Number.isFinite(payload.ram)
      ? Math.round(payload.ram / 1024 / 1024 / 1024)
      : null;
  const model = ramGb ? `${cpu} / ${ramGb} GB RAM` : cpu;

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .upsert(
      {
        tenant_id: tenant.id,
        tag: deviceId.toUpperCase(),
        type: "Computador",
        model,
        owner: hostname,
        location: ip,
        status: "Em uso",
        criticality: "Media",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,tag" },
    )
    .select("id")
    .single();

  if (assetError) {
    return Response.json({ error: assetError.message }, { status: 500 });
  }

  await supabase.from("activities").insert({
    tenant_id: tenant.id,
    asset_id: asset.id,
    title: "Check-in do agente",
    description: `${hostname} informou ${osName} / ${platform}.`,
  });

  return Response.json({
    ok: true,
    tenant: tenant.name,
    asset_id: asset.id,
  });
}
