"use server";

import { redirect } from "next/navigation";
import { createAdminSupabaseClient, requireGlobalAdmin, getCurrentAccess } from "@/lib/supabase-server";

export async function createComplianceRule(
  tenantId: string,
  data: {
    ruleType: string;
    name: string;
    description?: string;
    severity: string;
    enabled: boolean;
    parameters?: Record<string, any>;
  }
) {
  await requireGlobalAdmin();

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase nao configurado");
  }

  const { error } = await supabase.from("compliance_rules").insert({
    tenant_id: tenantId,
    rule_type: data.ruleType,
    name: data.name,
    description: data.description,
    severity: data.severity,
    enabled: data.enabled,
    parameters: data.parameters,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateComplianceRule(
  ruleId: string,
  data: {
    name?: string;
    description?: string;
    severity?: string;
    enabled?: boolean;
    parameters?: Record<string, any>;
  }
) {
  await requireGlobalAdmin();

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase nao configurado");
  }

  const { error } = await supabase
    .from("compliance_rules")
    .update(data)
    .eq("id", ruleId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteComplianceRule(ruleId: string) {
  await requireGlobalAdmin();

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase nao configurado");
  }

  const { error } = await supabase.from("compliance_rules").delete().eq("id", ruleId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getComplianceRules(tenantId: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase nao configurado");
  }

  const { data, error } = await supabase
    .from("compliance_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}
