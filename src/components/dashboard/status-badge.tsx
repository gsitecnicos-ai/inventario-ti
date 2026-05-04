import type { AssetCriticality, AssetStatus } from "@/lib/inventory-data";

const statusStyles: Record<AssetStatus, string> = {
  "Em uso": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Atencao: "bg-amber-50 text-amber-700 ring-amber-200",
  Manutencao: "bg-rose-50 text-rose-700 ring-rose-200",
  Estoque: "bg-sky-50 text-sky-700 ring-sky-200",
};

const criticalityStyles: Record<AssetCriticality, string> = {
  Baixa: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  Media: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Alta: "bg-red-50 text-red-700 ring-red-200",
};

type StatusBadgeProps =
  | {
      label: AssetStatus;
      variant: "status";
    }
  | {
      label: AssetCriticality;
      variant: "criticality";
    };

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  const styles =
    variant === "status" ? statusStyles[label] : criticalityStyles[label];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}
    >
      {label}
    </span>
  );
}
