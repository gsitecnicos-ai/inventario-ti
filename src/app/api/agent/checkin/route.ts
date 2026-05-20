import { createAdminSupabaseClient } from "@/lib/supabase-server";
import { createHash } from "node:crypto";
import { parseJsonRequest } from "@/lib/agent-request";
import { queueAgentCheckin } from "@/lib/agent-queue";
import type { Json } from "@/lib/database.types";

type SoftwareEntry = {
  name?: string;
  version?: string;
  publisher?: string;
};

type StorageDeviceEntry = {
  model?: string;
  serial?: string;
  size_bytes?: number;
  media_type?: string;
};

type Telemetry = {
  collection_duration_ms?: number;
  retry_count?: number;
  memory_usage_bytes?: number;
  queue_depth?: number;
};

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
  softwares?: SoftwareEntry[];
  storage_devices?: StorageDeviceEntry[];
  payload_type?: "inventory_snapshot" | "inventory_delta";
  telemetry?: Telemetry;
};

type HardwareKey = "ram" | "storage" | "os";

type HardwareSnapshot = {
  hardware_key: HardwareKey;
  event_type: "ram_upgrade" | "storage_change" | "os_change";
  new_value: string;
  metadata?: Json;
};

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function formatBytes(value: number) {
  const gib = value / 1024 / 1024 / 1024;

  return `${Math.round(gib)} GB`;
}

function normalizeStorageDevices(storageDevices: StorageDeviceEntry[] = []) {
  return storageDevices
    .map((device) => {
      const model = readText(device.model) ?? "Modelo nao informado";
      const serial = readText(device.serial) ?? "Serial nao informado";
      const mediaType = readText(device.media_type) ?? "Tipo nao informado";
      const sizeBytes = readPositiveNumber(device.size_bytes);

      if (!sizeBytes && model === "Modelo nao informado" && serial === "Serial nao informado") {
        return null;
      }

      return {
        model,
        serial,
        mediaType,
        sizeBytes,
        label: `${model} / ${serial} / ${sizeBytes ? formatBytes(sizeBytes) : "Tamanho nao informado"} / ${mediaType}`,
      };
    })
    .filter((device): device is NonNullable<typeof device> => Boolean(device))
    .sort((left, right) => left.label.localeCompare(right.label));
}

async function syncHardwareHistory(
  supabase: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  tenantId: string,
  assetId: string,
  snapshots: HardwareSnapshot[],
) {
  const validSnapshots = snapshots.filter((snapshot) => snapshot.new_value.trim());

  if (!validSnapshots.length) {
    return;
  }

  const { data: latestRows, error: latestError } = await supabase
    .from("hardware_history")
    .select("hardware_key, new_value, observed_at")
    .eq("asset_id", assetId)
    .order("observed_at", { ascending: false });

  if (latestError) {
    throw new Error(latestError.message);
  }

  const latestByKey = new Map<HardwareKey, string>();

  for (const row of latestRows ?? []) {
    const key = row.hardware_key as HardwareKey;

    if (!latestByKey.has(key)) {
      latestByKey.set(key, row.new_value);
    }
  }

  const rows = validSnapshots
    .map((snapshot) => {
      const oldValue = latestByKey.get(snapshot.hardware_key) ?? null;
      const eventType: HardwareSnapshot["event_type"] | "initial_snapshot" =
        oldValue ? snapshot.event_type : "initial_snapshot";

      if (oldValue === snapshot.new_value) {
        return null;
      }

      return {
        tenant_id: tenantId,
        asset_id: assetId,
        hardware_key: snapshot.hardware_key,
        event_type: eventType,
        old_value: oldValue,
        new_value: snapshot.new_value,
        source: "agent",
        metadata: snapshot.metadata ?? {},
        observed_at: new Date().toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!rows.length) {
    return;
  }

  const { error: insertError } = await supabase.from("hardware_history").insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function syncAssetSoftwares(
  supabase: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  tenantId: string,
  assetId: string,
  softwares: SoftwareEntry[],
) {
  const normalizedSoftwares = softwares
    .map((software) => ({
      name: readText(software.name),
      version: readText(software.version) ?? "",
      publisher: readText(software.publisher) ?? "",
    }))
    .filter((software): software is { name: string; version: string; publisher: string } =>
      Boolean(software.name),
    );

  if (!normalizedSoftwares.length) {
    return;
  }

  const now = new Date().toISOString();
  const upsertPayload = normalizedSoftwares.map((software) => ({
    tenant_id: tenantId,
    name: software.name,
    version: software.version,
    publisher: software.publisher,
    first_seen: now,
    last_seen: now,
    created_at: now,
    updated_at: now,
  }));

  const { data: softwareRows, error: softwareError } = await supabase
    .from("software_inventory")
    .upsert(upsertPayload, {
      onConflict: "tenant_id,name,version,publisher",
    })
    .select("id");

  if (softwareError || !softwareRows) {
    throw new Error(softwareError?.message ?? "Falha ao sincronizar inventario de software");
  }

  const inventoryIds = (softwareRows as { id: string }[]).map((row) => row.id);

  const { error: deleteError } = await supabase
    .from("asset_software")
    .delete()
    .eq("asset_id", assetId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const assetSoftwarePayload = inventoryIds.map((softwareInventoryId) => ({
    tenant_id: tenantId,
    asset_id: assetId,
    software_inventory_id: softwareInventoryId,
    installed_at: now,
    created_at: now,
    updated_at: now,
  }));

  const { error: insertError } = await supabase
    .from("asset_software")
    .insert(assetSoftwarePayload);

  if (insertError) {
    throw new Error(insertError.message);
  }
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
    payload = await parseJsonRequest<AgentPayload>(request);
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

  const payloadType = payload.payload_type === "inventory_delta" ? "inventory_delta" : "inventory_snapshot";

  const { error: queueError } = await queueAgentCheckin(
    supabase,
    tenant.id,
    deviceId.toUpperCase(),
    payloadType,
    payload as Json,
  );

  if (queueError) {
    return Response.json({ error: queueError.message }, { status: 500 });
  }

  return Response.json(
    {
      ok: true,
      queued: true,
      tenant: tenant.name,
      asset_tag: deviceId.toUpperCase(),
      payload_type: payloadType,
    },
    { status: 202 },
  );
}
