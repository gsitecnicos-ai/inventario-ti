import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { generateAlertsFromHeartbeat, resolveAlert } from "@/lib/alerts-service";
import { createHash } from "node:crypto";
import { parseJsonRequest } from "@/lib/agent-request";

type Telemetry = {
  collection_duration_ms?: number;
  retry_count?: number;
  memory_usage_bytes?: number;
  queue_depth?: number;
};

type HeartbeatPayload = {
  tenant_slug?: string;
  api_key?: string;
  device_id?: string;
  hostname?: string;
  ip?: string;
  cpu_usage_percent?: number;
  memory_usage_percent?: number;
  uptime_seconds?: number;
  telemetry?: Telemetry;
};

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export async function POST(request: Request) {
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada." },
      { status: 500 },
    );
  }

  let payload: HeartbeatPayload;

  try {
    payload = await parseJsonRequest<HeartbeatPayload>(request);
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

  // Validar tenant e API key
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, agent_api_key, agent_api_key_hash")
    .eq("slug", tenantSlug)
    .single();

  if (tenantError || !tenant) {
    return Response.json({ error: "Agente nao autorizado." }, { status: 401 });
  }

  const providedHash = createHash("sha256").update(apiKey).digest("hex");
  const isValid = Boolean(
    (tenant as any).agent_api_key_hash
      ? (tenant as any).agent_api_key_hash === providedHash
      : tenant.agent_api_key === apiKey,
  );

  if (!isValid) {
    return Response.json({ error: "Agente nao autorizado." }, { status: 401 });
  }

  const hostname = readText(payload.hostname) ?? deviceId;
  const ip = readText(payload.ip);
  const cpuUsage = readNumber(payload.cpu_usage_percent);
  const memoryUsage = readNumber(payload.memory_usage_percent);
  const uptime = readNumber(payload.uptime_seconds);

  // Buscar ou criar asset associado
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("tag", deviceId.toUpperCase())
    .single();

  if (assetError && assetError.code !== "PGRST116") {
    return Response.json({ error: assetError.message }, { status: 500 });
  }

  let assetId = asset?.id;

  // Se asset nao existe, criar um dummy para o heartbeat
  if (!assetId) {
    const { data: newAsset, error: createError } = await supabase
      .from("assets")
      .insert({
        tenant_id: tenant.id,
        tag: deviceId.toUpperCase(),
        type: "Computador",
        model: "Aguardando informacoes completas",
        owner: hostname,
        location: ip || "IP desconhecido",
        status: "Em uso",
        criticality: "Media",
      })
      .select("id")
      .single();

    if (createError) {
      return Response.json({ error: createError.message }, { status: 500 });
    }

    assetId = newAsset.id;
  }

  const telemetry = payload.telemetry ?? {};

  // Upsert heartbeat (leve e rápido)
  const { error: heartbeatError } = await supabase
    .from("agent_heartbeats")
    .upsert(
      {
        tenant_id: tenant.id,
        asset_id: assetId,
        device_id: deviceId.toUpperCase(),
        hostname,
        ip_address: ip,
        status: "online",
        cpu_usage_percent: cpuUsage,
        memory_usage_percent: memoryUsage,
        uptime_seconds: uptime,
        collection_duration_ms: telemetry.collection_duration_ms ?? null,
        telemetry_retry_count: telemetry.retry_count ?? null,
        telemetry_memory_bytes: telemetry.memory_usage_bytes ?? null,
        telemetry_queue_depth: telemetry.queue_depth ?? null,
        last_heartbeat_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "tenant_id,asset_id,device_id",
      },
    );

  if (heartbeatError) {
    return Response.json({ error: heartbeatError.message }, { status: 500 });
  }

  // Gerar alertas automáticos
  await generateAlertsFromHeartbeat(
    supabase,
    tenant.id,
    assetId,
    deviceId.toUpperCase(),
    hostname,
    cpuUsage,
    memoryUsage
  );

  // Resolver alerta de offline se havia
  await resolveAlert(supabase, tenant.id, assetId, "agent_offline");

  return Response.json({
    ok: true,
    tenant: tenant.name,
    asset_id: assetId,
    message: "Heartbeat registrado",
  });
}
