"use client";

import { useEffect, useState } from "react";

type AgentStatus = {
  assetId: string;
  deviceId: string;
  hostname: string;
  status: "online" | "idle" | "offline";
  lastHeartbeat: string;
  minutesSinceHeartbeat: number;
  cpuUsage: number | null;
  memoryUsage: number | null;
};

type AgentStatusProps = {
  tenantId: string;
};

const statusConfig = {
  online: { label: "Online", color: "bg-emerald-100 text-emerald-800", icon: "📶" },
  idle: { label: "Inativo", color: "bg-amber-100 text-amber-800", icon: "⏳" },
  offline: { label: "Offline", color: "bg-gray-100 text-gray-800", icon: "⚫" },
};

function formatLastSeen(minutes: number): string {
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function AgentCard({ agent }: { agent: AgentStatus }) {
  const config = statusConfig[agent.status];

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{agent.hostname}</h3>
          <p className="text-sm text-gray-500 truncate">{agent.deviceId}</p>
        </div>
        <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
          <span>{config.icon}</span>
          {config.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-gray-600">Visto</p>
          <p className="font-medium text-gray-900">{formatLastSeen(agent.minutesSinceHeartbeat)}</p>
        </div>
        {agent.cpuUsage !== null && (
          <div>
            <p className="text-gray-600">CPU</p>
            <p className="font-medium text-gray-900">{agent.cpuUsage.toFixed(1)}%</p>
          </div>
        )}
        {agent.memoryUsage !== null && (
          <div>
            <p className="text-gray-600">Memória</p>
            <p className="font-medium text-gray-900">{agent.memoryUsage.toFixed(1)}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentsStatus({ tenantId }: AgentStatusProps) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const fetchAgents = async () => {
    try {
      const status = filter === "all" ? "all" : filter;
      const res = await fetch(`/api/tenant/${tenantId}/agents?status=${status}`);

      if (!res.ok) throw new Error("Falha ao buscar agentes");

      const data = await res.json();
      setAgents(data.agents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000); // Atualizar a cada 30s
    return () => clearInterval(interval);
  }, [tenantId, filter]);

  const online = agents.filter((a) => a.status === "online").length;
  const offline = agents.filter((a) => a.status === "offline").length;
  const idle = agents.filter((a) => a.status === "idle").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Status dos Agentes</h2>
          <p className="text-sm text-gray-600">
            {online} online · {idle} inativos · {offline} offline
          </p>
        </div>
        <button
          onClick={fetchAgents}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          Atualizar
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "online", "offline"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 text-sm rounded ${
              filter === status
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {status === "all" ? "Todos" : status === "online" ? "Online" : "Offline"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500">Carregando agentes...</div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded border border-red-200">
          <span className="text-xl">⚠️</span>
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="text-center py-8 text-gray-500">Nenhum agente encontrado</div>
      )}

      {!loading && !error && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.deviceId} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
