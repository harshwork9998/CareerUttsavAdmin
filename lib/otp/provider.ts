/**
 * OTP delivery provider resolution.
 * - Default: msg91
 * - Mock only when OTP_PROVIDER=mock (never in production)
 */

export type OtpProviderName = "msg91" | "mock";

export type ResolveOtpProviderResult =
  | { ok: true; provider: OtpProviderName }
  | { ok: false; status: 503; error: string };

export function isProductionEnv(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): boolean {
  return nodeEnv === "production" || vercelEnv === "production";
}

export function readOtpProviderName(
  raw = process.env.OTP_PROVIDER
): OtpProviderName {
  const value = (raw ?? "msg91").trim().toLowerCase();
  if (value === "mock") return "mock";
  return "msg91";
}

/**
 * Resolve the active OTP provider.
 * Mock requires explicit OTP_PROVIDER=mock and is refused in production.
 * MSG91 requires MSG91_AUTH_KEY + MSG91_TEMPLATE_ID.
 */
export function resolveOtpProvider(env: {
  OTP_PROVIDER?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  MSG91_AUTH_KEY?: string;
  MSG91_TEMPLATE_ID?: string;
} = process.env): ResolveOtpProviderResult {
  const provider = readOtpProviderName(env.OTP_PROVIDER);
  const production = isProductionEnv(env.NODE_ENV, env.VERCEL_ENV);

  if (provider === "mock") {
    if (production) {
      return {
        ok: false,
        status: 503,
        error:
          "OTP mock provider is not allowed in production. Set OTP_PROVIDER=msg91.",
      };
    }
    return { ok: true, provider: "mock" };
  }

  const authKey = env.MSG91_AUTH_KEY?.trim() ?? "";
  const templateId = env.MSG91_TEMPLATE_ID?.trim() ?? "";
  if (!authKey || !templateId) {
    return {
      ok: false,
      status: 503,
      error:
        "MSG91 is not configured. Set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID.",
    };
  }

  return { ok: true, provider: "msg91" };
}
