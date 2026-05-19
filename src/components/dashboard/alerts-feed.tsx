"use client";

import { useEffect, useState } from "react";

type Alert = {
  id: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string | null;
  hostname: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  minutesSinceDetection: number | null;
};

type AlertsProps = {
  tenantId: string;
};

const severityConfig = {
  low: { icon: "ℹ️", color: "bg-blue-50 text-blue-800 border-blue-200" },
  medium: { icon: "⚠️", color: "bg-amber-50 text-amber-800 border-amber-200" },
  high: { icon: "🔴", color: "bg-orange-50 text-orange-800 border-orange-200" },
  critical: { icon: "🚨", color: "bg-red-50 text-red-800 border-red-200" },
};

function formatDetectionTime(minutes: number | null): string {
  if (!minutes) return "Resolvido";
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AlertsFeed({ tenantId }: AlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    critical: 0,
    high: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/tenant/${tenantId}/alerts?resolved=${filter !== "active" ? filter : "false"}`);
      if (!res.ok) throw new Error("Falha ao buscar alertas");
      const data = await res.json();
      setAlerts(data.alerts || []);
      setStats(data.stats);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Atualizar a cada minuto
    return () => clearInterval(interval);
  }, [tenantId, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Alertas</h2>
          <p className="text-sm text-gray-600">
            {stats.active} ativos · {stats.critical} críticos · {stats.high} altos
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Atualizar
        </button>
      </div>

      <div className="flex gap-2">
        {(["active", "all", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-sm rounded ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "active" ? "Ativos" : f === "all" ? "Todos" : "Resolvidos"}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-8 text-gray-500">Carregando alertas...</div>}

      {!loading && alerts.length === 0 && (
        <div className="text-center py-8 text-gray-500">Nenhum alerta encontrado</div>
      )}

      {!loading && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity];
            return (
              <div
                key={alert.id}
                className={`border rounded-lg p-4 ${config.color}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{config.icon}</span>
                      <h3 className="font-semibold">{alert.title}</h3>
                      {alert.hostname && (
                        <span className="text-xs bg-white bg-opacity-50 px-2 py-1 rounded">
                          {alert.hostname}
                        </span>
                      )}
                    </div>
                    {alert.description && (
                      <p className="text-sm mt-1 opacity-90">{alert.description}</p>
                    )}
                  </div>
                  <div className="text-xs whitespace-nowrap ml-4">
                    {formatDetectionTime(alert.minutesSinceDetection)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
