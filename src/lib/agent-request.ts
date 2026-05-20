import { gunzipSync } from "node:zlib";

export async function parseJsonRequest<T>(request: Request): Promise<T> {
  const encoding = request.headers.get("content-encoding")?.toLowerCase() ?? "";
  const rawBody = Buffer.from(await request.arrayBuffer());
  const body = encoding.includes("gzip")
    ? gunzipSync(rawBody).toString("utf-8")
    : rawBody.toString("utf-8");

  return JSON.parse(body) as T;
}
