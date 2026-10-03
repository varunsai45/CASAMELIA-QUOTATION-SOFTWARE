import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
const allowed = new Set([
  "auth",
  "master-list",
  "quotations",
  "users",
  "settings",
  "customers",
  "price-conflicts",
  "audit-log",
  "dashboard",
  "branding",
  "health",
  "areas",
  "imports",
]);
async function forward(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  if (!allowed.has(path[0]) || path.some((p) => p === "." || p === ".."))
    return Response.json({ detail: "Route not found." }, { status: 404 });
  const base = process.env.API_URL || "http://127.0.0.1:18080";
  const headers = new Headers();
  for (const k of ["content-type", "cookie", "x-casa-request", "origin"]) {
    const value = request.headers.get(k);
    if (value) headers.set(k, value);
  }
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  if (body && body.byteLength > 5 * 1024 * 1024)
    return Response.json({ detail: "Request is too large." }, { status: 413 });
  try {
    const upstream = await fetch(
      base +
        "/" +
        path.map(encodeURIComponent).join("/") +
        request.nextUrl.search,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(60000),
      },
    );
    const resultHeaders = new Headers(upstream.headers);
    resultHeaders.delete("content-encoding");
    resultHeaders.delete("transfer-encoding");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resultHeaders,
    });
  } catch {
    return Response.json(
      { detail: "Quotation service is unavailable. Please try again." },
      { status: 502 },
    );
  }
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
