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

export type AdminDashboardData = {
  tenants: AdminTenant[];
  members: AdminTenantMember[];
  globalAdmins: AdminGlobalAdmin[];
};

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
        .select("id, slug, name, segment, compliance")
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

  if (tenantsResult.error) {
    throw new Error(tenantsResult.error.message);
  }

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  if (globalAdminsResult.error) {
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

  return {
    tenants: tenantsResult.data,
    members: membersResult.data.map((member) => ({
      tenantId: member.tenant_id,
      userId: member.user_id,
      email: usersById.get(member.user_id) ?? member.user_id,
      role: member.role as TenantRole,
      createdAt: member.created_at,
    })),
    globalAdmins: globalAdminsResult.data.map((admin) => ({
      userId: admin.user_id,
      email: usersById.get(admin.user_id) ?? admin.user_id,
      createdAt: admin.created_at,
    })),
  };
}
