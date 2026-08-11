/**
 * Shared Indian mobile normalization / validation for Admin dashboard fields.
 *
 * Canonical form: exactly 10 digits, first digit 6–9.
 * Accepts pasted +91 / 91 / leading 0 / spaces / hyphens.
 *
 * OTP keeps using lib/otp/phone.ts until a dedicated OTP change; algorithms match.
 */

export const INDIAN_MOBILE_ERROR =
  "Enter a valid 10-digit Indian mobile number (starts with 6–9)";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/** Strip non-digits from a raw input (for controlled UI typing). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normalize user input to a canonical 10-digit Indian mobile, or null if invalid.
 * Handles: 10-digit, 91XXXXXXXXXX, +91…, 0XXXXXXXXXX, spaces/hyphens.
 */
export function normalizeIndianMobileInput(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const digits = digitsOnly(phone);

  let ten: string;
  if (digits.length === 10) {
    ten = digits;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    ten = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    ten = digits.slice(1);
  } else {
    return null;
  }

  if (!INDIAN_MOBILE_REGEX.test(ten)) return null;
  return ten;
}

export function isValidIndianMobile(phone: unknown): boolean {
  return normalizeIndianMobileInput(phone) !== null;
}

/**
 * For create/replace: require a valid mobile and return the canonical 10 digits.
 */
export function requireIndianMobile(
  phone: unknown,
  label = "Mobile number"
): { ok: true; mobile: string } | { ok: false; error: string } {
  const mobile = normalizeIndianMobileInput(phone);
  if (!mobile) {
    return {
      ok: false,
      error: `${label}: ${INDIAN_MOBILE_ERROR}`,
    };
  }
  return { ok: true, mobile };
}

/**
 * Validate a phone on write without rejecting unchanged historical values.
 *
 * - Unchanged vs previous (trim) → keep previous as-is (no rewrite)
 * - Empty next → ok if not required; error if required
 * - Changed / new non-empty → must be valid Indian mobile (canonicalized)
 */
export function validateIndianMobileOnWrite(
  next: string | undefined | null,
  previous: string | undefined | null,
  options?: { required?: boolean; label?: string }
): { ok: true; value: string } | { ok: false; error: string } {
  const label = options?.label ?? "Mobile number";
  const required = options?.required ?? false;
  const nextTrim = typeof next === "string" ? next.trim() : "";
  const prevTrim = typeof previous === "string" ? previous.trim() : "";

  if (nextTrim === prevTrim) {
    return { ok: true, value: previous ?? nextTrim };
  }

  if (!nextTrim) {
    if (required) {
      return { ok: false, error: `${label} is required` };
    }
    return { ok: true, value: "" };
  }

  const mobile = normalizeIndianMobileInput(nextTrim);
  if (!mobile) {
    return { ok: false, error: `${label}: ${INDIAN_MOBILE_ERROR}` };
  }
  return { ok: true, value: mobile };
}

/**
 * Manual typing only: digits only, hard cap at 10 (never accept an 11th digit).
 * Paste must use {@link resolveIndianMobilePaste} — do not slice arbitrary pastes.
 */
export function constrainIndianMobileTyping(raw: string): string {
  return digitsOnly(raw).slice(0, 10);
}

/**
 * Paste handling: normalize recognized +91 / 91 / 0 / spaced formats to 10 digits.
 * Returns null for invalid pastes — callers must not truncate into a valid number.
 */
export function resolveIndianMobilePaste(clipboard: string): string | null {
  return normalizeIndianMobileInput(clipboard);
}
