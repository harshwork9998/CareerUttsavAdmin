import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "cu-admin-session";

const SESSION_VERSION = 1;
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const REMEMBER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionPayload = {
  v: number;
  userId: string;
  iat: number;
  exp: number;
};

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not set");
  }
  return secret;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    ) as SessionPayload;
    if (
      typeof parsed.v !== "number" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createAdminSessionToken(input: {
  userId: string;
  rememberMe?: boolean;
}): string {
  const now = Date.now();
  const ttl = input.rememberMe ? REMEMBER_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS;
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    userId: input.userId,
    iat: now,
    exp: now + ttl,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminSessionToken(token: string | undefined): {
  userId: string;
} | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  const payload = decodePayload(encoded);
  if (!payload || payload.v !== SESSION_VERSION) return null;
  if (payload.exp <= Date.now()) return null;

  return { userId: payload.userId };
}

export function adminSessionCookieOptions(rememberMe = false) {
  const maxAge = Math.floor(
    (rememberMe ? REMEMBER_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS) / 1000
  );
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function getAdminSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = verifyAdminSessionToken(token);
  return session?.userId ?? null;
}

export function buildAdminSessionSetCookie(
  token: string,
  rememberMe = false
): string {
  const opts = adminSessionCookieOptions(rememberMe);
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function buildAdminSessionClearCookie(): string {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=lax",
  ];
  if (isProduction()) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
