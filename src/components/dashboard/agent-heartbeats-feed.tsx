"use client";

import { useEffect, useState } from "react";
import type { AgentStatus } from "@/lib/inventory-repository";
import { AgentHeartbeatCard } from "./agent-status";

type AgentHeartbeatsFeedProps = {
  tenantId: string;
};

export function AgentHeartbeatsFeed({ tenantId }: AgentHeartbeatsFeedProps) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch(
          `/api/tenant/${tenantId}/agents?status=all`,
          { cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          setAgents(data.agents || []);
        }
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();

    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  if (loading) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="h-32 animate-pulse rounded bg-zinc-100" />
      </section>
    );
  }

  if (agents.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5">
        <div className="text-center">
          <h3 className="text-sm font-medium text-zinc-500">Nenhum agente registrado</h3>
          <p className="text-xs text-zinc-400">
            Instale o agente em uma máquina para começar a monitorar
          </p>
        </div>
      </section>
    );
  }

  const onlineCount = agents.filter((a) => a.status === "online").length;
  const offlineCount = agents.filter((a) => a.status === "offline").length;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Status dos Agentes
          </h2>
          <p className="text-sm text-zinc-500">
            {onlineCount} online · {offlineCount} offline
          </p>
        </div>
        <span className="text-sm font-medium text-teal-700">
          Atualização em tempo real
        </span>
      </div>

      <div className="space-y-3 p-5">
        {agents.map((agent) => (
          <AgentHeartbeatCard key={agent.assetId} agentStatus={agent} />
        ))}
      </div>
    </section>
  );
}
