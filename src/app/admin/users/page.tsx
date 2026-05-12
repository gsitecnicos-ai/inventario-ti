import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  addGlobalAdmin,
  createManagedUser,
  createTenant,
  createTenantUser,
  deleteTenant,
  generateTenantAgentKey,
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
            href="/dashboard"
            className="mt-5 inline-flex h-11 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white"
          >
            Voltar ao dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { globalAdmins, members, tenants, users } = await getAdminDashboard();
  const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-teal-700">
              Painel administrativo
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Empresas, usuarios e permissoes
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
              Crie empresas, cadastre usuarios e defina quem pode visualizar,
              operar ou administrar o inventario de cada cliente.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetric label="Empresas" value={tenants.length} detail="clientes cadastrados" />
          <AdminMetric label="Usuarios" value={users.length} detail="contas com login" />
          <AdminMetric label="Vinculos" value={members.length} detail="permissoes por empresa" />
          <AdminMetric label="Admins globais" value={globalAdmins.length} detail="acesso total" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <CreateTenantForm />
          <CreateTenantUserForm tenants={tenants} />
        </section>

        <CompanyAccessCards
          tenants={tenants}
          members={members}
          users={users}
        />

        <TenantsTable tenants={tenants} />

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <CreateManagedUserForm />
          <AddGlobalAdminForm />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <TenantMembersTable members={members} tenantsById={tenantsById} />
          <GlobalAdminsTable admins={globalAdmins} currentUserId={access.user.id} />
        </section>

        <UsersTable users={users} />
      </section>
    </main>
  );
}

function AdminMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{detail}</p>
    </article>
  );
}

function CreateManagedUserForm() {
  return (
    <form action={createManagedUser} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Novo usuario</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Crie o acesso inicial no Supabase Auth.
      </p>
      <div className="mt-4 grid gap-3">
        <TextInput name="email" label="E-mail" type="email" required />
        <TextInput name="password" label="Senha temporaria" type="password" required />
        <SubmitButton
          label="Criar usuario"
          pendingLabel="Criando..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        />
      </div>
    </form>
  );
}

function CreateTenantForm() {
  return (
    <form
      action={createTenant}
      className="rounded-lg border border-zinc-200 bg-white p-5"
    >
      <h2 className="text-lg font-semibold">Nova empresa</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Dados cadastrais, marca e chave usada pelo agente de inventario.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextInput name="name" label="Nome" required />
        <TextInput name="slug" label="Slug" />
        <TextInput name="cnpj" label="CNPJ" />
        <TextInput name="segment" label="Segmento" required />
        <TextInput name="contactName" label="Contato" />
        <TextInput name="contactEmail" label="E-mail do contato" type="email" />
        <TextInput name="contactPhone" label="Telefone" />
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Logo da empresa
          <input
            name="logoFile"
            type="file"
            accept="image/*"
            className="h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700"
          />
        </label>
        <TextInput name="addressLine" label="Endereco" />
        <TextInput name="city" label="Cidade" />
        <TextInput name="state" label="UF" />
        <TextInput name="postalCode" label="CEP" />
        <TextInput name="agentApiKey" label="Chave do agente" />
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
          label="Criar empresa"
          pendingLabel="Criando..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:col-span-2"
        />
      </div>
    </form>
  );
}

function CreateTenantUserForm({ tenants }: { tenants: AdminTenant[] }) {
  return (
    <form action={createTenantUser} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Adicionar usuario a empresa</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Crie o login se ele ainda nao existir e aplique a permissao no inventario.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700 sm:col-span-2">
          Empresa
          <select
            name="tenantId"
            required
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900"
          >
            <option value="">Selecione a empresa</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <TextInput name="email" label="E-mail do usuario" type="email" required />
        <TextInput name="password" label="Senha temporaria" type="password" />
        <RoleSelect name="role" defaultValue="operator" />
        <SubmitButton
          label="Salvar usuario e permissao"
          pendingLabel="Salvando..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 sm:col-span-2"
        />
      </div>
    </form>
  );
}

type CompanyAccessCardsProps = {
  tenants: AdminTenant[];
  members: Awaited<ReturnType<typeof getAdminDashboard>>["members"];
  users: Awaited<ReturnType<typeof getAdminDashboard>>["users"];
};

function CompanyAccessCards({
  tenants,
  members,
  users,
}: CompanyAccessCardsProps) {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {tenants.length > 0 ? (
        tenants.map((tenant) => {
          const tenantMembers = members.filter(
            (member) => member.tenantId === tenant.id,
          );

          return (
            <article key={tenant.id} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {tenant.logoUrl ? (
                    <Image
                      src={tenant.logoUrl}
                      alt=""
                      width={44}
                      height={44}
                      unoptimized
                      className="size-11 rounded-md border border-zinc-200 object-contain"
                    />
                  ) : (
                    <div className="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100 text-sm font-semibold text-zinc-600">
                      {tenant.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{tenant.name}</h2>
                    <p className="text-sm text-zinc-500">{tenant.segment}</p>
                  </div>
                </div>
                <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                  {tenantMembers.length} usuarios
                </span>
              </div>

              <div className="mt-5 grid gap-3">
                {tenantMembers.length > 0 ? (
                  tenantMembers.map((member) => (
                    <div
                      key={`${member.tenantId}-${member.userId}`}
                      className="grid gap-3 rounded-md border border-zinc-200 p-3 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.email}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Ultimo acesso: {formatDate(usersById.get(member.userId)?.lastSignInAt ?? null)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <form
                          id={`company-member-${member.tenantId}-${member.userId}`}
                          action={updateTenantMemberRole}
                          className="flex gap-2"
                        >
                          <input type="hidden" name="tenantId" value={member.tenantId} />
                          <input type="hidden" name="userId" value={member.userId} />
                          <RoleSelect
                            name="role"
                            defaultValue={member.role}
                            form={`company-member-${member.tenantId}-${member.userId}`}
                          />
                          <SubmitButton
                            label="Salvar"
                            pendingLabel="..."
                            className="h-10 rounded-md bg-zinc-950 px-3 text-xs font-medium text-white"
                          />
                        </form>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500">
                    Nenhum usuario vinculado a esta empresa.
                  </p>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <article className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500 lg:col-span-2">
          Crie a primeira empresa para liberar o vinculo de usuarios e permissoes.
        </article>
      )}
    </section>
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

function TenantsTable({ tenants }: { tenants: AdminTenant[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-lg font-semibold">Empresas cadastradas</h2>
        <p className="text-sm text-zinc-500">
          Cadastro base para inventario, usuarios e agente automatico.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Empresa</th>
              <th className="px-5 py-3 font-semibold">CNPJ</th>
              <th className="px-5 py-3 font-semibold">Contato</th>
              <th className="px-5 py-3 font-semibold">Endereco</th>
              <th className="px-5 py-3 font-semibold">Agente</th>
              <th className="px-5 py-3 font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {tenants.length > 0 ? (
              tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td className="px-5 py-4">
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
                        <p className="font-medium text-zinc-950">
                          {tenant.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {tenant.segment}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {tenant.cnpj ?? "-"}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    <p>{tenant.contactName ?? "-"}</p>
                    <p className="text-xs">
                      {tenant.contactEmail ?? tenant.contactPhone ?? ""}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {[
                      tenant.addressLine,
                      tenant.city,
                      tenant.state,
                      tenant.postalCode,
                    ]
                      .filter(Boolean)
                      .join(" - ") || "-"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                        {tenant.hasAgentApiKey ? "Configurado" : "Pendente"}
                      </span>
                      {tenant.hasAgentApiKey ? (
                        <a
                          href={`/api/admin/agent-config/${tenant.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100"
                        >
                          Baixar config
                        </a>
                      ) : (
                        <form action={generateTenantAgentKey}>
                          <input type="hidden" name="tenantId" value={tenant.id} />
                          <SubmitButton
                            label="Gerar chave"
                            pendingLabel="Gerando..."
                            className="h-8 rounded-md bg-zinc-950 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                          />
                        </form>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <form action={deleteTenant}>
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <ConfirmSubmitButton
                        label="Excluir"
                        pendingLabel="Excluindo..."
                        confirmMessage={`Excluir a empresa ${tenant.name}? Esta acao tambem remove vinculos, ativos e eventos associados.`}
                        className="h-8 rounded-md border border-rose-200 bg-white px-3 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50"
                      />
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                  Nenhuma empresa cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type UsersTableProps = {
  users: Awaited<ReturnType<typeof getAdminDashboard>>["users"];
};

function formatDate(value: string | null) {
  if (!value) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function UsersTable({ users }: UsersTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-lg font-semibold">Usuarios cadastrados</h2>
        <p className="text-sm text-zinc-500">
          Contas existentes no Supabase Auth para vinculo e permissoes.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-100 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3 font-semibold">E-mail</th>
              <th className="px-5 py-3 font-semibold">Criado em</th>
              <th className="px-5 py-3 font-semibold">Ultimo acesso</th>
              <th className="px-5 py-3 font-semibold">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-4 font-medium">{user.email}</td>
                  <td className="px-5 py-4 text-zinc-600">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-zinc-600">
                    {formatDate(user.lastSignInAt)}
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-500">{user.id}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-zinc-500">
                  Nenhum usuario cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
