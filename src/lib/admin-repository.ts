import "server-only";

import { createAdminSupabaseClient, getCurrentAccess } from "./supabase-server";

export const tenantRoles = ["owner", "admin", "operator", "viewer"] as const;

export type TenantRole = (typeof tenantRoles)[number];

export type AdminTenant = {
  id: string;
  slug: string;
  name: string;
  segment: string;
  compliance: number;
  cnpj: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  logoUrl: string | null;
  hasAgentApiKey: boolean;
  agentApiKey: string | null;
};

export type AdminTenantMember = {
  tenantId: string;
  userId: string;
  email: string;
  role: TenantRole;
  createdAt: string;
};

export type AdminGlobalAdmin = {
  userId: string;
  email: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AdminDashboardData = {
  tenants: AdminTenant[];
  members: AdminTenantMember[];
  globalAdmins: AdminGlobalAdmin[];
  users: AdminUser[];
};

function isMissingColumnError(error: { message: string } | null | undefined) {
  return Boolean(error?.message.includes("does not exist"));
}

function isMissingTableError(error: { message: string } | null | undefined) {
  return Boolean(error?.message.includes("Could not find the table"));
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const access = await getCurrentAccess();

  if (!access.isGlobalAdmin) {
    throw new Error("Acesso restrito a administradores globais.");
  }

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY nao configurada.");
  }

  const [tenantsResult, membersResult, globalAdminsResult, usersResult] =
    await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id, slug, name, segment, compliance, cnpj, contact_name, contact_email, contact_phone, address_line, city, state, postal_code, logo_url, agent_api_key",
        )
        .order("name"),
      supabase
        .from("tenant_members")
        .select("tenant_id, user_id, role, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("global_admins")
        .select("user_id, created_at")
        .order("created_at", { ascending: false }),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
  const membersUnavailable = isMissingTableError(membersResult.error);
  const fallbackMembersResult =
    !membersUnavailable && isMissingColumnError(membersResult.error)
    ? await supabase.from("tenant_members").select("tenant_id, user_id, role")
    : null;

  const tenantsMissingNewColumns = isMissingColumnError(tenantsResult.error);
  const fallbackTenantsResult = tenantsMissingNewColumns
    ? await supabase
        .from("tenants")
        .select("id, name, segment, compliance")
        .order("name")
    : null;
  const minimalTenantsResult = isMissingColumnError(fallbackTenantsResult?.error)
    ? await supabase.from("tenants").select("id, name").order("name")
    : null;

  if (tenantsResult.error && !fallbackTenantsResult && !minimalTenantsResult) {
    throw new Error(tenantsResult.error.message);
  }

  if (fallbackTenantsResult?.error && !minimalTenantsResult) {
    throw new Error(fallbackTenantsResult.error.message);
  }

  if (minimalTenantsResult?.error) {
    throw new Error(minimalTenantsResult.error.message);
  }

  if (membersResult.error && !fallbackMembersResult && !membersUnavailable) {
    throw new Error(membersResult.error.message);
  }

  if (fallbackMembersResult?.error) {
    throw new Error(fallbackMembersResult.error.message);
  }

  const globalAdminsUnavailable = Boolean(
    globalAdminsResult.error?.message.includes("global_admins"),
  );

  if (globalAdminsResult.error && !globalAdminsUnavailable) {
    throw new Error(globalAdminsResult.error.message);
  }

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  const usersById = new Map(
    usersResult.data.users.map((user) => [
      user.id,
      user.email ?? "sem-email",
    ]),
  );

  const tenantRows = minimalTenantsResult
    ? (minimalTenantsResult.data ?? []).map((tenant) => ({
        ...tenant,
        slug: tenant.id,
        segment: "Sem segmento",
        compliance: 0,
        cnpj: null,
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        address_line: null,
        city: null,
        state: null,
        postal_code: null,
        logo_url: null,
        agent_api_key: null,
      }))
    : tenantsMissingNewColumns
      ? (fallbackTenantsResult?.data ?? []).map((tenant) => ({
        ...tenant,
        slug: tenant.id,
        cnpj: null,
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        address_line: null,
        city: null,
        state: null,
        postal_code: null,
        logo_url: null,
        agent_api_key: null,
      }))
      : (tenantsResult.data ?? []);

  return {
    tenants: tenantRows.map((tenant) => ({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      segment: tenant.segment,
      compliance: tenant.compliance,
      cnpj: tenant.cnpj,
      contactName: tenant.contact_name,
      contactEmail: tenant.contact_email,
      contactPhone: tenant.contact_phone,
      addressLine: tenant.address_line,
      city: tenant.city,
      state: tenant.state,
      postalCode: tenant.postal_code,
      logoUrl: tenant.logo_url,
      hasAgentApiKey: Boolean(tenant.agent_api_key),
      agentApiKey: tenant.agent_api_key,
    })),
    users: usersResult.data.users.map((user) => ({
      id: user.id,
      email: user.email ?? "sem-email",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
    })),
    members: (
      membersUnavailable
        ? []
        : (fallbackMembersResult?.data ?? membersResult.data ?? [])
    ).map((member) => ({
        tenantId: member.tenant_id,
        userId: member.user_id,
        email: usersById.get(member.user_id) ?? member.user_id,
        role: member.role as TenantRole,
        createdAt:
          "created_at" in member && typeof member.created_at === "string"
            ? member.created_at
            : new Date().toISOString(),
      })),
    globalAdmins: globalAdminsUnavailable
      ? [
          {
            userId: access.user?.id ?? "bootstrap",
            email: access.user?.email ?? "admin bootstrap",
            createdAt: new Date().toISOString(),
          },
        ]
      : (globalAdminsResult.data ?? []).map((admin) => ({
          userId: admin.user_id,
          email: usersById.get(admin.user_id) ?? admin.user_id,
          createdAt: admin.created_at,
        })),
  };
}
