import "server-only";

import {
  activities as mockActivities,
  assets as mockAssets,
  tenants as mockTenants,
  type Activity,
  type Asset,
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

  const [assetsResult, activitiesResult, summariesResult] = await Promise.all([
    assetsQuery,
    supabase
      .from("activities")
      .select("id, tenant_id, title, description, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(10),
    supabase.rpc("get_tenant_summaries"),
  ]);

  if (
    tenantsResult.error &&
    !fallbackTenantsResult &&
    !minimalTenantsResult
  ) {
    console.error("Supabase inventory query failed", {
      tenants: tenantsResult.error,
    });

    return {
      tenants: [],
      assets: [],
      activities: [],
      source: "supabase",
    };
  }

  if (fallbackTenantsResult?.error && !minimalTenantsResult) {
    console.error("Supabase tenants fallback query failed", {
      tenants: fallbackTenantsResult.error,
    });
  }

  if (minimalTenantsResult?.error) {
    console.error("Supabase tenants minimal query failed", {
      tenants: minimalTenantsResult.error,
    });
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

  if (assetsResult.error && !isMissingSchemaError(assetsResult.error)) {
    console.error("Supabase assets query failed", assetsResult.error);
  }

  if (activitiesResult.error && !isMissingSchemaError(activitiesResult.error)) {
    console.error("Supabase activities query failed", activitiesResult.error);
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

  return {
    tenants,
    assets,
    activities,
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
