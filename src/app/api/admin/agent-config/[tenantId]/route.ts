import { createAdminSupabaseClient, requireGlobalAdmin } from "@/lib/supabase-server";
import { createHash, randomUUID } from "node:crypto";

type TenantAgentRow = {
  id: string;
  slug: string | null;
  name: string;
  agent_api_key: string | null;
  agent_api_key_hash: string | null;
};

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getAppOrigin(request: Request) {
  const configuredOrigin =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  const allowHttp = process.env.ALLOW_HTTP === "true" || process.env.NODE_ENV === "development";

  if (configuredOrigin?.trim()) {
    const trimmed = configuredOrigin.trim().replace(/\/+$/, "");
    try {
      const u = new URL(trimmed);
      if (!allowHttp && u.protocol === "http:") {
        u.protocol = "https:";
        return u.toString().replace(/\/+$/, "");
      }
      return trimmed;
    } catch (err) {
      return trimmed;
    }
  }

  const reqOrigin = new URL(request.url).origin;
  if (!allowHttp) {
    return reqOrigin.replace(/^http:/, "https:");
  }
  return reqOrigin;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  await requireGlobalAdmin();

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada." },
      { status: 500 },
    );
  }

  const { tenantId } = await params;
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, agent_api_key, agent_api_key_hash")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Empresa nao encontrada." },
      { status: 404 },
    );
  }

  const tenant = data as TenantAgentRow;

  if (!tenant.slug) {
    return Response.json(
      { error: "Empresa sem slug." },
      { status: 400 },
    );
  }

  let plaintextKey: string | null = null;

  if (tenant.agent_api_key) {
    plaintextKey = tenant.agent_api_key;
  } else if (tenant.agent_api_key_hash) {
    // Rotate and give admin a fresh key to download the config
    plaintextKey = `agt_${randomUUID().replaceAll("-", "")}`;
    const newHash = createHash("sha256").update(plaintextKey).digest("hex");
    await supabase.from("tenants").update({ agent_api_key_hash: newHash }).eq("id", tenantId);
  } else {
    plaintextKey = `agt_${randomUUID().replaceAll("-", "")}`;
    const newHash = createHash("sha256").update(plaintextKey).digest("hex");
    await supabase.from("tenants").update({ agent_api_key_hash: newHash }).eq("id", tenantId);
  }

  const config = {
    endpoint: `${getAppOrigin(request)}/api/agent/checkin`,
    heartbeat_endpoint: `${getAppOrigin(request)}/api/agent/heartbeat`,
    update_endpoint: `${getAppOrigin(request)}/api/agent/update`,
    tenant_slug: tenant.slug,
    api_key: plaintextKey,
    heartbeat_minutes: 5,
    inventory_hours: 12,
    update_minutes: 60,
    interval_minutes: 10,
    service_name: "InventarioTIAgent",
  };
  const body = JSON.stringify(config, null, 2);
  const fileName = `${safeFileName(tenant.name) || "empresa"}-agent-config.json`;

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}
