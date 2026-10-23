export const LINKEDIN_PROFILE_INVALID_MESSAGE =
  "Enter a valid LinkedIn profile URL.";

/** Empty values are allowed. A non-empty value must be an http(s) URL. */
export function validateLinkedInProfile(
  value: string | null | undefined
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return { ok: true, value: "" };

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, error: LINKEDIN_PROFILE_INVALID_MESSAGE };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, error: LINKEDIN_PROFILE_INVALID_MESSAGE };
  }
}
