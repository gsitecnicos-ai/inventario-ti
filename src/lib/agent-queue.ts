import type { Json } from "./database.types";

export type AgentCheckinPayloadType = "inventory_snapshot" | "inventory_delta";

export async function queueAgentCheckin(
  supabase: any,
  tenantId: string,
  deviceId: string,
  payloadType: AgentCheckinPayloadType,
  payload: Json,
) {
  return await supabase.from("agent_checkin_queue").insert({
    tenant_id: tenantId,
    device_id: deviceId.toUpperCase(),
    payload_type: payloadType,
    payload,
  });
}
