import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PORTAL_ORIGIN =
  process.env.PARTNER_PORTAL_ORIGIN ?? "http://localhost:3001";

const DEFAULT_PUBLIC_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const PUBLIC_ORIGINS = (
  process.env.PUBLIC_SITE_ORIGINS ?? DEFAULT_PUBLIC_ORIGINS.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function withCors(response: NextResponse, origin: string | null) {
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function resolveAllowedOrigin(
  request: NextRequest,
  allowed: string[]
): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return allowed[0] ?? null;
  if (allowed.includes(origin) || allowed.includes("*")) return origin;
  // Local dev: allow any localhost / 127.0.0.1 port (Live Server, Python, Vite, etc.)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return null;
}

function isPartnerPortalApi(pathname: string) {
  return (
    pathname.startsWith("/api/partners") ||
    pathname.startsWith("/api/partner-portal")
  );
}

function isPublicRegistrationApi(pathname: string) {
  return pathname.startsWith("/api/registrations");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPartnerPortalApi(pathname)) {
    if (request.method === "OPTIONS") {
      return withCors(new NextResponse(null, { status: 204 }), PORTAL_ORIGIN);
    }
    return withCors(NextResponse.next(), PORTAL_ORIGIN);
  }

  if (isPublicRegistrationApi(pathname)) {
    const origin = resolveAllowedOrigin(request, PUBLIC_ORIGINS);
    if (request.method === "OPTIONS") {
      if (!origin) {
        return new NextResponse(null, { status: 403 });
      }
      return withCors(new NextResponse(null, { status: 204 }), origin);
    }
    if (!origin && request.headers.get("origin")) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }
    return withCors(NextResponse.next(), origin);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/partners/:path*",
    "/api/partner-portal/:path*",
    "/api/registrations",
    "/api/registrations/:path*",
  ],
};
