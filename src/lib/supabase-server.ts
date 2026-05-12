import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bootstrapGlobalAdminEmails = process.env.BOOTSTRAP_GLOBAL_ADMIN_EMAILS;

function isBootstrapGlobalAdmin(email?: string | null) {
  if (!email || !bootstrapGlobalAdminEmails) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();

  return bootstrapGlobalAdminEmails
    .split(",")
    .map((adminEmail) => adminEmail.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizedEmail);
}

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && (publishableKey || serviceRoleKey));
}

export async function createAuthenticatedSupabaseClient() {
  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read but not always write cookies.
        }
      },
    },
  });
}

export function createAdminSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function getCurrentUser() {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

export async function getCurrentAccess() {
  const supabase = await createAuthenticatedSupabaseClient();

  if (!supabase) {
    return {
      user: null,
      isGlobalAdmin: false,
      canManageAssets: false,
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return {
      user: null,
      isGlobalAdmin: false,
      canManageAssets: false,
    };
  }

  const [globalAdminResult, manageAssetsResult] = await Promise.all([
    supabase.rpc("is_global_admin"),
    supabase.rpc("can_manage_assets"),
  ]);
  const isBootstrapAdmin = isBootstrapGlobalAdmin(userData.user.email);
  const isGlobalAdmin = Boolean(globalAdminResult.data || isBootstrapAdmin);

  return {
    user: userData.user,
    isGlobalAdmin,
    canManageAssets: Boolean(manageAssetsResult.data || isGlobalAdmin),
  };
}

export async function requireGlobalAdmin() {
  const access = await getCurrentAccess();

  if (!access.user) {
    throw new Error("Voce precisa estar autenticado.");
  }

  if (!access.isGlobalAdmin) {
    throw new Error("Acesso restrito a administradores globais.");
  }

  return access;
}
