import { createAsset } from "@/app/actions";
import { SubmitButton } from "@/components/form-buttons";
import type { Tenant } from "@/lib/inventory-data";
import { assetCriticalities, assetStatuses } from "@/lib/inventory-data";

type AssetFormProps = {
  tenants: Tenant[];
  disabled?: boolean;
};

export function AssetForm({ tenants, disabled = false }: AssetFormProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-950">Cadastrar ativo</h2>
        <p className="text-sm text-zinc-500">
          Registre computadores, servidores e ativos de rede como switches e
          roteadores quando a coleta automatica nao for possivel.
        </p>
      </div>

      <form action={createAsset} className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Tenant
          <select
            name="tenantId"
            required
            disabled={disabled}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900 disabled:bg-zinc-100"
          >
            <option value="">Selecione</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>

        <TextField name="tag" label="Patrimonio" disabled={disabled} />
        <TextField name="type" label="Tipo" disabled={disabled} />
        <TextField name="model" label="Modelo" disabled={disabled} />
        <TextField name="owner" label="Responsavel" disabled={disabled} />
        <TextField name="location" label="Local" disabled={disabled} />

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Status
          <select
            name="status"
            defaultValue="Estoque"
            disabled={disabled}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900 disabled:bg-zinc-100"
          >
            {assetStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Criticidade
          <select
            name="criticality"
            defaultValue="Baixa"
            disabled={disabled}
            className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900 disabled:bg-zinc-100"
          >
            {assetCriticalities.map((criticality) => (
              <option key={criticality} value={criticality}>
                {criticality}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end lg:col-span-4">
          <SubmitButton
            label="Salvar ativo"
            pendingLabel="Salvando ativo..."
            disabled={disabled}
            className="h-11 rounded-md bg-teal-700 px-5 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          />
        </div>
      </form>
    </section>
  );
}

type TextFieldProps = {
  name: string;
  label: string;
  disabled: boolean;
};

function TextField({ name, label, disabled }: TextFieldProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
      {label}
      <input
        name={name}
        required
        disabled={disabled}
        className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900 disabled:bg-zinc-100"
      />
    </label>
  );
}
