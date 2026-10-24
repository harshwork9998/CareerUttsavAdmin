import {
  PARTNER_EMAIL_SUPPORT_EMAIL,
  PARTNER_EMAIL_SUPPORT_PHONE,
  escapePartnerEmailHtml,
  renderPartnerEmailDocument,
} from "@/lib/server/partner-email-layout";

const SUPPORT_EMAIL_DEFAULT = PARTNER_EMAIL_SUPPORT_EMAIL;
const SUPPORT_PHONE_DEFAULT = PARTNER_EMAIL_SUPPORT_PHONE;

const CAPABILITIES = [
  "Complete your institution profile and participation details",
  "Upload your logo, creatives and required collaterals",
  "View/confirm your panel discussion topic and representation",
  "Submit speaker details, profile and photograph",
  "Add attending team members to help us plan and coordinate the onboarding process more effectively for the event.",
] as const;

export type PartnerAccessEmailInput = {
  institutionName: string;
  portalUrl: string;
  portalLogin: string;
  temporaryPassword: string;
  dueDate?: string | null;
  supportEmail?: string;
  supportPhone?: string | null;
  /** When true, the header image uses the CID attachment from the sender. */
  includeLogo?: boolean;
};

export function escapePartnerAccessHtml(value: string): string {
  return escapePartnerEmailHtml(value);
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].+)?$/;

export function formatPartnerAccessDueDate(
  dueDate: string | null | undefined
): string | null {
  const value = clean(dueDate);
  if (!value || value === "{Due Date}") return null;
  const match = value.match(ISO_DATE);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const isRealDay =
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day;
  if (!isRealDay) return value;
  const instant = value.includes("T") || value.includes(" ")
    ? new Date(value)
    : new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(instant.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(instant);
}

export function partnerAccessDeadlineCopy(dueDateLabel: string | null): string {
  if (dueDateLabel) {
    return `Kindly complete the required information by ${dueDateLabel}. Information submitted through the portal will be used for event planning, collaterals, panel discussion schedules, speaker communication and on-ground arrangements.`;
  }
  return "Kindly complete the required information at the earliest. Information submitted through the portal will be used for event planning, collaterals, panel discussion schedules, speaker communication and on-ground arrangements.";
}

export function buildPartnerAccessSubject(institutionName: string): string {
  const name = clean(institutionName) || "your institution";
  return `You're Onboard! Let's Get ${name} Event-Ready`;
}

function capabilityRows(items: readonly string[]): string {
  return items
    .map(
      (item) => `<tr>
        <td valign="top" width="28" style="width:28px;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#E5372B;font-weight:700;">&#10003;</td>
        <td valign="top" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#3A3742;">${escapePartnerAccessHtml(item)}</td>
      </tr>`
    )
    .join("");
}

function detailRow(label: string, value: string, monospace = false): string {
  const valueStyle = monospace
    ? "font-family:Consolas,'Courier New',monospace;font-size:16px;letter-spacing:0.04em;color:#14121A;background:#ffffff;border:1px solid #E4E1D6;border-radius:12px;padding:12px 14px;word-break:break-all;"
    : "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#14121A;font-weight:700;word-break:break-all;";
  return `<tr>
    <td style="padding:0 0 14px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6B6775;padding:0 0 6px 0;">${escapePartnerAccessHtml(label)}</div>
      <div style="${valueStyle}">${escapePartnerAccessHtml(value)}</div>
    </td>
  </tr>`;
}

export function buildPartnerAccessEmailContent(
  input: PartnerAccessEmailInput
): { subject: string; html: string; text: string } {
  const institutionName = clean(input.institutionName) || "Partner";
  const portalUrl = clean(input.portalUrl);
  const portalLogin = clean(input.portalLogin);
  const temporaryPassword = input.temporaryPassword ?? "";
  const supportEmail = clean(input.supportEmail) || SUPPORT_EMAIL_DEFAULT;
  const supportPhone = clean(input.supportPhone) || SUPPORT_PHONE_DEFAULT;
  const dueDateLabel = formatPartnerAccessDueDate(input.dueDate);
  const deadline = partnerAccessDeadlineCopy(dueDateLabel);
  const subject = buildPartnerAccessSubject(institutionName);
  const safeName = escapePartnerAccessHtml(institutionName);
  const safeUrl = escapePartnerAccessHtml(portalUrl);

  const html = renderPartnerEmailDocument({
    title: subject,
    heading: `Welcome aboard, ${institutionName}`,
    includeLogo: input.includeLogo,
    supportEmail,
    supportPhone,
    bodyHtml: `<tr>
            <td style="padding:18px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3A3742;">
              <p style="margin:0 0 12px 0;">Dear ${safeName} Team,</p>
              <p style="margin:0 0 12px 0;">We're delighted to welcome you as a participating partner at Career Uttsav 2026.</p>
              <p style="margin:0;">Your Partner Portal is now active. It will be the central space for sharing and managing the information required for your participation and event presence.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 8px 32px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:700;color:#14121A;padding:0 0 12px 0;">Through the portal, you can:</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${capabilityRows(CAPABILITIES)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBFAF3;border:1px solid #E4E1D6;border-radius:20px;">
                <tr>
                  <td style="padding:20px 20px 6px 20px;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;font-weight:700;color:#14121A;">Your Login Details</td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 8px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${detailRow("Partner Portal", portalUrl)}
                      ${detailRow("Login ID", portalLogin)}
                      ${detailRow("Temporary Password", temporaryPassword, true)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#E5372B" style="background:#E5372B;border-radius:999px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">ACCESS PARTNER PORTAL &#8594;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#3A3742;">
              Please change your password after your first login and keep the credentials within your authorised team.
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#3A3742;">
              ${escapePartnerAccessHtml(deadline)}
            </td>
          </tr>`,
  });

  const text = [
    `Welcome aboard, ${institutionName}`,
    "",
    `Dear ${institutionName} Team,`,
    "",
    "We're delighted to welcome you as a participating partner at Career Uttsav 2026.",
    "",
    "Your Partner Portal is now active. It will be the central space for sharing and managing the information required for your participation and event presence.",
    "",
    "Through the portal, you can:",
    ...CAPABILITIES.map((item) => `- ${item}`),
    "",
    "Your Login Details",
    `Partner Portal: ${portalUrl}`,
    `Login ID: ${portalLogin}`,
    `Temporary Password: ${temporaryPassword}`,
    "",
    `ACCESS PARTNER PORTAL: ${portalUrl}`,
    "",
    "Please change your password after your first login and keep the credentials within your authorised team.",
    "",
    deadline,
    "",
    "Warm regards,",
    "Team Career Uttsav",
    "",
    "Support:",
    `${supportEmail} | ${supportPhone}`,
  ].join("\n");

  return { subject, html, text };
}
