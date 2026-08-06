/**
 * Indian mobile normalization for OTP.
 * Internal form: 10 digits. MSG91 form: 91XXXXXXXXXX.
 */

/**
 * Accepts 10-digit, 91XXXXXXXXXX, or +91XXXXXXXXXX (and 0XXXXXXXXXX).
 * Returns 10-digit mobile starting 6–9, or null if invalid.
 */
export function normalizeOtpPhone(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");

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

  if (!/^[6-9]\d{9}$/.test(ten)) return null;
  return ten;
}

/** Format for MSG91 APIs: 91XXXXXXXXXX */
export function toMsg91Mobile(tenDigitPhone: string): string {
  return `91${tenDigitPhone}`;
}
