import { createHash, randomBytes } from "crypto";

/** Password reset links expire after 30 minutes. */
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export const INVALID_RESET_LINK_MESSAGE =
  "Reset link is invalid or has expired.";

export function generateRawResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildPasswordResetUrl(rawToken: string): string {
  const base =
    process.env.ADMIN_LOGIN_URL?.trim() || "https://admin.careeruttsav.in";
  const normalizedBase = base.replace(/\/$/, "");
  return `${normalizedBase}/reset-password?token=${encodeURIComponent(rawToken)}`;
}
