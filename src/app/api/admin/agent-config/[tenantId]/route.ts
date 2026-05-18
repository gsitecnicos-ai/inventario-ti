import { createAdminSupabaseClient, requireGlobalAdmin } from "@/lib/supabase-server";

type TenantAgentRow = {
  id: string;
  slug: string | null;
  name: string;
  agent_api_key: string | null;
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

  if (configuredOrigin?.trim()) {
    return configuredOrigin.trim().replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
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
    .select("id, slug, name, agent_api_key")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message ?? "Empresa nao encontrada." },
      { status: 404 },
    );
  }

  const tenant = data as TenantAgentRow;

  if (!tenant.slug || !tenant.agent_api_key) {
    return Response.json(
      { error: "Empresa sem slug ou chave do agente." },
      { status: 400 },
    );
  }

  const config = {
    endpoint: `${getAppOrigin(request)}/api/agent/checkin`,
    tenant_slug: tenant.slug,
    api_key: tenant.agent_api_key,
    interval_minutes: 10,
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
