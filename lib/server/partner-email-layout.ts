import { readFile } from "fs/promises";
import path from "path";

export const PARTNER_EMAIL_SUPPORT_EMAIL = "info@careeruttsav.in";
export const PARTNER_EMAIL_SUPPORT_PHONE = "+91 91130 64877";
export const PARTNER_EMAIL_SUPPORT_LINE = `${PARTNER_EMAIL_SUPPORT_EMAIL} | ${PARTNER_EMAIL_SUPPORT_PHONE}`;
export const PARTNER_EMAIL_DUE_DATE_LABEL = "1 December 2026";
export const PARTNER_EMAIL_LOGO_CID = "career-uttsav-logo";

const LOGO_PATH = path.join(
  process.cwd(),
  "public",
  "images",
  "career-uttsav-logo.png"
);

export function escapePartnerEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function loadPartnerEmailLogo(): Promise<string | null> {
  try {
    const bytes = await readFile(LOGO_PATH);
    return bytes.toString("base64");
  } catch {
    return null;
  }
}

export function partnerEmailLogoHtml(includeLogo: boolean | undefined): string {
  return includeLogo
    ? `<img src="cid:${PARTNER_EMAIL_LOGO_CID}" width="168" alt="Career Uttsav" style="display:block;width:168px;max-width:100%;height:auto;border:0;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;font-weight:700;color:#14121A;">Career Uttsav</div>`;
}

export function partnerEmailCta(href: string, label: string): string {
  const safeHref = escapePartnerEmailHtml(href);
  const safeLabel = escapePartnerEmailHtml(label);
  return `<tr>
            <td align="center" style="padding:22px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#E5372B" style="background:#E5372B;border-radius:999px;">
                    <a href="${safeHref}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${safeLabel} &#8594;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function partnerEmailParagraphs(paragraphs: string[]): string {
  const html = paragraphs
    .map(
      (paragraph, index) =>
        `<p style="margin:0${index === paragraphs.length - 1 ? "" : " 0 12px 0"};">${escapePartnerEmailHtml(paragraph)}</p>`
    )
    .join("");
  return `<tr>
            <td style="padding:18px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3A3742;">
              ${html}
            </td>
          </tr>`;
}

export function partnerEmailNote(text: string): string {
  return `<tr>
            <td style="padding:8px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#3A3742;">
              ${escapePartnerEmailHtml(text)}
            </td>
          </tr>`;
}

export function partnerEmailBulletList(title: string, items: string[]): string {
  const rows = items
    .map(
      (item) => `<tr>
        <td valign="top" width="28" style="width:28px;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#E5372B;font-weight:700;">&#10003;</td>
        <td valign="top" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#3A3742;">${escapePartnerEmailHtml(item)}</td>
      </tr>`
    )
    .join("");
  return `<tr>
            <td style="padding:22px 32px 8px 32px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:700;color:#14121A;padding:0 0 12px 0;">${escapePartnerEmailHtml(title)}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${rows}
              </table>
            </td>
          </tr>`;
}

export function partnerEmailDetailCard(
  title: string,
  blocks: Array<{ rows: Array<{ label: string; value: string }> }>
): string {
  const blocksHtml = blocks
    .map((block, index) => {
      const rows = block.rows
        .map(
          (row) => `<tr>
    <td style="padding:0 0 14px 0;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6B6775;padding:0 0 6px 0;">${escapePartnerEmailHtml(row.label)}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#14121A;font-weight:700;word-break:break-word;">${escapePartnerEmailHtml(row.value)}</div>
    </td>
  </tr>`
        )
        .join("");
      const divider =
        index > 0
          ? `<tr><td style="padding:0 20px 8px 20px;"><div style="border-top:1px solid #E4E1D6;font-size:0;line-height:0;">&nbsp;</div></td></tr>`
          : "";
      return `${divider}<tr>
                  <td style="padding:8px 20px 8px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${rows}
                    </table>
                  </td>
                </tr>`;
    })
    .join("");
  return `<tr>
            <td style="padding:8px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBFAF3;border:1px solid #E4E1D6;border-radius:20px;">
                <tr>
                  <td style="padding:20px 20px 6px 20px;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;font-weight:700;color:#14121A;">${escapePartnerEmailHtml(title)}</td>
                </tr>
                ${blocksHtml}
              </table>
            </td>
          </tr>`;
}

export function renderPartnerEmailDocument(input: {
  title: string;
  heading: string;
  bodyHtml: string;
  includeLogo?: boolean;
  eyebrow?: string;
  subheading?: string;
  supportEmail?: string;
  supportPhone?: string;
  websiteUrl?: string;
}): string {
  const title = escapePartnerEmailHtml(input.title);
  const heading = escapePartnerEmailHtml(input.heading);
  const eyebrow = escapePartnerEmailHtml(input.eyebrow ?? "Partner Portal");
  const subheading = input.subheading
    ? `<p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#3A3742;">${escapePartnerEmailHtml(input.subheading)}</p>`
    : "";
  const supportEmail = input.supportEmail?.trim() || PARTNER_EMAIL_SUPPORT_EMAIL;
  const supportPhone = input.supportPhone?.trim() || PARTNER_EMAIL_SUPPORT_PHONE;
  const safeEmail = escapePartnerEmailHtml(supportEmail);
  const safePhone = escapePartnerEmailHtml(supportPhone);
  const websiteUrl = (input.websiteUrl ?? "").trim();
  const websiteLine = websiteUrl
    ? `<div style="padding-top:10px;">Website:<br /><a href="${escapePartnerEmailHtml(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl.replace(/^\/\//, "")}`)}" style="color:#E5372B;font-weight:700;text-decoration:none;">${escapePartnerEmailHtml(websiteUrl.replace(/^https?:\/\//, ""))}</a></div>`
    : "";
  const logo = partnerEmailLogoHtml(input.includeLogo);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#FBFAF3;">
  <!-- partner-email-shell -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBFAF3;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #E4E1D6;border-radius:28px;">
          <tr>
            <td bgcolor="#E5372B" height="8" style="height:8px;font-size:0;line-height:0;background:#E5372B;border-radius:28px 28px 0 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              ${logo}
              <div style="padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#E5372B;">${eyebrow}</div>
              <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:700;color:#14121A;word-break:break-word;">${heading}</h1>
              ${subheading}
            </td>
          </tr>
          ${input.bodyHtml}
          <tr>
            <td style="padding:18px 32px 28px 32px;border-top:1px solid #E4E1D6;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#3A3742;">
              <div style="color:#14121A;">Warm regards,</div>
              <div style="padding-top:4px;font-weight:700;color:#14121A;">Team Career Uttsav</div>
              <div style="padding-top:12px;">Support:<br /><a href="mailto:${safeEmail}" style="color:#E5372B;font-weight:700;text-decoration:none;">${safeEmail}</a> | <span style="color:#3A3742;">${safePhone}</span></div>
              ${websiteLine}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderPartnerEmailText(input: {
  lines: string[];
  supportEmail?: string;
  supportPhone?: string;
}): string {
  const supportEmail = input.supportEmail?.trim() || PARTNER_EMAIL_SUPPORT_EMAIL;
  const supportPhone = input.supportPhone?.trim() || PARTNER_EMAIL_SUPPORT_PHONE;
  return [...input.lines, "", "Warm regards,", "Team Career Uttsav", "", "Support:", `${supportEmail} | ${supportPhone}`].join(
    "\n"
  );
}
