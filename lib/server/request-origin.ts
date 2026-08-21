/**
 * Proxy-aware origin resolution for Admin APIs behind Nginx.
 * Reused by registration and partner-portal middleware guards.
 */

export function resolveExternalRequestHost(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-host");
  const host = (
    forwarded?.split(",")[0]?.trim() ||
    headers.get("host") ||
    ""
  ).toLowerCase();
  return host.length > 0 ? host : null;
}

/** Browser Origin matches the public host seen by the reverse proxy. */
export function resolveProxyAwareSameOrigin(
  origin: string | null,
  externalHost: string | null
): string | null {
  if (!origin || origin === "null" || !externalHost) {
    return null;
  }

  try {
    const originHost = new URL(origin).host.toLowerCase();
    if (originHost === externalHost) {
      return origin;
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveAllowedOriginFromList(
  origin: string | null,
  allowed: string[]
): string | null {
  if (!origin) return allowed[0] ?? null;
  // file:// pages send Origin: "null" — allow for local HTML testing
  if (origin === "null") return "null";
  if (allowed.includes(origin) || allowed.includes("*")) return origin;
  // Local dev: allow any localhost / 127.0.0.1 port (Live Server, Python, Vite, etc.)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return null;
}

export function resolveApiOrigin(
  headers: Headers,
  allowedOrigins: string[]
): string | null {
  const origin = headers.get("origin");
  const sameOrigin = resolveProxyAwareSameOrigin(
    origin,
    resolveExternalRequestHost(headers)
  );
  if (sameOrigin) {
    return sameOrigin;
  }
  return resolveAllowedOriginFromList(origin, allowedOrigins);
}

export const DEFAULT_PUBLIC_REGISTRATION_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "https://new.careeruttsav.in",
  "https://www.careeruttsav.in",
  "https://careeruttsav.in",
] as const;

export function parseOriginList(
  value: string | undefined,
  fallback: readonly string[]
): string[] {
  return (value ?? fallback.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveRegistrationApiOrigin(
  headers: Headers,
  publicOrigins: string[]
): string | null {
  return resolveApiOrigin(headers, publicOrigins);
}

export function resolvePartnerPortalApiOrigin(
  headers: Headers,
  partnerOrigins: string[]
): string | null {
  return resolveApiOrigin(headers, partnerOrigins);
}
