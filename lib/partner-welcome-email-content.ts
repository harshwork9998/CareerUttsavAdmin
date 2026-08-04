export const PARTNER_PORTAL_URL =
  process.env.NEXT_PUBLIC_PARTNER_PORTAL_URL ?? "https://www.careeruttsav.in";

export const PARTNER_WELCOME_EMAIL_SUBJECT =
  "Your Career Uttsav partner portal login";

export type PartnerWelcomeEmailInput = {
  partnerName: string;
  login: string;
  temporaryPassword: string;
};

export function applyTemplatePlaceholders(
  html: string,
  values: Record<string, string>
): string {
  return Object.entries(values).reduce((output, [key, value]) => {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    return output.replace(pattern, value);
  }, html);
}

/** Plain-text fallback (matches the HTML template wording exactly). */
export function buildPartnerWelcomePlainText(
  input: PartnerWelcomeEmailInput
): string {
  return `Welcome to Career Uttsav!

Hello ${input.partnerName}!

Thank you for partnering with Career Uttsav. Your partner dashboard is now set up. Use the login details below to sign in, review your partnership package, and upload the brand assets we need before the event.

Inside your partner dashboard:
  • View your confirmed partnership package and deliverables
  • Check seminar panelist slots allotted to your institution
  • Upload your logo, banner, and other required documents
  • Stay updated on partnership milestones and event details

PARTNER PORTAL LOGIN
Login ID: ${input.login}
Temporary password: ${input.temporaryPassword}

Sign in via Partner Login on our website: ${PARTNER_PORTAL_URL}
Please change your password after your first login.

Store these credentials securely and do not share them outside your team.

What to do next:
1. Sign in to the partner portal using the credentials above
2. Review your partnership details and deliverables
3. Upload your logo, banner, and any other requested documents

If you need help signing in, write to us at info@careeruttsav.in.

We look forward to working with you at Career Uttsav!

Thanks & Regards,
Team Career Uttsav
K2 Learning Resources India Pvt. Ltd.

info@careeruttsav.in | www.careeruttsav.in`;
}

export function buildPartnerWelcomeHtmlFromTemplate(
  template: string,
  input: PartnerWelcomeEmailInput
): string {
  return applyTemplatePlaceholders(template, {
    partnerName: input.partnerName.trim() || "Partner",
    loginId: input.login,
    password: input.temporaryPassword,
    portalUrl: PARTNER_PORTAL_URL,
  });
}
