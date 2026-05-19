import "server-only";

import {
  activities as mockActivities,
  assets as mockAssets,
  tenants as mockTenants,
  type Activity,
  type Asset,
  type HardwareHistory,
  type Tenant,
} from "./inventory-data";
import { createAuthenticatedSupabaseClient } from "./supabase-server";

export type AssetFilters = {
  tenantId?: string;
  status?: Asset["status"];
  query?: string;
};

type TenantRow = {
  id: string;
  slug?: string | null;
  name: string;
  segment?: string | null;
  compliance?: number | null;
  logo_url?: string | null;
};

type AssetRow = {
  id: string;
  tag: string;
  tenant_id: string;
  type: string;
  model: string;
  owner: string;
  location: string;
  status: Asset["status"];
  criticality: Asset["criticality"];
  updated_at: string;
  tenants: { name: string } | null;
};

type ActivityRow = {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  occurred_at: string;
};

type HardwareHistoryRow = {
  id: string;
  tenant_id: string;
  asset_id: string;
  event_type: HardwareHistory["eventType"];
  hardware_key: HardwareHistory["hardwareKey"];
  old_value: string | null;
  new_value: string;
  observed_at: string;
  assets: { tag: string } | null;
};

type TenantSummaryRow = {
  tenant_id: string;
  units: number;
  assets: number;
  pending: number;
};

export type InventoryDashboardData = {
  tenants: Tenant[];
  assets: Asset[];
  activities: Activity[];
  hardwareHistory: HardwareHistory[];
  source: "supabase" | "mock";
};

export async function getInventoryDashboard(
  filters: AssetFilters = {},
): Promise<InventoryDashboardData> {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    return getMockDashboard(filters);
  }

  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return getMockDashboard(filters);
  }

  let assetsQuery = supabase
    .from("assets")
    .select(
      "id, tag, tenant_id, type, model, owner, location, status, criticality, updated_at, tenants(name)",
    )
    .order("updated_at", { ascending: false })
    .limit(25);

  if (filters.tenantId) {
    assetsQuery = assetsQuery.eq("tenant_id", filters.tenantId);
  }

  if (filters.status) {
    assetsQuery = assetsQuery.eq("status", filters.status);
  }

  if (filters.query) {
    const query = filters.query.replaceAll("%", "").replaceAll(",", " ");
    assetsQuery = assetsQuery.or(
      `tag.ilike.%${query}%,model.ilike.%${query}%,owner.ilike.%${query}%,type.ilike.%${query}%`,
    );
  }

  const tenantsResult = await supabase
    .from("tenants")
    .select("id, slug, name, segment, compliance, logo_url")
    .order("name");
  const fallbackTenantsResult = isMissingSchemaError(tenantsResult.error)
    ? await supabase
        .from("tenants")
        .select("id, name, segment, compliance")
        .order("name")
    : null;
  const minimalTenantsResult = isMissingSchemaError(fallbackTenantsResult?.error)
    ? await supabase.from("tenants").select("id, name").order("name")
    : null;

  const [assetsResult, activitiesResult, hardwareHistoryResult, summariesResult] = await Promise.all([
    assetsQuery,
    supabase
      .from("activities")
      .select("id, tenant_id, title, description, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase
      .from("hardware_history")
      .select("id, tenant_id, asset_id, event_type, hardware_key, old_value, new_value, observed_at, assets(tag)")
      .order("observed_at", { ascending: false })
      .limit(8),
    supabase.rpc("get_tenant_summaries"),
  ]);

  if (
    tenantsResult.error &&
    !fallbackTenantsResult &&
    !minimalTenantsResult
  ) {
    // Falha real: não existe nenhum caminho de leitura para tenants.
    console.error("Supabase inventory query failed", {
      tenants: tenantsResult.error,
    });

    return {
      tenants: [],
      assets: [],
      activities: [],
      hardwareHistory: [],
      source: "supabase",
    };
  }

  if (fallbackTenantsResult?.error && !minimalTenantsResult) {
    // Cenário esperado durante rollout de schema/migrations.
    // Evita poluir logs.
  }

  if (minimalTenantsResult?.error) {
    // Cenário esperado durante rollout de schema/migrations.
    // Evita poluir logs.
  }



  const summaries = new Map(
    ((summariesResult.error ? [] : summariesResult.data) as TenantSummaryRow[]).map((summary) => [
      summary.tenant_id,
      summary,
    ]),
  );

  const tenantRows = (minimalTenantsResult?.data ??
    fallbackTenantsResult?.data ??
    tenantsResult.data ??
    []) as TenantRow[];
  const assetRows = (isMissingSchemaError(assetsResult.error)
    ? []
    : (assetsResult.data ?? [])) as AssetRow[];
  const activityRows = (isMissingSchemaError(activitiesResult.error)
    ? []
    : (activitiesResult.data ?? [])) as ActivityRow[];
  const hardwareHistoryRows = (isMissingSchemaError(hardwareHistoryResult.error)
    ? []
    : (hardwareHistoryResult.data ?? [])) as HardwareHistoryRow[];

  if (assetsResult.error && !isMissingSchemaError(assetsResult.error)) {
    console.error("Supabase assets query failed", assetsResult.error);
  }

  if (activitiesResult.error && !isMissingSchemaError(activitiesResult.error)) {
    console.error("Supabase activities query failed", activitiesResult.error);
  }

  if (hardwareHistoryResult.error && !isMissingSchemaError(hardwareHistoryResult.error)) {
    console.error("Supabase hardware history query failed", hardwareHistoryResult.error);
  }

  if (summariesResult.error && !isMissingSchemaError(summariesResult.error)) {
    console.error("Supabase tenant summaries query failed", summariesResult.error);
  }


  const tenants = tenantRows.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    segment: tenant.segment ?? "Sem segmento",
    logoUrl: tenant.logo_url ?? null,
    units: summaries.get(tenant.id)?.units ?? 0,
    assets: summaries.get(tenant.id)?.assets ?? 0,
    pending: summaries.get(tenant.id)?.pending ?? 0,
    compliance: tenant.compliance ?? 0,
  }));

  const assets = assetRows.map((asset) => ({
    id: asset.id,
    tag: asset.tag,
    tenantId: asset.tenant_id,
    tenantName: asset.tenants?.name ?? asset.tenant_id,
    type: asset.type,
    model: asset.model,
    owner: asset.owner,
    location: asset.location,
    status: asset.status,
    criticality: asset.criticality,
    updatedAt: formatDate(asset.updated_at),
  }));

  const activities = activityRows.map(
    (activity) => ({
      id: activity.id,
      tenantId: activity.tenant_id,
      title: activity.title,
      description: activity.description,
      time: formatActivityTime(activity.occurred_at),
    }),
  );
  const hardwareHistory = hardwareHistoryRows.map((event) => ({
    id: event.id,
    tenantId: event.tenant_id,
    assetId: event.asset_id,
    assetTag: event.assets?.tag ?? event.asset_id,
    eventType: event.event_type,
    hardwareKey: event.hardware_key,
    oldValue: event.old_value,
    newValue: event.new_value,
    observedAt: formatActivityTime(event.observed_at),
  }));

  return {
    tenants,
    assets,
    activities,
    hardwareHistory,
    source: "supabase",
  };
}

function isMissingSchemaError(error: { message: string } | null | undefined) {
  return Boolean(
    error?.message.includes("does not exist") ||
      error?.message.includes("Could not find") ||
      error?.message.includes("schema cache"),
  );
}

type AgentHeartbeatRow = {
  id: string;
  tenant_id: string;
  asset_id: string;
  device_id: string;
  hostname: string;
  ip_address: string | null;
  status: string;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
  last_heartbeat_at: string;
  updated_at: string;
};

export type AgentStatus = {
  assetId: string;
  deviceId: string;
  hostname: string;
  status: "online" | "idle" | "offline";
  lastHeartbeat: string;
  minutesSinceHeartbeat: number;
  cpuUsage: number | null;
  memoryUsage: number | null;
  ipAddress: string | null;
};

export async function getAgentStatuses(tenantId: string): Promise<AgentStatus[]> {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("agent_heartbeats")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch agent heartbeats:", error);
    return [];
  }

  const now = new Date();
  
  return ((data as AgentHeartbeatRow[]) || []).map((row) => {
    const lastHeartbeat = new Date(row.last_heartbeat_at);
    const minutesSince = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 60000);
    
    let status: "online" | "idle" | "offline";
    if (minutesSince <= 10) {
      status = "online";
    } else if (minutesSince <= 60) {
      status = "idle";
    } else {
      status = "offline";
    }

    return {
      assetId: row.asset_id,
      deviceId: row.device_id,
      hostname: row.hostname,
      status,
      lastHeartbeat: formatActivityTime(row.last_heartbeat_at),
      minutesSinceHeartbeat: minutesSince,
      cpuUsage: row.cpu_usage_percent,
      memoryUsage: row.memory_usage_percent,
      ipAddress: row.ip_address,
    };
  });
}

export async function getAgentStatus(assetId: string): Promise<AgentStatus | null> {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("agent_heartbeats")
    .select("*")
    .eq("asset_id", assetId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as AgentHeartbeatRow;
  const now = new Date();
  const lastHeartbeat = new Date(row.last_heartbeat_at);
  const minutesSince = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 60000);
  
  let status: "online" | "idle" | "offline";
  if (minutesSince <= 10) {
    status = "online";
  } else if (minutesSince <= 60) {
    status = "idle";
  } else {
    status = "offline";
  }

  return {
    assetId: row.asset_id,
    deviceId: row.device_id,
    hostname: row.hostname,
    status,
    lastHeartbeat: formatActivityTime(row.last_heartbeat_at),
    minutesSinceHeartbeat: minutesSince,
    cpuUsage: row.cpu_usage_percent,
    memoryUsage: row.memory_usage_percent,
    ipAddress: row.ip_address,
  };
}

function getMockDashboard(filters: AssetFilters = {}): InventoryDashboardData {
  const filteredAssets = mockAssets.filter((asset) => {
    const matchesTenant = filters.tenantId
      ? asset.tenantId === filters.tenantId
      : true;
    const matchesStatus = filters.status ? asset.status === filters.status : true;
    const query = filters.query?.toLowerCase();
    const matchesQuery = query
      ? [asset.tag, asset.model, asset.owner, asset.type]
          .join(" ")
          .toLowerCase()
          .includes(query)
      : true;

    return matchesTenant && matchesStatus && matchesQuery;
  });

  return {
    tenants: mockTenants,
    assets: filteredAssets,
    activities: mockActivities,
    hardwareHistory: [],
    source: "mock",
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(date);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
