import type { AgentStatus } from "@/lib/inventory-repository";

type AgentStatusBadgeProps = {
  status: "online" | "idle" | "offline";
  variant?: "compact" | "detailed";
};

function getStatusStyles(status: "online" | "idle" | "offline") {
  switch (status) {
    case "online":
      return {
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        dotColor: "bg-green-500",
        textColor: "text-green-700",
        label: "Online",
      };
    case "idle":
      return {
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        dotColor: "bg-yellow-500",
        textColor: "text-yellow-700",
        label: "Inativo",
      };
    case "offline":
      return {
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        dotColor: "bg-red-500",
        textColor: "text-red-700",
        label: "Offline",
      };
  }
}

export function AgentStatusBadge({ status, variant = "compact" }: AgentStatusBadgeProps) {
  const styles = getStatusStyles(status);

  if (variant === "compact") {
    return (
      <span className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${styles.bgColor} border ${styles.borderColor} ${styles.textColor}`}>
        <span className={`h-2 w-2 rounded-full ${styles.dotColor} animate-pulse`} />
        {styles.label}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border ${styles.borderColor} ${styles.bgColor} p-3`}>
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${styles.dotColor} animate-pulse`} />
        <span className={`text-sm font-semibold ${styles.textColor}`}>{styles.label}</span>
      </div>
    </div>
  );
}

type AgentHeartbeatCardProps = {
  agentStatus: AgentStatus;
};

export function AgentHeartbeatCard({ agentStatus }: AgentHeartbeatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-zinc-950">{agentStatus.hostname}</h3>
          <p className="text-sm text-zinc-500">{agentStatus.deviceId}</p>
        </div>
        <AgentStatusBadge status={agentStatus.status} variant="compact" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">IP</p>
          <p className="text-sm font-medium text-zinc-950">
            {agentStatus.ipAddress || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">CPU</p>
          <p className="text-sm font-medium text-zinc-950">
            {agentStatus.cpuUsage ? `${agentStatus.cpuUsage.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Memória</p>
          <p className="text-sm font-medium text-zinc-950">
            {agentStatus.memoryUsage ? `${agentStatus.memoryUsage.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Última comunicação</p>
          <p className="text-sm font-medium text-zinc-950">
            {agentStatus.minutesSinceHeartbeat > 60
              ? `${Math.floor(agentStatus.minutesSinceHeartbeat / 60)}h atrás`
              : `${agentStatus.minutesSinceHeartbeat}m atrás`}
          </p>
        </div>
      </div>
    </div>
  );
}
