"use client";

import { useState } from "react";
import { createComplianceRule, updateComplianceRule, deleteComplianceRule } from "@/app/compliance-actions";

type ComplianceRule = {
  id: string;
  rule_type: string;
  name: string;
  description: string | null;
  severity: string;
  enabled: boolean;
  parameters: any;
  created_at: string;
};

type Props = {
  tenantId: string;
  initialRules: ComplianceRule[];
};

const RULE_TYPES = [
  { value: "forbidden_software", label: "Softwares Proibidos" },
  { value: "required_av", label: "Antivírus Obrigatório" },
  { value: "min_windows_version", label: "Versão Windows Mínima" },
  { value: "disk_threshold", label: "Limiar de Disco" },
  { value: "uptime_check", label: "Verificação de Uptime" },
];

const SEVERITIES = ["low", "medium", "high", "critical"];

type FormData = {
  ruleType: string;
  name: string;
  description: string;
  severity: string;
  enabled: boolean;
  parameters: Record<string, any>;
};

export function ComplianceRulesManager({ tenantId, initialRules }: Props) {
  const [rules, setRules] = useState<ComplianceRule[]>(initialRules);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    ruleType: "forbidden_software",
    name: "",
    description: "",
    severity: "medium",
    enabled: true,
    parameters: {},
  });

  const handleRuleTypeChange = (ruleType: string) => {
    setForm({ ...form, ruleType, parameters: {} });
  };

  const getRuleTypeLabel = (type: string) => {
    return RULE_TYPES.find((rt) => rt.value === type)?.label || type;
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Nome da regra é obrigatório");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (editingId) {
        await updateComplianceRule(editingId, {
          name: form.name,
          description: form.description || undefined,
          severity: form.severity,
          enabled: form.enabled,
          parameters: Object.keys(form.parameters).length > 0 ? form.parameters : undefined,
        });

        setRules(
          rules.map((r) =>
            r.id === editingId
              ? {
                  ...r,
                  name: form.name,
                  description: form.description || null,
                  severity: form.severity,
                  enabled: form.enabled,
                  parameters: form.parameters,
                }
              : r
          )
        );
      } else {
        await createComplianceRule(tenantId, {
          ruleType: form.ruleType,
          name: form.name,
          description: form.description || undefined,
          severity: form.severity,
          enabled: form.enabled,
          parameters: Object.keys(form.parameters).length > 0 ? form.parameters : undefined,
        });

        const newRule: ComplianceRule = {
          id: `temp-${Date.now()}`,
          rule_type: form.ruleType,
          name: form.name,
          description: form.description || null,
          severity: form.severity,
          enabled: form.enabled,
          parameters: form.parameters,
          created_at: new Date().toISOString(),
        };

        setRules([newRule, ...rules]);
      }

      setForm({
        ruleType: "forbidden_software",
        name: "",
        description: "",
        severity: "medium",
        enabled: true,
        parameters: {},
      });
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar regra");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: ComplianceRule) => {
    setForm({
      ruleType: rule.rule_type,
      name: rule.name,
      description: rule.description || "",
      severity: rule.severity,
      enabled: rule.enabled,
      parameters: rule.parameters || {},
    });
    setEditingId(rule.id);
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Tem certeza que deseja deletar esta regra?")) return;

    setLoading(true);
    try {
      await deleteComplianceRule(ruleId);
      setRules(rules.filter((r) => r.id !== ruleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar regra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-white text-sm font-medium hover:bg-teal-700"
        >
          + Nova Regra
        </button>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            {editingId ? "Editar Regra" : "Nova Regra de Conformidade"}
          </h3>

          {!editingId && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Tipo de Regra
              </label>
              <select
                value={form.ruleType}
                onChange={(e) => handleRuleTypeChange(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {RULE_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Nome
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Bloquear Spotify"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrição opcional"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Severidade
              </label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {SEVERITIES.map((sev) => (
                  <option key={sev} value={sev}>
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm font-medium text-zinc-700">Ativa</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-zinc-200">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setError(null);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-md hover:bg-zinc-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Regras Existentes ({rules.length})</h3>

        {rules.length === 0 ? (
          <p className="text-zinc-500 py-8">Nenhuma regra definida</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-zinc-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-zinc-900">{rule.name}</h4>
                    <p className="text-sm text-zinc-600 mt-1">
                      {getRuleTypeLabel(rule.rule_type)} • Severidade:{" "}
                      <span
                        className={`font-medium ${
                          rule.severity === "critical"
                            ? "text-red-600"
                            : rule.severity === "high"
                            ? "text-orange-600"
                            : rule.severity === "medium"
                            ? "text-amber-600"
                            : "text-blue-600"
                        }`}
                      >
                        {rule.severity}
                      </span>
                    </p>
                    {rule.description && (
                      <p className="text-sm text-zinc-500 mt-2">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        rule.enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {rule.enabled ? "Ativa" : "Inativa"}
                    </span>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="px-3 py-1 text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={loading}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
