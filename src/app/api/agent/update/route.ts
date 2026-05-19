import { createHash } from "node:crypto";
import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminSupabaseClient } from "@/lib/supabase-server";

const agentVersion = "0.3.0";
const agentFileName = "inventario-ti-agent-windows-amd64.exe";

type TenantAgentRow = {
  id: string;
  slug: string | null;
  agent_api_key: string | null;
};

function getAppOrigin(request: Request) {
  const configuredOrigin =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin?.trim()) {
    return configuredOrigin.trim().replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

function readText(value: string | null) {
  return value?.trim() || null;
}

function versionParts(version: string) {
  return Array.from(version.matchAll(/\d+/g), (match) => Number(match[0]));
}

function partAt(parts: number[], index: number) {
  return parts[index] ?? 0;
}

function isNewerVersion(candidate: string, current: string) {
  const candidateParts = versionParts(candidate);
  const currentParts = versionParts(current);
  const maxParts = Math.max(candidateParts.length, currentParts.length);

  for (let index = 0; index < maxParts; index += 1) {
    const candidateValue = partAt(candidateParts, index);
    const currentValue = partAt(currentParts, index);

    if (candidateValue > currentValue) {
      return true;
    }

    if (candidateValue < currentValue) {
      return false;
    }
  }

  return false;
}

async function getAgentBinaryMetadata() {
  const filePath = path.join(process.cwd(), "public", "downloads", agentFileName);
  const [fileStat, file] = await Promise.all([stat(filePath), readFile(filePath)]);
  const sha256 = createHash("sha256").update(file).digest("hex");

  return {
    sha256,
    sizeBytes: fileStat.size,
  };
}

export async function GET(request: Request) {
  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return Response.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY nao configurada." },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const tenantSlug = readText(url.searchParams.get("tenant_slug"));
  const apiKey = readText(url.searchParams.get("api_key"));
  const currentVersion = readText(url.searchParams.get("version")) ?? "0.0.0";

  if (!tenantSlug || !apiKey) {
    return Response.json(
      { error: "tenant_slug e api_key sao obrigatorios." },
      { status: 400 },
    );
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, slug, agent_api_key, agent_api_key_hash")
    .eq("slug", tenantSlug)
    .single();

  if (error || !tenant) {
    return Response.json({ error: "Agente nao autorizado." }, { status: 401 });
  }

  const providedHash = createHash("sha256").update(apiKey).digest("hex");
  if ((tenant as TenantAgentRow & any).agent_api_key_hash) {
    if ((tenant as any).agent_api_key_hash !== providedHash) {
      return Response.json({ error: "Agente nao autorizado." }, { status: 401 });
    }
  } else if ((tenant as TenantAgentRow).agent_api_key !== apiKey) {
    return Response.json({ error: "Agente nao autorizado." }, { status: 401 });
  }

  if (!isNewerVersion(agentVersion, currentVersion)) {
    return new Response(null, { status: 204 });
  }

  const metadata = await getAgentBinaryMetadata();
  const origin = getAppOrigin(request);

  return Response.json({
    version: agentVersion,
    download_url: `${origin}/downloads/${agentFileName}`,
    sha256: metadata.sha256,
    size_bytes: metadata.sizeBytes,
  });
}
