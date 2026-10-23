export type EmailProviderName = "resend" | "smtp";

export function resolveEmailProvider(): EmailProviderName {
  const raw = process.env.EMAIL_PROVIDER;
  if (raw === undefined || raw.trim() === "") {
    return "resend";
  }

  const provider = raw.trim().toLowerCase();
  if (provider === "resend" || provider === "smtp") {
    return provider;
  }

  throw new Error(
    `Invalid EMAIL_PROVIDER "${raw.trim()}". Expected "resend" or "smtp".`
  );
}
