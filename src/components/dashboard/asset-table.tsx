import { deleteAsset, updateAsset } from "@/app/actions";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import type { Asset } from "@/lib/inventory-data";
import { assetCriticalities, assetStatuses } from "@/lib/inventory-data";
import { StatusBadge } from "./status-badge";

type AssetTableProps = {
  assets: Asset[];
  canManage?: boolean;
};

export function AssetTable({ assets, canManage = false }: AssetTableProps) {
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
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
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
              {canManage ? (
                <th className="px-5 py-3 font-semibold">Acoes</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {assets.length > 0 ? (
              assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-4 font-medium text-zinc-950">
                    {asset.tenantName}
                  </td>
                  <td className="px-5 py-4 font-medium text-zinc-950">
                    {asset.tag}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{asset.type}</td>
                  <td className="px-5 py-4 text-zinc-600">{asset.model}</td>
                  <td className="px-5 py-4 text-zinc-600">{asset.owner}</td>
                  <td className="px-5 py-4 text-zinc-600">{asset.location}</td>
                  <td className="px-5 py-4">
                    {canManage ? (
                      <select
                        name="criticality"
                        defaultValue={asset.criticality}
                        form={`asset-${asset.id}`}
                        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
                      >
                        {assetCriticalities.map((criticality) => (
                          <option key={criticality} value={criticality}>
                            {criticality}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge
                        label={asset.criticality}
                        variant="criticality"
                      />
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {canManage ? (
                      <select
                        name="status"
                        defaultValue={asset.status}
                        form={`asset-${asset.id}`}
                        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
                      >
                        {assetStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <StatusBadge label={asset.status} variant="status" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{asset.updatedAt}</td>
                  {canManage ? (
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <form id={`asset-${asset.id}`} action={updateAsset}>
                          <input
                            type="hidden"
                            name="assetId"
                            value={asset.id}
                          />
                          <SubmitButton
                            label="Salvar"
                            pendingLabel="Salvando..."
                            className="h-9 rounded-md bg-zinc-950 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                          />
                        </form>
                        <form action={deleteAsset}>
                          <input
                            type="hidden"
                            name="assetId"
                            value={asset.id}
                          />
                          <ConfirmSubmitButton
                            label="Remover"
                            pendingLabel="Removendo..."
                            confirmMessage={`Remover o ativo ${asset.tag}?`}
                            className="h-9 rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
                          />
                        </form>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={canManage ? 10 : 9}
                  className="px-5 py-8 text-center text-sm text-zinc-500"
                >
                  Nenhum ativo encontrado para os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
