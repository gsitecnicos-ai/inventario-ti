"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAdminSupabaseClient,
  createAuthenticatedSupabaseClient,
  getCurrentAccess,
  requireGlobalAdmin,
} from "@/lib/supabase-server";
import {
  assetCriticalities,
  assetStatuses,
  type AssetCriticality,
  type AssetStatus,
} from "@/lib/inventory-data";
import { tenantRoles, type TenantRole } from "@/lib/admin-repository";

function createAgentApiKey() {
  return `agt_${randomUUID().replaceAll("-", "")}`;
}

function redirectWithMessage(
  path: string,
  type: "success" | "error",
  message: string,
): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

function isMissingSchemaError(error: { message: string } | null | undefined) {
  return Boolean(
    error?.message.includes("does not exist") ||
      error?.message.includes("Could not find") ||
      error?.message.includes("schema cache"),
  );
}

function getTenantMembersSchemaErrorMessage() {
  return "O usuario foi salvo no login, mas a tabela tenant_members ainda nao esta pronta no Supabase. Rode supabase/migrations/004_repair_admin_schema.sql no SQL Editor para habilitar permissoes por empresa.";
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Campo obrigatorio ausente: ${key}`);
  }

  return value.trim();
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

async function readOptionalImageDataUrl(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  if (!value.type.startsWith("image/")) {
    throw new Error("A logo precisa ser um arquivo de imagem.");
  }

  if (value.size > 500 * 1024) {
    throw new Error("A logo precisa ter no maximo 500 KB.");
  }

  const buffer = Buffer.from(await value.arrayBuffer());

  return `data:${value.type};base64,${buffer.toString("base64")}`;
}

function readAssetStatus(formData: FormData) {
  const status = readRequiredString(formData, "status") as AssetStatus;

  if (!assetStatuses.includes(status)) {
    throw new Error("Status invalido.");
  }

  return status;
}

function readAssetCriticality(formData: FormData) {
  const criticality = readRequiredString(
    formData,
    "criticality",
  ) as AssetCriticality;

  if (!assetCriticalities.includes(criticality)) {
    throw new Error("Criticidade invalida.");
  }

  return criticality;
}

function readTenantRole(formData: FormData) {
  const role = readRequiredString(formData, "role") as TenantRole;

  if (!tenantRoles.includes(role)) {
    throw new Error("Perfil invalido.");
  }

  return role;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getSupabaseForGlobalAdmin() {
  await requireGlobalAdmin();

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY nao configurada.");
  }

  return supabase;
}

async function getSignedInRedirectPath() {
  const access = await getCurrentAccess();

  return access.isGlobalAdmin ? "/admin/users" : "/dashboard";
}

async function getUserIdByEmail(email: string) {
  const supabase = await getSupabaseForGlobalAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  const user = data.users.find(
    (authUser) => authUser.email?.toLowerCase() === normalizedEmail,
  );

  if (!user) {
    throw new Error("Usuario nao encontrado no Supabase Auth.");
  }

  return user.id;
}

async function findUserIdByEmail(email: string) {
  const supabase = await getSupabaseForGlobalAdmin();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (
    data.users.find(
      (authUser) => authUser.email?.toLowerCase() === normalizedEmail,
    )?.id ?? null
  );
}

async function getSupabaseForMutation() {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase nao configurado para gravacao.");
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Voce precisa estar autenticado.");
  }

  const { data: canManageAssets } = await supabase.rpc("can_manage_assets");

  if (!canManageAssets) {
    throw new Error("Seu usuario nao tem permissao para gerenciar ativos.");
  }

  return supabase;
}

export async function signIn(formData: FormData) {
  try {
    const supabase = await createAuthenticatedSupabaseClient();

    if (!supabase) {
      throw new Error("Supabase nao configurado.");
    }

    const email = readRequiredString(formData, "email");
    const password = readRequiredString(formData, "password");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/login", "error", getErrorMessage(error));
  }

  const redirectPath = await getSignedInRedirectPath();

  revalidatePath(redirectPath);
  redirectWithMessage(redirectPath, "success", "Login realizado.");
}

export async function signOut() {
  const supabase = await createAuthenticatedSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/login", "success", "Sessao encerrada.");
}

export async function createAsset(formData: FormData) {
  try {
    const supabase = await getSupabaseForMutation();
    const tenantId = readRequiredString(formData, "tenantId");
    const tag = readRequiredString(formData, "tag").toUpperCase();
    const type = readRequiredString(formData, "type");
    const model = readRequiredString(formData, "model");
    const owner = readRequiredString(formData, "owner");
    const location = readRequiredString(formData, "location");
    const status = readAssetStatus(formData);
    const criticality = readAssetCriticality(formData);

    const { data, error } = await supabase
      .from("assets")
      .insert({
        tenant_id: tenantId,
        tag,
        type,
        model,
        owner,
        location,
        status,
        criticality,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activities").insert({
      tenant_id: tenantId,
      asset_id: data.id,
      title: "Ativo cadastrado",
      description: `${tag} cadastrado no inventario.`,
    });
  } catch (error) {
    redirectWithMessage("/dashboard", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  redirectWithMessage("/dashboard", "success", "Ativo cadastrado.");
}

export async function updateAsset(formData: FormData) {
  try {
    const supabase = await getSupabaseForMutation();
    const assetId = readRequiredString(formData, "assetId");
    const status = readAssetStatus(formData);
    const criticality = readAssetCriticality(formData);

    const { data: asset, error: readError } = await supabase
      .from("assets")
      .select("id, tenant_id, tag")
      .eq("id", assetId)
      .single();

    if (readError) {
      throw new Error(readError.message);
    }

    const { error } = await supabase
      .from("assets")
      .update({
        status,
        criticality,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activities").insert({
      tenant_id: asset.tenant_id,
      asset_id: asset.id,
      title: "Ativo atualizado",
      description: `${asset.tag} atualizado para ${status} / ${criticality}.`,
    });
  } catch (error) {
    redirectWithMessage("/dashboard", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  redirectWithMessage("/dashboard", "success", "Ativo atualizado.");
}

export async function deleteAsset(formData: FormData) {
  try {
    const supabase = await getSupabaseForMutation();
    const assetId = readRequiredString(formData, "assetId");

    const { data: asset, error: readError } = await supabase
      .from("assets")
      .select("id, tenant_id, tag")
      .eq("id", assetId)
      .single();

    if (readError) {
      throw new Error(readError.message);
    }

    const { error } = await supabase.from("assets").delete().eq("id", assetId);

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activities").insert({
      tenant_id: asset.tenant_id,
      title: "Ativo removido",
      description: `${asset.tag} removido do inventario.`,
    });
  } catch (error) {
    redirectWithMessage("/dashboard", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  redirectWithMessage("/dashboard", "success", "Ativo removido.");
}

export async function createTenant(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const name = readRequiredString(formData, "name");
    const segment = readRequiredString(formData, "segment");
    const agentApiKey =
      readOptionalString(formData, "agentApiKey") ?? createAgentApiKey();
    const logoUrl = await readOptionalImageDataUrl(formData, "logoFile");
    const providedSlug = formData.get("slug");
    const slug =
      typeof providedSlug === "string" && providedSlug.trim()
        ? slugify(providedSlug)
        : slugify(name);
    const complianceValue = Number(formData.get("compliance") ?? 0);
    const compliance = Number.isFinite(complianceValue)
      ? Math.max(0, Math.min(100, Math.round(complianceValue)))
      : 0;

    if (!slug) {
      throw new Error("Slug invalido.");
    }

    const { error } = await supabase.from("tenants").insert({
      name,
      slug,
      segment,
      compliance,
      cnpj: readOptionalString(formData, "cnpj"),
      contact_name: readOptionalString(formData, "contactName"),
      contact_email: readOptionalString(formData, "contactEmail"),
      contact_phone: readOptionalString(formData, "contactPhone"),
      address_line: readOptionalString(formData, "addressLine"),
      city: readOptionalString(formData, "city"),
      state: readOptionalString(formData, "state"),
      postal_code: readOptionalString(formData, "postalCode"),
      logo_url: logoUrl,
      agent_api_key: agentApiKey,
    });

    if (isMissingSchemaError(error)) {
      const { error: fallbackError } = await supabase
        .from("tenants")
        .insert({ name, segment, compliance } as never);

      if (isMissingSchemaError(fallbackError)) {
        const { error: minimalError } = await supabase
          .from("tenants")
          .insert({ name } as never);

        if (minimalError) {
          throw new Error(minimalError.message);
        }
      } else if (fallbackError) {
        throw new Error(fallbackError.message);
      }
    } else if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Tenant criado.");
}

export async function deleteTenant(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const tenantId = readRequiredString(formData, "tenantId");
    const { error } = await supabase.from("tenants").delete().eq("id", tenantId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Empresa excluida.");
}

export async function createManagedUser(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const email = readRequiredString(formData, "email").toLowerCase();
    const password = readRequiredString(formData, "password");

    if (password.length < 6) {
      throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    }

    const { error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Usuario criado.");
}

export async function generateTenantAgentKey(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const tenantId = readRequiredString(formData, "tenantId");
    const { error } = await supabase
      .from("tenants")
      .update({ agent_api_key: createAgentApiKey() } as never)
      .eq("id", tenantId);

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(
          "A coluna agent_api_key ainda nao existe. Rode a migration 004_repair_admin_schema.sql no Supabase.",
        );
      }

      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Chave do agente gerada.");
}

export async function addTenantMember(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const tenantId = readRequiredString(formData, "tenantId");
    const email = readRequiredString(formData, "email");
    const role = readTenantRole(formData);
    const userId = await getUserIdByEmail(email);

    const { error } = await supabase.from("tenant_members").upsert({
      tenant_id: tenantId,
      user_id: userId,
      role,
    });

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(getTenantMembersSchemaErrorMessage());
      }

      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Usuario vinculado ao tenant.");
}

export async function createTenantUser(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const tenantId = readRequiredString(formData, "tenantId");
    const email = readRequiredString(formData, "email").toLowerCase();
    const password = readOptionalString(formData, "password");
    const role = readTenantRole(formData);
    let userId = await findUserIdByEmail(email);

    if (password && password.length < 6) {
      throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    }

    if (!userId) {
      if (!password) {
        throw new Error("Informe uma senha temporaria para novo usuario.");
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) {
        throw new Error(error.message);
      }

      userId = data.user.id;
    } else if (password) {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    const { error } = await supabase.from("tenant_members").upsert({
      tenant_id: tenantId,
      user_id: userId,
      role,
    });

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(getTenantMembersSchemaErrorMessage());
      }

      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Usuario salvo na empresa.");
}

export async function updateTenantMemberRole(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const tenantId = readRequiredString(formData, "tenantId");
    const userId = readRequiredString(formData, "userId");
    const role = readTenantRole(formData);

    const { error } = await supabase
      .from("tenant_members")
      .update({ role })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Perfil atualizado.");
}

export async function removeTenantMember(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const tenantId = readRequiredString(formData, "tenantId");
    const userId = readRequiredString(formData, "userId");

    const { error } = await supabase
      .from("tenant_members")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Usuario removido do tenant.");
}

export async function addGlobalAdmin(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const email = readRequiredString(formData, "email");
    const userId = await getUserIdByEmail(email);

    const { error } = await supabase
      .from("global_admins")
      .insert({ user_id: userId });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Admin global promovido.");
}

export async function removeGlobalAdmin(formData: FormData) {
  try {
    const supabase = await getSupabaseForGlobalAdmin();
    const userId = readRequiredString(formData, "userId");

    const { error } = await supabase
      .from("global_admins")
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    redirectWithMessage("/admin/users", "error", getErrorMessage(error));
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/users");
  redirectWithMessage("/admin/users", "success", "Admin global removido.");
}
