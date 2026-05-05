import Link from "next/link";
import type { AssetStatus, Tenant } from "@/lib/inventory-data";
import { assetStatuses } from "@/lib/inventory-data";

type AssetFiltersProps = {
  tenants: Tenant[];
  selectedTenant?: string;
  selectedStatus?: AssetStatus | "";
  query?: string;
};

export function AssetFilters({
  tenants,
  selectedTenant = "",
  selectedStatus = "",
  query = "",
}: AssetFiltersProps) {
  return (
    <form
      action="/"
      className="rounded-lg border border-zinc-200 bg-white p-5"
    >
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Tenant
          <select
            name="tenant"
            defaultValue={selectedTenant}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900"
          >
            <option value="">Todos</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Status
          <select
            name="status"
            defaultValue={selectedStatus}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900"
          >
            <option value="">Todos</option>
            {assetStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Busca
          <input
            name="q"
            defaultValue={query}
            placeholder="Patrimonio, modelo, responsavel"
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900 placeholder:text-zinc-400"
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Filtrar
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}
