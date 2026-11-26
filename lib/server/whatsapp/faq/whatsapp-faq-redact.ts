const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
const OTP_LABEL = /\b(otp|code|pin)\s*[:#-]?\s*\d{4,8}\b/gi;

export function redactWhatsAppFaqText(text: string): string {
  return text
    .replace(EMAIL, "[redacted-email]")
    .replace(OTP_LABEL, "[redacted-code]")
    .replace(PHONE, "[redacted-phone]");
}
