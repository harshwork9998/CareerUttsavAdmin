/**
 * OTP delivery provider resolution.
 * - Default: msg91
 * - Mock when OTP_PROVIDER=mock in local/dev
 * - Mock on a production host only with explicit ALLOW_MOCK_OTP=true (staging/test)
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

export function isMockOtpExplicitlyAllowed(
  raw: string | undefined = process.env.ALLOW_MOCK_OTP
): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function readOtpProviderName(
  raw = process.env.OTP_PROVIDER
): OtpProviderName {
  const value = (raw ?? "msg91").trim().toLowerCase();
  if (value === "mock") return "mock";
  return "msg91";
}

const DEV_PHONE_VERIFICATION_SECRET =
  "career-uttsav-phone-verification-dev-secret";

export function readPhoneVerificationTokenSecret(env: {
  PHONE_VERIFICATION_TOKEN_SECRET?: string;
  OTP_HASH_SECRET?: string;
}): string {
  return (
    env.PHONE_VERIFICATION_TOKEN_SECRET?.trim() ??
    env.OTP_HASH_SECRET?.trim() ??
    DEV_PHONE_VERIFICATION_SECRET
  );
}

function isPhoneVerificationSecretConfigured(env: {
  PHONE_VERIFICATION_TOKEN_SECRET?: string;
  OTP_HASH_SECRET?: string;
}): boolean {
  const secret = readPhoneVerificationTokenSecret(env);
  return Boolean(secret) && secret !== DEV_PHONE_VERIFICATION_SECRET;
}

/**
 * Resolve the active OTP provider.
 * Mock requires OTP_PROVIDER=mock. In production NODE_ENV it also needs
 * ALLOW_MOCK_OTP=true (for hosted staging/testing only).
 * MSG91 requires MSG91_AUTH_KEY + MSG91_TEMPLATE_ID.
 */
export function resolveOtpProvider(env: {
  OTP_PROVIDER?: string;
  ALLOW_MOCK_OTP?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  MSG91_AUTH_KEY?: string;
  MSG91_TEMPLATE_ID?: string;
  PHONE_VERIFICATION_TOKEN_SECRET?: string;
  OTP_HASH_SECRET?: string;
} = process.env): ResolveOtpProviderResult {
  const provider = readOtpProviderName(env.OTP_PROVIDER);
  const production = isProductionEnv(env.NODE_ENV, env.VERCEL_ENV);

  if (provider === "mock") {
    if (production && !isMockOtpExplicitlyAllowed(env.ALLOW_MOCK_OTP)) {
      return {
        ok: false,
        status: 503,
        error:
          "OTP mock provider is not allowed in production unless ALLOW_MOCK_OTP=true. Prefer OTP_PROVIDER=msg91 with MSG91 keys.",
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

  if (
    production &&
    !isPhoneVerificationSecretConfigured({
      PHONE_VERIFICATION_TOKEN_SECRET: env.PHONE_VERIFICATION_TOKEN_SECRET,
      OTP_HASH_SECRET: env.OTP_HASH_SECRET,
    })
  ) {
    return {
      ok: false,
      status: 503,
      error:
        "Phone verification is not configured. Set PHONE_VERIFICATION_TOKEN_SECRET on the server.",
    };
  }

  return { ok: true, provider: "msg91" };
}
