// Serviço para gerar alertas automáticos baseado em heartbeat e compliance
import type { SupabaseClient } from "@supabase/supabase-js";

const AGENT_VERSION = "0.3.0";
const MIN_AGENT_VERSION = "0.2.0"; // Alertar se estiver abaixo disso

export async function generateAlertsFromHeartbeat(
  supabase: SupabaseClient,
  tenantId: string,
  assetId: string,
  deviceId: string,
  hostname: string,
  cpuUsage: number | null,
  memoryUsage: number | null,
  agentVersion?: string
) {
  const alerts: Array<{ type: string; severity: string; title: string; description: string }> = [];

  // Verificar CPU alta (>90%)
  if (cpuUsage !== null && cpuUsage > 90) {
    alerts.push({
      type: "high_cpu_usage",
      severity: "medium",
      title: "CPU em uso alto",
      description: `CPU em ${cpuUsage.toFixed(1)}% - acima de 90%`,
    });
  }

  // Verificar memória alta (>90%)
  if (memoryUsage !== null && memoryUsage > 90) {
    alerts.push({
      type: "high_memory_usage",
      severity: "medium",
      title: "Memória em uso alto",
      description: `Memória em ${memoryUsage.toFixed(1)}% - acima de 90%`,
    });
  }

  // Verificar versão do agente
  if (agentVersion && isOlderVersion(agentVersion, MIN_AGENT_VERSION)) {
    alerts.push({
      type: "agent_outdated",
      severity: "high",
      title: "Agente desatualizado",
      description: `Versão ${agentVersion} é anterior a ${MIN_AGENT_VERSION}`,
    });
  }

  // Inserir alertas no banco
  for (const alert of alerts) {
    try {
      await supabase.from("alerts").insert({
        tenant_id: tenantId,
        asset_id: assetId,
        alert_type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        device_id: deviceId,
        hostname: hostname,
      });
    } catch (err) {
      console.error("Error creating alert:", err);
    }
  }

  return alerts;
}

export async function generateOfflineAlert(
  supabase: SupabaseClient,
  tenantId: string,
  assetId: string,
  deviceId: string,
  hostname: string
) {
  try {
    // Verificar se já existe alerta ativo
    const { data: existing } = await supabase
      .from("alerts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("asset_id", assetId)
      .eq("alert_type", "agent_offline")
      .is("resolved_at", null)
      .limit(1);

    if (!existing || existing.length === 0) {
      await supabase.from("alerts").insert({
        tenant_id: tenantId,
        asset_id: assetId,
        alert_type: "agent_offline",
        severity: "critical",
        title: "Agente offline",
        description: `Agente nao envia heartbeat ha mais de 1 hora`,
        device_id: deviceId,
        hostname: hostname,
      });
    }
  } catch (err) {
    console.error("Error creating offline alert:", err);
  }
}

export async function resolveAlert(
  supabase: SupabaseClient,
  tenantId: string,
  assetId: string,
  alertType: string
) {
  try {
    await supabase
      .from("alerts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("asset_id", assetId)
      .eq("alert_type", alertType)
      .is("resolved_at", null);
  } catch (err) {
    console.error("Error resolving alert:", err);
  }
}

export async function upsertComplianceStatus(
  supabase: SupabaseClient,
  tenantId: string,
  assetId: string,
  hasAntivirus: boolean,
  forbiddenSoftware: string[] = [],
  windowsUpdated: boolean | null = null
) {
  const complianceScore = Math.max(
    0,
    100 - (forbiddenSoftware.length > 0 ? 30 : 0) - (hasAntivirus ? 0 : 40) - (windowsUpdated === false ? 20 : 0)
  );

  const criticalViolations =
    (forbiddenSoftware.length > 0 ? 1 : 0) + (hasAntivirus ? 0 : 1) + (windowsUpdated === false ? 1 : 0);

  try {
    await supabase.from("device_compliance_status").upsert(
      {
        tenant_id: tenantId,
        asset_id: assetId,
        compliance_score: complianceScore,
        violations_count: forbiddenSoftware.length + (hasAntivirus ? 0 : 1) + (windowsUpdated === false ? 1 : 0),
        critical_violations: criticalViolations,
        has_antivirus: hasAntivirus,
        windows_updated: windowsUpdated,
        forbidden_software_found: forbiddenSoftware.length > 0 ? forbiddenSoftware : null,
        last_check_at: new Date().toISOString(),
      },
      {
        onConflict: "tenant_id,asset_id",
      }
    );
  } catch (err) {
    console.error("Error upserting compliance status:", err);
  }
}

function isOlderVersion(current: string, minimum: string): boolean {
  const parsePart = (v: string) => v.split(".").map((x) => parseInt(x, 10));
  const curr = parsePart(current);
  const min = parsePart(minimum);

  for (let i = 0; i < Math.max(curr.length, min.length); i++) {
    const c = curr[i] || 0;
    const m = min[i] || 0;
    if (c < m) return true;
    if (c > m) return false;
  }

  return false;
}
