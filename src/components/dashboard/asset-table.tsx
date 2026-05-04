import type { Asset } from "@/lib/inventory-data";
import { getTenantName } from "@/lib/inventory-data";
import { StatusBadge } from "./status-badge";

type AssetTableProps = {
  assets: Asset[];
};

export function AssetTable({ assets }: AssetTableProps) {
  return (
    <section
      id="ativos"
      className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
    >
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Ativos recentes
          </h2>
          <p className="text-sm text-zinc-500">
            Ultimos itens movimentados entre tenants.
          </p>
        </div>
        <span className="text-sm font-medium text-teal-700">
          Atualizacao recente
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className="px-5 py-3 font-semibold">Patrimonio</th>
              <th className="px-5 py-3 font-semibold">Tipo</th>
              <th className="px-5 py-3 font-semibold">Modelo</th>
              <th className="px-5 py-3 font-semibold">Responsavel</th>
              <th className="px-5 py-3 font-semibold">Local</th>
              <th className="px-5 py-3 font-semibold">Criticidade</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-zinc-50">
                <td className="px-5 py-4 font-medium text-zinc-950">
                  {getTenantName(asset.tenantId)}
                </td>
                <td className="px-5 py-4 font-medium text-zinc-950">
                  {asset.tag}
                </td>
                <td className="px-5 py-4 text-zinc-600">{asset.type}</td>
                <td className="px-5 py-4 text-zinc-600">{asset.model}</td>
                <td className="px-5 py-4 text-zinc-600">{asset.owner}</td>
                <td className="px-5 py-4 text-zinc-600">{asset.location}</td>
                <td className="px-5 py-4">
                  <StatusBadge label={asset.criticality} variant="criticality" />
                </td>
                <td className="px-5 py-4">
                  <StatusBadge label={asset.status} variant="status" />
                </td>
                <td className="px-5 py-4 text-zinc-600">{asset.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
