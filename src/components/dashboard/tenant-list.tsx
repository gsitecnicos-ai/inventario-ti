import Image from "next/image";
import type { Tenant } from "@/lib/inventory-data";
import { formatNumber } from "@/lib/inventory-data";

type TenantListProps = {
  tenants: Tenant[];
};

export function TenantList({ tenants }: TenantListProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">
            Tenants monitorados
          </h2>
          <p className="text-sm text-zinc-500">
            Saude operacional por organizacao.
          </p>
        </div>
        <span className="rounded-md bg-teal-50 px-2.5 py-1 text-sm font-medium text-teal-700">
          {tenants.length} ativos
        </span>
      </div>

      <div className="mt-4 divide-y divide-zinc-200">
        {tenants.map((tenant) => (
          <article
            key={tenant.id}
            className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="flex items-center gap-3">
              {tenant.logoUrl ? (
                <Image
                  src={tenant.logoUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="size-10 rounded-md border border-zinc-200 object-contain"
                />
              ) : (
                <div className="grid size-10 place-items-center rounded-md bg-zinc-100 text-sm font-semibold text-zinc-600">
                  {tenant.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium text-zinc-950">{tenant.name}</p>
                <p className="text-sm text-zinc-500">
                  {tenant.segment} - {tenant.units} unidades -{" "}
                  {formatNumber(tenant.assets)} ativos
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-700">
                {tenant.pending} pendencias
              </span>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                {tenant.compliance}% conformidade
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
