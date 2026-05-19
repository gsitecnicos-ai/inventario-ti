"use client";

import { useEffect, useState } from "react";

type ComplianceSummary = {
  totalDevices: number;
  averageScore: number;
  compliantDevices: number;
  devicesWithCriticalViolations: number;
  devicesWithAntivirus: number;
  devicesWithoutAntivirus: number;
};

type ComplianceProps = {
  tenantId: string;
};

function ScoreBar({ score }: { score: number }) {
  let colorClass = "bg-red-500"; // < 50
  if (score >= 50 && score < 70) colorClass = "bg-amber-500";
  if (score >= 70 && score < 90) colorClass = "bg-yellow-500";
  if (score >= 90) colorClass = "bg-emerald-500";

  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${score}%` }} />
    </div>
  );
}

export function ComplianceSummary({ tenantId }: ComplianceProps) {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompliance = async () => {
    try {
      const res = await fetch(`/api/tenant/${tenantId}/compliance`);
      if (!res.ok) throw new Error("Falha ao buscar compliance");
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error("Error fetching compliance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompliance();
    const interval = setInterval(fetchCompliance, 300000); // Atualizar a cada 5 minutos
    return () => clearInterval(interval);
  }, [tenantId]);

  if (loading)
    return (
      <div className="text-center py-8 text-gray-500">Carregando conformidade...</div>
    );

  if (!summary)
    return (
      <div className="text-center py-8 text-gray-500">Sem dados de conformidade</div>
    );

  const compliancePercentage = Math.round(
    (summary.compliantDevices / summary.totalDevices) * 100
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">Score de Conformidade</h3>
          <span className="text-2xl font-bold text-gray-900">{summary.averageScore}</span>
        </div>
        <ScoreBar score={summary.averageScore} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Dispositivos em Conformidade</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-emerald-600">{summary.compliantDevices}</span>
            <span className="text-sm text-gray-500 mb-1">de {summary.totalDevices}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{compliancePercentage}% em conformidade</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Antivírus</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-blue-600">{summary.devicesWithAntivirus}</span>
            <span className="text-sm text-gray-500 mb-1">com AV</span>
          </div>
          <p className="text-xs text-red-600 mt-2">
            {summary.devicesWithoutAntivirus} sem AV
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Violações Críticas</p>
          <span className="text-2xl font-bold text-red-600">
            {summary.devicesWithCriticalViolations}
          </span>
          <p className="text-xs text-gray-500 mt-2">dispositivos afetados</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total de Dispositivos</p>
          <span className="text-2xl font-bold text-gray-900">{summary.totalDevices}</span>
          <p className="text-xs text-gray-500 mt-2">sob monitoramento</p>
        </div>
      </div>
    </div>
  );
}
