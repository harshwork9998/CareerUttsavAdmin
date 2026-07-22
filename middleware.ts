import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PORTAL_ORIGIN =
  process.env.PARTNER_PORTAL_ORIGIN ?? "http://localhost:3001";

function withPartnerApiCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", PORTAL_ORIGIN);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

function isPartnerPortalApi(pathname: string) {
  return (
    pathname.startsWith("/api/partners") ||
    pathname.startsWith("/api/partner-portal")
  );
}

export function middleware(request: NextRequest) {
  if (!isPartnerPortalApi(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.method === "OPTIONS") {
    return withPartnerApiCors(new NextResponse(null, { status: 204 }));
  }

  return withPartnerApiCors(NextResponse.next());
}

export const config = {
  matcher: ["/api/partners/:path*", "/api/partner-portal/:path*"],
};
