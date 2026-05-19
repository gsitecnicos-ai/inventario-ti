import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function allowHttp(): boolean {
  if (process.env.ALLOW_HTTP === "true") return true;
  if (process.env.NODE_ENV === "development") return true;
  return false;
}

export function middleware(req: NextRequest) {
  const isAllowedHttp = allowHttp();

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const reqProtocol = forwardedProto ?? req.nextUrl.protocol; // e.g. 'http:' or 'https:'
  const isSecure = (typeof reqProtocol === "string" && reqProtocol.startsWith("https")) || forwardedProto === "https";

  if (!isAllowedHttp && !isSecure) {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();

  if (!isAllowedHttp) {
    // Enable HSTS for production environments to enforce HTTPS for subsequent requests.
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return res;
}

export const config = {
  matcher: "/:path*",
};
