import { gunzipSync } from "node:zlib";

export async function parseAgentJsonRequest<T>(request: Request): Promise<T> {
  const buffer = Buffer.from(await request.arrayBuffer());
  const contentEncoding = request.headers.get("content-encoding")?.toLowerCase() ?? "";
  const rawBody = contentEncoding.includes("gzip") ? gunzipSync(buffer) : buffer;

  if (!rawBody || rawBody.length === 0) {
    throw new Error("JSON vazio");
  }

  return JSON.parse(rawBody.toString("utf8")) as T;
}
