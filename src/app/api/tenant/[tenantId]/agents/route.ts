import { createAdminSupabaseClient } from "@/lib/supabase-server";

type AgentStatusSummaryRow = {
  asset_id: string;
  device_id: string;
  hostname: string;
  status: string;
  last_seen_at: string;
  minutes_since_heartbeat: number;
  cpu_usage_percent: number | null;
  memory_usage_percent: number | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada." },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "online";

  try {
    let query = supabase
      .from("agent_status_summary")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("last_heartbeat_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const agents = ((data || []) as AgentStatusSummaryRow[]).map((row) => ({
      assetId: row.asset_id,
      deviceId: row.device_id,
      hostname: row.hostname,
      status: row.status,
      lastHeartbeat: row.last_seen_at,
      minutesSinceHeartbeat: row.minutes_since_heartbeat,
      cpuUsage: row.cpu_usage_percent,
      memoryUsage: row.memory_usage_percent,
      ipAddress: null,
    }));

    return Response.json({ agents });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return Response.json(
      { error: "Falha ao buscar agentes." },
      { status: 500 },
    );
  }
}
