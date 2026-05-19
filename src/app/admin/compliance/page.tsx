import { redirect } from "next/navigation";
import { getCurrentAccess, requireGlobalAdmin } from "@/lib/supabase-server";
import { getComplianceRules } from "@/app/compliance-actions";
import { ComplianceRulesManager } from "@/components/admin/compliance-rules-manager";
import Link from "next/link";

type AdminComplianceProps = {
  searchParams: Promise<{
    tenant?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function AdminCompliancePage({
  searchParams,
}: AdminComplianceProps) {
  await requireGlobalAdmin();
  const access = await getCurrentAccess();

  const params = await searchParams;
  const tenantId = params.tenant;

  if (!tenantId) {
    return (
      <main className="min-h-screen bg-zinc-50 text-zinc-950">
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10">
          <header className="border-b border-zinc-200 pb-6">
            <div>
              <p className="text-sm font-medium uppercase text-teal-700">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-zinc-950 sm:text-4xl">
                Regras de Conformidade
              </h1>
              <p className="mt-3 text-base text-zinc-600">
                Defina regras de compliance para cada tenant
              </p>
            </div>
          </header>

          <div className="text-center py-12 text-zinc-500">
            <p>Selecione um tenant para gerenciar regras de conformidade</p>
            <Link
              href="/admin/users"
              className="mt-4 inline-block text-teal-600 hover:text-teal-700 font-medium"
            >
              ← Voltar para Admin
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const rules = await getComplianceRules(tenantId);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10">
        <header className="border-b border-zinc-200 pb-6">
          <div>
            <p className="text-sm font-medium uppercase text-teal-700">
              Admin
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950 sm:text-4xl">
              Regras de Conformidade
            </h1>
            <p className="mt-3 text-base text-zinc-600">
              Gerencie regras de compliance: softwares proibidos, versões Windows mínimas, etc.
            </p>
          </div>
        </header>

        {params.error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-800 border border-red-200">
            {params.error}
          </div>
        )}

        {params.success && (
          <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800 border border-emerald-200">
            {params.success}
          </div>
        )}

        <ComplianceRulesManager tenantId={tenantId} initialRules={rules} />

        <div className="pt-4 border-t border-zinc-200">
          <Link
            href="/admin/users"
            className="text-sm text-zinc-600 hover:text-zinc-900 font-medium"
          >
            ← Voltar para Admin
          </Link>
        </div>
      </section>
    </main>
  );
}
