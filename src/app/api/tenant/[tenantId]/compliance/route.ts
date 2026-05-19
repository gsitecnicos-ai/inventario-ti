import { createAdminSupabaseClient } from "@/lib/supabase-server";

type ComplianceStatusRow = {
  asset_id: string;
  compliance_score: number;
  violations_count: number;
  critical_violations: number;
  has_antivirus: boolean;
  windows_updated: boolean | null;
  forbidden_software_found: string[] | null;
  last_check_at: string;
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

  try {
    // Buscar status de compliance por asset
    const { data: statuses, error: statusError } = await supabase
      .from("device_compliance_status")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("compliance_score", { ascending: true });

    if (statusError) {
      return Response.json({ error: statusError.message }, { status: 500 });
    }

    const complianceData = ((statuses || []) as ComplianceStatusRow[]).map((row) => ({
      assetId: row.asset_id,
      score: row.compliance_score,
      violations: row.violations_count,
      criticalViolations: row.critical_violations,
      hasAntivirus: row.has_antivirus,
      windowsUpdated: row.windows_updated,
      forbiddenSoftware: row.forbidden_software_found || [],
    }));

    // Calcular resumo
    const avgScore =
      complianceData.length > 0
        ? Math.round(
            complianceData.reduce((sum, d) => sum + d.score, 0) /
              complianceData.length
          )
        : 100;

    const compliantCount = complianceData.filter((d) => d.score === 100).length;
    const criticalCount = complianceData.filter((d) => d.criticalViolations > 0).length;
    const avCount = complianceData.filter((d) => d.hasAntivirus).length;

    const summary = {
      totalDevices: complianceData.length,
      averageScore: avgScore,
      compliantDevices: compliantCount,
      devicesWithCriticalViolations: criticalCount,
      devicesWithAntivirus: avCount,
      devicesWithoutAntivirus: complianceData.length - avCount,
    };

    return Response.json({
      summary,
      devices: complianceData,
    });
  } catch (error) {
    console.error("Error fetching compliance:", error);
    return Response.json(
      { error: "Falha ao buscar compliance." },
      { status: 500 }
    );
  }
}
