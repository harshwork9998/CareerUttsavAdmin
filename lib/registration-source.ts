export const REGISTRATION_SOURCES = [
  "WHATSAPP",
  "WEBSITE",
  "DIRECT_ENTRY",
  "UNKNOWN",
] as const;

export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];

export const REGISTRATION_SOURCE_LABELS: Record<RegistrationSource, string> = {
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website",
  DIRECT_ENTRY: "Direct Entry",
  UNKNOWN: "Unknown",
};

export function isRegistrationSource(value: unknown): value is RegistrationSource {
  return (
    typeof value === "string" &&
    (REGISTRATION_SOURCES as readonly string[]).includes(value)
  );
}

export function registrationSourceLabel(
  source: RegistrationSource | null | undefined
): string {
  if (!source || !isRegistrationSource(source)) {
    return REGISTRATION_SOURCE_LABELS.UNKNOWN;
  }
  return REGISTRATION_SOURCE_LABELS[source];
}
