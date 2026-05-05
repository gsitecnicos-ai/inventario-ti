import { connection } from "next/server";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { FeedbackMessage } from "@/components/feedback-message";
import { SubmitButton } from "@/components/form-buttons";
import { AssetFilters } from "@/components/dashboard/asset-filters";
import { AssetForm } from "@/components/dashboard/asset-form";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AssetTable } from "@/components/dashboard/asset-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TenantList } from "@/components/dashboard/tenant-list";
import { getInventoryDashboard } from "@/lib/inventory-repository";
import {
  assetStatuses,
  formatNumber,
  type AssetStatus,
  type Tenant,
} from "@/lib/inventory-data";
import { getCurrentAccess } from "@/lib/supabase-server";

type HomeProps = {
  searchParams: Promise<{
    tenant?: string;
    status?: string;
    q?: string;
    success?: string;
    error?: string;
  }>;
};

function getAverageCompliance(tenants: Tenant[]) {
  if (tenants.length === 0) {
    return 0;
  }

  return Math.round(
    tenants.reduce((total, tenant) => total + tenant.compliance, 0) /
      tenants.length,
  );
}

function normalizeStatus(status?: string): AssetStatus | undefined {
  if (assetStatuses.includes(status as AssetStatus)) {
    return status as AssetStatus;
  }

  return undefined;
}

export default async function Home({ searchParams }: HomeProps) {
  await connection();

  const params = await searchParams;
  const filters = {
    tenantId: params.tenant?.trim() || undefined,
    status: normalizeStatus(params.status),
    query: params.q?.trim() || undefined,
  };
  const [access, dashboard] = await Promise.all([
    getCurrentAccess(),
    getInventoryDashboard(filters),
  ]);
  const { activities, assets, source, tenants } = dashboard;
  const { user } = access;
  const canManage = Boolean(access.canManageAssets && source === "supabase");
  const totalAssets = tenants.reduce((total, tenant) => total + tenant.assets, 0);
  const totalPending = tenants.reduce(
    (total, tenant) => total + tenant.pending,
    0,
  );
  const averageCompliance = getAverageCompliance(tenants);
  const metrics = [
    {
      label: "Tenants ativos",
      value: String(tenants.length),
      detail: "Organizacoes com inventario segregado",
    },
    {
      label: "Ativos cadastrados",
      value: formatNumber(totalAssets),
      detail: "Equipamentos, perifericos e infraestrutura",
    },
    {
      label: "Pendencias abertas",
      value: formatNumber(totalPending),
      detail: "Itens aguardando acao operacional",
    },
    {
      label: "Conformidade media",
      value: `${averageCompliance}%`,
      detail: "Baseada em dados completos por tenant",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-teal-700">
              Inventario TI multi-tenant
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold text-zinc-950 sm:text-4xl">
              Operacao centralizada para ativos de varios clientes
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
              Controle tenants, unidades, responsaveis, criticidade e status em
              uma visao preparada para crescer para autenticacao, permissoes e
              banco de dados.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {user ? (
              <form action={signOut}>
                <SubmitButton
                  label="Sair"
                  pendingLabel="Saindo..."
                  className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
                />
              </form>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
              >
                Entrar
              </Link>
            )}
            {access.isGlobalAdmin ? (
              <Link
                href="/admin"
                className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
              >
                Admin
              </Link>
            ) : null}
            <a
              href="#tenants"
              className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
            >
              Ver tenants
            </a>
            <a
              href="#ativos"
              className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Ver inventario
            </a>
          </div>
        </header>

        <FeedbackMessage success={params.success} error={params.error} />

        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-950">
              {user ? "Sessao autenticada" : "Modo demonstracao"}
            </p>
            <p className="text-sm text-zinc-500">
              {user
                ? `${user.email} - ${
                    access.isGlobalAdmin ? "admin global" : "perfil por tenant"
                  }`
                : "Entre para consultar dados reais com RLS e operar ativos."}
            </p>
          </div>
          <span className="text-sm font-medium text-teal-700">
            {source === "supabase" ? "Supabase ativo" : "Fallback mock"}
          </span>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
            />
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div id="tenants">
            <TenantList tenants={tenants} />
          </div>
          <ActivityFeed activities={activities} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">
              Isolamento por tenant
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              O dominio ja separa ativos, eventos e indicadores por
              organizacao, deixando o proximo passo claro para controle de
              acesso e filtros server-side.
            </p>
          </article>
          <article className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">
              Ciclo de vida do ativo
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Status, criticidade, responsavel e localizacao viraram campos de
              primeira classe para suportar manutencao, auditoria e estoque.
            </p>
          </article>
          <article className="rounded-lg border border-zinc-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-zinc-950">
              Pronto para persistencia
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Os dados mockados vivem em uma camada unica e podem ser trocados
              por banco, API ou Server Actions sem desmontar os componentes.
            </p>
          </article>
        </section>

        <AssetFilters
          tenants={tenants}
          selectedTenant={filters.tenantId}
          selectedStatus={filters.status}
          query={filters.query}
        />

        <AssetForm tenants={tenants} disabled={!canManage} />

        <AssetTable assets={assets} canManage={canManage} />

        {source === "mock" ? (
          <p className="text-xs text-zinc-500">
            Dados mockados em uso ate a configuracao do Supabase.
          </p>
        ) : null}
      </section>
    </main>
  );
}
