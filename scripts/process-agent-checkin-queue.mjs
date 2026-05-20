import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function readText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeStorageDevices(storageDevices = []) {
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
        media_type: mediaType,
        size_bytes: sizeBytes,
        label: `${model} / ${serial} / ${sizeBytes ? Math.round(sizeBytes / 1024 / 1024 / 1024) : "Tamanho nao informado"} GB / ${mediaType}`,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.label.localeCompare(right.label));
}

async function syncAssetSoftwares(supabaseClient, tenantId, assetId, softwares) {
  const normalizedSoftwares = (softwares || [])
    .map((software) => ({
      name: readText(software.name),
      version: readText(software.version) ?? "",
      publisher: readText(software.publisher) ?? "",
    }))
    .filter((software) => Boolean(software.name));

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

  const { data: softwareRows, error: softwareError } = await supabaseClient
    .from("software_inventory")
    .upsert(upsertPayload, {
      onConflict: "tenant_id,name,version,publisher",
    })
    .select("id");

  if (softwareError || !softwareRows) {
    throw new Error(softwareError?.message || "Falha ao sincronizar inventario de software");
  }

  const inventoryIds = softwareRows.map((row) => row.id);

  const { error: deleteError } = await supabaseClient
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

  const { error: insertError } = await supabaseClient.from("asset_software").insert(assetSoftwarePayload);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function syncHardwareHistory(supabaseClient, tenantId, assetId, payload) {
  const validSnapshots = payload
    .map((snapshot) => ({
      hardware_key: snapshot.hardware_key,
      event_type: snapshot.event_type,
      new_value: snapshot.new_value,
      metadata: snapshot.metadata || {},
    }))
    .filter((snapshot) => snapshot.new_value?.trim());

  if (!validSnapshots.length) {
    return;
  }

  const { data: latestRows, error: latestError } = await supabaseClient
    .from("hardware_history")
    .select("hardware_key, new_value, observed_at")
    .eq("asset_id", assetId)
    .order("observed_at", { ascending: false });

  if (latestError) {
    throw new Error(latestError.message);
  }

  const latestByKey = new Map();
  for (const row of latestRows || []) {
    if (!latestByKey.has(row.hardware_key)) {
      latestByKey.set(row.hardware_key, row.new_value);
    }
  }

  const rows = validSnapshots
    .map((snapshot) => {
      const oldValue = latestByKey.get(snapshot.hardware_key) || null;
      const eventType = oldValue ? snapshot.event_type : "initial_snapshot";
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
        metadata: snapshot.metadata,
        observed_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    return;
  }

  const { error: insertError } = await supabaseClient.from("hardware_history").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}

function getQueueFilterLabel(item) {
  return `${item.device_id} (${item.payload_type})`;
}

async function processQueueItem(item) {
  const payload = item.payload || {};
  const deviceId = readText(payload.device_id) || item.device_id;
  const hostname = readText(payload.hostname) || deviceId;
  const osName = readText(payload.os) || "Sistema operacional";
  const platform = readText(payload.platform) || "desconhecido";
  const cpu = readText(payload.cpu) || "CPU nao informada";
  const ip = readText(payload.ip) || "IP nao informado";
  const ramGb = readPositiveNumber(payload.ram)
    ? Math.round(payload.ram / 1024 / 1024 / 1024)
    : null;
  const model = ramGb ? `${cpu} / ${ramGb} GB RAM` : cpu;
  const storageDevices = normalizeStorageDevices(payload.storage_devices);

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .upsert(
      {
        tenant_id: item.tenant_id,
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
    throw new Error(assetError.message);
  }

  if (payload.payload_type !== "inventory_delta") {
    if (Array.isArray(payload.softwares) && payload.softwares.length > 0) {
      await syncAssetSoftwares(supabase, item.tenant_id, asset.id, payload.softwares);
    }

    await syncHardwareHistory(supabase, item.tenant_id, asset.id, [
      {
        hardware_key: "os",
        event_type: "os_change",
        new_value: `${osName} / ${platform}`,
        metadata: { os: osName, platform },
      },
      ...(payload.ram
        ? [
            {
              hardware_key: "ram",
              event_type: "ram_upgrade",
              new_value: `${Math.round(payload.ram / 1024 / 1024 / 1024)} GB`,
              metadata: { bytes: payload.ram },
            },
          ]
        : []),
      ...(storageDevices.length
        ? [
            {
              hardware_key: "storage",
              event_type: "storage_change",
              new_value: storageDevices.map((device) => device.label).join(" | "),
              metadata: { devices: storageDevices },
            },
          ]
        : []),
    ]);
  }

  await supabase.from("activities").insert({
    tenant_id: item.tenant_id,
    asset_id: asset.id,
    title: "Processamento assíncrono de check-in de agente",
    description: `Payload ${getQueueFilterLabel(item)} processado com status ${payload.payload_type || "inventory_snapshot"}`,
  });
}

async function markItemStatus(item, status, errorMessage = null) {
  const update = {
    status,
    error_message: errorMessage,
    processed_at: status === "processed" ? new Date().toISOString() : null,
    last_attempted_at: new Date().toISOString(),
  };

  if (status !== "processed") {
    update.attempts = item.attempts + 1;
  }

  await supabase.from("agent_checkin_queue").update(update).eq("id", item.id);
}

async function main() {
  const { data: rows, error } = await supabase
    .from("agent_checkin_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Erro ao listar itens da fila:", error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("Nenhum item pendente na fila.");
    return;
  }

  for (const row of rows) {
    try {
      console.log(`Processando fila ${row.id} (${row.device_id})`);
      await markItemStatus(row, "processing");
      await processQueueItem(row);
      await markItemStatus(row, "processed");
      console.log(`Processado com sucesso: ${row.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Falha ao processar ${row.id}:`, errorMessage);
      const nextStatus = row.attempts + 1 >= 5 ? "failed" : "pending";
      await markItemStatus(row, nextStatus, errorMessage);
    }
  }
}

main();
