export type AssetStatus = "Em uso" | "Atencao" | "Manutencao" | "Estoque";

export type AssetCriticality = "Baixa" | "Media" | "Alta";

export const assetStatuses: AssetStatus[] = [
  "Em uso",
  "Atencao",
  "Manutencao",
  "Estoque",
];

export const assetCriticalities: AssetCriticality[] = ["Baixa", "Media", "Alta"];

export type Tenant = {
  id: string;
  name: string;
  segment: string;
  logoUrl?: string | null;
  units: number;
  assets: number;
  pending: number;
  compliance: number;
};

export type Asset = {
  id: string;
  tag: string;
  tenantId: string;
  tenantName: string;
  type: string;
  model: string;
  owner: string;
  location: string;
  status: AssetStatus;
  criticality: AssetCriticality;
  updatedAt: string;
};

export type Activity = {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  time: string;
};

export type HardwareHistory = {
  id: string;
  tenantId: string;
  assetId: string;
  assetTag: string;
  eventType: "initial_snapshot" | "ram_upgrade" | "storage_change" | "os_change";
  hardwareKey: "ram" | "storage" | "os";
  oldValue: string | null;
  newValue: string;
  observedAt: string;
};

export const tenants: Tenant[] = [
  {
    id: "aurora",
    name: "Grupo Aurora",
    segment: "Servicos corporativos",
    units: 8,
    assets: 1248,
    pending: 38,
    compliance: 94,
  },
  {
    id: "norte-energia",
    name: "Norte Energia",
    segment: "Energia",
    units: 5,
    assets: 892,
    pending: 21,
    compliance: 91,
  },
  {
    id: "clara-seguros",
    name: "Clara Seguros",
    segment: "Seguros",
    units: 4,
    assets: 640,
    pending: 17,
    compliance: 88,
  },
  {
    id: "metro-saude",
    name: "Metro Saude",
    segment: "Saude",
    units: 6,
    assets: 1500,
    pending: 67,
    compliance: 84,
  },
];

export const assets: Asset[] = [
  {
    id: "asset-001",
    tag: "NTB-1048",
    tenantId: "aurora",
    tenantName: "Grupo Aurora",
    type: "Notebook",
    model: "ThinkPad T14",
    owner: "Mariana Alves",
    location: "Financeiro",
    status: "Em uso",
    criticality: "Media",
    updatedAt: "04/05/2026",
  },
  {
    id: "asset-002",
    tag: "MON-0217",
    tenantId: "norte-energia",
    tenantName: "Norte Energia",
    type: "Monitor",
    model: "Dell P2422H",
    owner: "Paulo Mendes",
    location: "Operacoes",
    status: "Em uso",
    criticality: "Baixa",
    updatedAt: "04/05/2026",
  },
  {
    id: "asset-003",
    tag: "SRV-0003",
    tenantId: "aurora",
    tenantName: "Grupo Aurora",
    type: "Servidor",
    model: "PowerEdge R650",
    owner: "Infraestrutura",
    location: "Data center",
    status: "Atencao",
    criticality: "Alta",
    updatedAt: "03/05/2026",
  },
  {
    id: "asset-004",
    tag: "CEL-0891",
    tenantId: "clara-seguros",
    tenantName: "Clara Seguros",
    type: "Celular",
    model: "Galaxy A55",
    owner: "Ana Ribeiro",
    location: "Comercial",
    status: "Manutencao",
    criticality: "Media",
    updatedAt: "02/05/2026",
  },
  {
    id: "asset-005",
    tag: "SWI-0144",
    tenantId: "metro-saude",
    tenantName: "Metro Saude",
    type: "Switch",
    model: "Aruba 2930F",
    owner: "Redes",
    location: "Unidade Central",
    status: "Estoque",
    criticality: "Alta",
    updatedAt: "01/05/2026",
  },
];

export const activities: Activity[] = [
  {
    id: "activity-001",
    tenantId: "aurora",
    title: "Servidor com alerta de garantia",
    description: "SRV-0003 vence cobertura em 45 dias.",
    time: "09:42",
  },
  {
    id: "activity-002",
    tenantId: "clara-seguros",
    title: "Celular enviado para manutencao",
    description: "CEL-0891 atualizado pelo suporte de campo.",
    time: "08:15",
  },
  {
    id: "activity-003",
    tenantId: "metro-saude",
    title: "Novo switch em estoque",
    description: "SWI-0144 aguardando vinculacao a unidade.",
    time: "Ontem",
  },
];

export function getTenantName(tenantId: string) {
  return tenants.find((tenant) => tenant.id === tenantId)?.name ?? tenantId;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
