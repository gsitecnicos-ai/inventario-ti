import Link from "next/link";
import { redirect } from "next/navigation";
import {
  addGlobalAdmin,
  addTenantMember,
  createTenant,
  removeGlobalAdmin,
  removeTenantMember,
  signOut,
  updateTenantMemberRole,
} from "@/app/actions";
import { FeedbackMessage } from "@/components/feedback-message";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form-buttons";
import {
  getAdminDashboard,
  tenantRoles,
  type AdminTenant,
} from "@/lib/admin-repository";
import { getCurrentAccess } from "@/lib/supabase-server";

type AdminPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const access = await getCurrentAccess();
  const params = await searchParams;

  if (!access.user) {
    redirect("/login");
  }

  if (!access.isGlobalAdmin) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
        <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6">
          <p className="text-sm font-medium uppercase text-rose-700">
            Acesso restrito
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Apenas administradores globais podem abrir esta area.
          </h1>
          <Link
            href="/"
            className="mt-5 inline-flex h-11 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white"
          >
            Voltar ao dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { globalAdmins, members, tenants } = await getAdminDashboard();
  const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-teal-700">
              Administracao global
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Tenants, usuarios e permissoes
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
              Gerencie acesso por cliente e administradores globais do sistema.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
            >
              Dashboard
            </Link>
            <form action={signOut}>
              <SubmitButton
                label="Sair"
                pendingLabel="Saindo..."
                className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              />
            </form>
          </div>
        </header>

        <FeedbackMessage success={params.success} error={params.error} />

        <section className="grid gap-4 lg:grid-cols-3">
          <CreateTenantForm />
          <AddTenantMemberForm tenants={tenants} />
          <AddGlobalAdminForm />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <TenantMembersTable members={members} tenantsById={tenantsById} />
          <GlobalAdminsTable admins={globalAdmins} currentUserId={access.user.id} />
        </section>
      </section>
    </main>
  );
}

function CreateTenantForm() {
  return (
    <form action={createTenant} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Novo tenant</h2>
      <div className="mt-4 grid gap-3">
        <TextInput name="name" label="Nome" required />
        <TextInput name="slug" label="Slug" />
        <TextInput name="segment" label="Segmento" required />
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Conformidade inicial
          <input
            name="compliance"
            type="number"
            min="0"
            max="100"
            defaultValue="0"
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
          />
        </label>
        <SubmitButton
          label="Criar tenant"
          pendingLabel="Criando..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        />
      </div>
    </form>
  );
}

function AddTenantMemberForm({ tenants }: { tenants: AdminTenant[] }) {
  return (
    <form action={addTenantMember} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Vincular usuario</h2>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Tenant
          <select
            name="tenantId"
            required
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900"
          >
            <option value="">Selecione</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <TextInput name="email" label="E-mail do usuario" type="email" required />
        <RoleSelect name="role" defaultValue="viewer" />
        <SubmitButton
          label="Salvar vinculo"
          pendingLabel="Salvando..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        />
      </div>
    </form>
  );
}

function AddGlobalAdminForm() {
  return (
    <form action={addGlobalAdmin} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Admin global</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Promova um usuario existente no Supabase Auth.
      </p>
      <div className="mt-4 grid gap-3">
        <TextInput name="email" label="E-mail do usuario" type="email" required />
        <SubmitButton
          label="Promover admin"
          pendingLabel="Promovendo..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        />
      </div>
    </form>
  );
}

type TenantMembersTableProps = {
  members: Awaited<ReturnType<typeof getAdminDashboard>>["members"];
  tenantsById: Map<string, AdminTenant>;
};

function TenantMembersTable({ members, tenantsById }: TenantMembersTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-lg font-semibold">Usuarios por tenant</h2>
        <p className="text-sm text-zinc-500">
          Papeis aplicados pelas policies RLS.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className="px-5 py-3 font-semibold">Usuario</th>
              <th className="px-5 py-3 font-semibold">Perfil</th>
              <th className="px-5 py-3 font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {members.length > 0 ? (
              members.map((member) => (
                <tr key={`${member.tenantId}-${member.userId}`}>
                  <td className="px-5 py-4 font-medium">
                    {tenantsById.get(member.tenantId)?.name ?? member.tenantId}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">{member.email}</td>
                  <td className="px-5 py-4">
                    <RoleSelect
                      name="role"
                      defaultValue={member.role}
                      form={`member-${member.tenantId}-${member.userId}`}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <form
                        id={`member-${member.tenantId}-${member.userId}`}
                        action={updateTenantMemberRole}
                      >
                        <input type="hidden" name="tenantId" value={member.tenantId} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <SubmitButton
                          label="Salvar"
                          pendingLabel="Salvando..."
                          className="h-9 rounded-md bg-zinc-950 px-3 text-xs font-medium text-white"
                        />
                      </form>
                      <form action={removeTenantMember}>
                        <input type="hidden" name="tenantId" value={member.tenantId} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <ConfirmSubmitButton
                          label="Remover"
                          pendingLabel="Removendo..."
                          confirmMessage={`Remover ${member.email} deste tenant?`}
                          className="h-9 rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700"
                        />
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                  Nenhum usuario vinculado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type GlobalAdminsTableProps = {
  admins: Awaited<ReturnType<typeof getAdminDashboard>>["globalAdmins"];
  currentUserId: string;
};

function GlobalAdminsTable({ admins, currentUserId }: GlobalAdminsTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-lg font-semibold">Admins globais</h2>
        <p className="text-sm text-zinc-500">Acesso a todos os clientes.</p>
      </div>
      <div className="divide-y divide-zinc-200">
        {admins.length > 0 ? (
          admins.map((admin) => (
            <article
              key={admin.userId}
              className="flex items-center justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="font-medium">{admin.email}</p>
                <p className="text-xs text-zinc-500">{admin.userId}</p>
              </div>
              <form action={removeGlobalAdmin}>
                <input type="hidden" name="userId" value={admin.userId} />
                <ConfirmSubmitButton
                  label="Remover"
                  pendingLabel="Removendo..."
                  confirmMessage={`Remover ${admin.email} dos admins globais?`}
                  disabled={admin.userId === currentUserId}
                  className="h-9 rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400"
                />
              </form>
            </article>
          ))
        ) : (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            Nenhum admin global encontrado.
          </p>
        )}
      </div>
    </section>
  );
}

type TextInputProps = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
};

function TextInput({ name, label, type = "text", required = false }: TextInputProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
      />
    </label>
  );
}

type RoleSelectProps = {
  name: string;
  defaultValue: string;
  form?: string;
};

function RoleSelect({ name, defaultValue, form }: RoleSelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      form={form}
      className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
    >
      {tenantRoles.map((role) => (
        <option key={role} value={role}>
          {role}
        </option>
      ))}
    </select>
  );
}
