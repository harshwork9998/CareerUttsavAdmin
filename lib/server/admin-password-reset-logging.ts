export function maskEmailForLog(email: string): string {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    return "****";
  }
  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (!domain) {
    return "****";
  }
  return `${localPart[0]}***@${domain}`;
}

type PasswordResetLogFields = Record<
  string,
  string | number | boolean | undefined
>;

function writePasswordResetLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: PasswordResetLogFields = {}
): void {
  const payload = { event, ...fields };
  if (level === "error") {
    console.error("[admin-password-reset]", payload);
    return;
  }
  if (level === "warn") {
    console.warn("[admin-password-reset]", payload);
    return;
  }
  console.info("[admin-password-reset]", payload);
}

export function logPasswordResetInfo(
  event: string,
  fields: PasswordResetLogFields = {}
): void {
  writePasswordResetLog("info", event, fields);
}

export function logPasswordResetWarning(
  event: string,
  fields: PasswordResetLogFields = {}
): void {
  writePasswordResetLog("warn", event, fields);
}

export function logPasswordResetError(
  event: string,
  fields: PasswordResetLogFields = {}
): void {
  writePasswordResetLog("error", event, fields);
}
