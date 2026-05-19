import { createAdminSupabaseClient } from "@/lib/supabase-server";

type AlertRow = {
  id: string;
  tenant_id: string;
  asset_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  device_id: string | null;
  hostname: string | null;
  detected_at: string;
  resolved_at: string | null;
  metadata: any;
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
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const severity = url.searchParams.get("severity") || "all";
  const resolved = url.searchParams.get("resolved") || "false"; // "true" | "false" | "all"

  try {
    let query = supabase
      .from("alerts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("detected_at", { ascending: false });

    if (severity !== "all") {
      query = query.eq("severity", severity);
    }

    if (resolved === "false") {
      query = query.is("resolved_at", null);
    } else if (resolved === "true") {
      query = query.not("resolved_at", "is", null);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const alerts = ((data || []) as AlertRow[]).map((row) => ({
      id: row.id,
      alertType: row.alert_type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      deviceId: row.device_id,
      hostname: row.hostname,
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at,
      minutesSinceDetection: row.resolved_at
        ? null
        : Math.floor(
            (Date.now() - new Date(row.detected_at).getTime()) / 60000
          ),
    }));

    const stats = {
      total: alerts.length,
      active: alerts.filter((a) => !a.resolvedAt).length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      high: alerts.filter((a) => a.severity === "high").length,
    };

    return Response.json({ alerts, stats });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return Response.json(
      { error: "Falha ao buscar alertas." },
      { status: 500 }
    );
  }
}
