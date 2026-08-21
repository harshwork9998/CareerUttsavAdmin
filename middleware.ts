import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  DEFAULT_PUBLIC_REGISTRATION_ORIGINS,
  parseOriginList,
  resolvePartnerPortalApiOrigin,
  resolveRegistrationApiOrigin,
} from "@/lib/server/request-origin";

const DEFAULT_PARTNER_PORTAL_ORIGINS = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://partners.careeruttsav.in",
];

const PARTNER_PORTAL_ORIGINS = parseOriginList(
  process.env.PARTNER_PORTAL_ORIGINS ??
    process.env.PARTNER_PORTAL_ORIGIN ??
    DEFAULT_PARTNER_PORTAL_ORIGINS.join(","),
  DEFAULT_PARTNER_PORTAL_ORIGINS
);

const PUBLIC_ORIGINS = parseOriginList(
  process.env.PUBLIC_SITE_ORIGINS,
  DEFAULT_PUBLIC_REGISTRATION_ORIGINS
);

function withCors(response: NextResponse, origin: string | null) {
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, x-cu-client"
  );
  return response;
}

function isPartnerPortalApi(pathname: string) {
  return (
    pathname.startsWith("/api/partners") ||
    pathname.startsWith("/api/partner-portal")
  );
}

function isPublicRegistrationApi(pathname: string) {
  return (
    pathname.startsWith("/api/registrations") ||
    pathname === "/api/send-otp" ||
    pathname === "/api/verify-otp"
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPartnerPortalApi(pathname)) {
    const origin = resolvePartnerPortalApiOrigin(
      request.headers,
      PARTNER_PORTAL_ORIGINS
    );
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

  if (isPublicRegistrationApi(pathname)) {
    const origin = resolveRegistrationApiOrigin(
      request.headers,
      PUBLIC_ORIGINS
    );
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
    "/api/registrations/check",
    "/api/registrations/:path*",
    "/api/send-otp",
    "/api/verify-otp",
  ],
};
