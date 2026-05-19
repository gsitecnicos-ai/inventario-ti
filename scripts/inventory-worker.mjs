import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function normalizeSoftwareItem(item) {
  return {
    name: typeof item?.name === "string" ? item.name.trim() : "",
    version: typeof item?.version === "string" ? item.version.trim() : "",
    publisher: typeof item?.publisher === "string" ? item.publisher.trim() : "",
  };
}

function isSoftwareItemValid(item) {
  return item.name !== "";
}

function buildSoftwareKey(item) {
  return `${item.name}||${item.version}||${item.publisher}`;
}

async function syncAssetSoftwares(supabase, tenantId, assetId, payload) {
  const now = new Date().toISOString();

  const softwareChanges = payload.software_changes || {};
  const added = Array.isArray(softwareChanges.added) ? softwareChanges.added.map(normalizeSoftwareItem) : [];
  const removed = Array.isArray(softwareChanges.removed) ? softwareChanges.removed.map(normalizeSoftwareItem) : [];
  const fullSoftwares = Array.isArray(payload.softwares) ? payload.softwares.map(normalizeSoftwareItem) : [];

  const normalizedFull = fullSoftwares.filter(isSoftwareItemValid);
  const normalizedAdded = added.filter(isSoftwareItemValid);
  const normalizedRemoved = removed.filter(isSoftwareItemValid);

  if (normalizedAdded.length === 0 && normalizedRemoved.length === 0 && normalizedFull.length === 0) {
    return;
  }

  if (normalizedFull.length > 0) {
    const upsertPayload = normalizedFull.map((software) => ({
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
      .upsert(upsertPayload, { onConflict: "tenant_id,name,version,publisher" })
      .select("id");

    if (softwareError) {
      throw new Error(softwareError.message || "Falha ao sincronizar inventario de software");
    }

    const inventoryIds = (softwareRows || []).map((row) => row.id).filter(Boolean);

    const { error: deleteError } = await supabase.from("asset_software").delete().eq("asset_id", assetId);
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

    const { error: insertError } = await supabase.from("asset_software").insert(assetSoftwarePayload);
    if (insertError) {
      throw new Error(insertError.message);
    }

    return;
  }

  if (normalizedAdded.length > 0) {
    const upsertPayload = normalizedAdded.map((software) => ({
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
      .upsert(upsertPayload, { onConflict: "tenant_id,name,version,publisher" })
      .select("id");

    if (softwareError) {
      throw new Error(softwareError.message || "Falha ao sincronizar inventario de software");
    }

    const inventoryIds = (softwareRows || []).map((row) => row.id).filter(Boolean);
    const existingRows = inventoryIds.map((softwareInventoryId) => ({
      tenant_id: tenantId,
      asset_id: assetId,
      software_inventory_id: softwareInventoryId,
      installed_at: now,
      created_at: now,
      updated_at: now,
    }));

    const { error: insertError } = await supabase.from("asset_software").insert(existingRows);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  if (normalizedRemoved.length > 0) {
    const softwareIdsToRemove = [];
    for (const software of normalizedRemoved) {
      const { data: existingSoftware, error: existingError } = await supabase
        .from("software_inventory")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", software.name)
        .eq("version", software.version)
        .eq("publisher", software.publisher)
        .limit(1)
        .single();

      if (existingError || !existingSoftware) {
        continue;
      }

      softwareIdsToRemove.push(existingSoftware.id);
    }

    if (softwareIdsToRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from("asset_software")
        .delete()
        .eq("asset_id", assetId)
        .in("software_inventory_id", softwareIdsToRemove);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }
  }
}

async function syncHardwareHistory(supabase, tenantId, assetId, snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return;
  }

  const validSnapshots = snapshots.filter((snapshot) => typeof snapshot?.new_value === "string" && snapshot.new_value.trim());
  if (validSnapshots.length === 0) {
    return;
  }

  const { data: latestRows, error: latestError } = await supabase
    .from("hardware_history")
    .select("hardware_key, new_value")
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
      const key = snapshot.hardware_key;
      const oldValue = latestByKey.get(key) || null;
      const eventType = oldValue ? snapshot.event_type : "initial_snapshot";

      if (oldValue === snapshot.new_value) {
        return null;
      }

      return {
        tenant_id: tenantId,
        asset_id: assetId,
        hardware_key: snapshot.hardware_key,
        event_type: snapshot.event_type,
        old_value: oldValue,
        new_value: snapshot.new_value,
        source: "agent",
        metadata: snapshot.metadata || {},
        observed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("hardware_history").insert(rows);
  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function insertTelemetry(supabase, tenantId, assetId, deviceId, hostname, payloadType, telemetry) {
  if (!telemetry || typeof telemetry !== "object") {
    return;
  }

  const { error } = await supabase.from("agent_telemetry").insert({
    tenant_id: tenantId,
    asset_id: assetId,
    device_id: deviceId,
    hostname,
    payload_type: payloadType,
    data: telemetry,
    collected_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to insert telemetry:", error.message);
  }
}

async function processPendingJob() {
  const { data: jobs, error: fetchError } = await supabase
    .from("agent_inventory_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (fetchError) {
    console.error("Failed to fetch jobs:", fetchError.message);
    return;
  }

  const job = (jobs || [])[0];
  if (!job) {
    return;
  }

  const { data: lockedRows, error: lockError } = await supabase
    .from("agent_inventory_jobs")
    .update({
      status: "processing",
      attempts: job.attempts + 1,
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id");

  if (lockError) {
    console.error("Failed to lock job:", lockError.message);
    return;
  }

  if (!lockedRows || lockedRows.length === 0) {
    return;
  }

  const payload = job.payload || {};
  const hostname = payload.hostname || null;
  const deviceId = job.device_id;

  try {
    if (payload.telemetry) {
      await insertTelemetry(supabase, job.tenant_id, job.asset_id, deviceId, hostname, "inventory", payload.telemetry);
    }

    if (payload.softwares || payload.software_changes) {
      await syncAssetSoftwares(supabase, job.tenant_id, job.asset_id, payload);
    }

    if (payload.hardware_snapshots) {
      await syncHardwareHistory(supabase, job.tenant_id, job.asset_id, payload.hardware_snapshots);
    }

    await supabase.from("activities").insert({
      tenant_id: job.tenant_id,
      asset_id: job.asset_id,
      title: "Check-in do agente processado",
      description: `Inventario do dispositivo ${deviceId} processado com sucesso`,
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    const { error: completedError } = await supabase
      .from("agent_inventory_jobs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    if (completedError) {
      console.error("Failed to mark job completed:", completedError.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Job failed:", message);

    await supabase
      .from("agent_inventory_jobs")
      .update({
        status: "failed",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
}

async function run() {
  console.log("Agent inventory worker started.");
  while (true) {
    try {
      await processPendingJob();
    } catch (error) {
      console.error("Unexpected worker error:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

run().catch((error) => {
  console.error("Worker exiting:", error);
  process.exit(1);
});
