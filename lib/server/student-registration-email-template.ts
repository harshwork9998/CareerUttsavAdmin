import {
  PARTNER_EMAIL_SUPPORT_EMAIL,
  PARTNER_EMAIL_SUPPORT_PHONE,
  escapePartnerEmailHtml,
  renderPartnerEmailDocument,
} from "@/lib/server/partner-email-layout";

export const STUDENT_REGISTRATION_EMAIL_SUBJECT =
  "You're Registered for Career Uttsav 2026 | Save Your Entry QR";

export const STUDENT_REGISTRATION_QR_CID = "registration-qr";

export const STUDENT_REGISTRATION_VENUE =
  "Gate No. 9, Princess Golf, Palace Grounds, Bengaluru";

const WEBSITE_DISPLAY = "www.careeruttsav.in";

const WHAT_TO_EXPECT = [
  "Explore traditional and new-age career pathways",
  "Interact with universities, colleges and education institutions",
  "Attend career-focused Panel Discussions and expert sessions",
  "Get guidance to help you understand your interests and next steps",
] as const;

export type StudentRegistrationEmailInput = {
  studentName: string;
  includeLogo?: boolean;
};

export function escapeStudentRegistrationHtml(value: string): string {
  return escapePartnerEmailHtml(value);
}

function cleanName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function studentRegistrationGreeting(studentName: string): {
  html: string;
  text: string;
} {
  const name = cleanName(studentName);
  if (!name) {
    return { html: "Hello,", text: "Hello," };
  }
  return {
    html: `Dear ${escapeStudentRegistrationHtml(name)},`,
    text: `Dear ${name},`,
  };
}

function whatToExpectRows(): string {
  return WHAT_TO_EXPECT
    .map(
      (item) => `<tr>
        <td valign="top" width="20" style="width:20px;padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#E5372B;">&#8226;</td>
        <td valign="top" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#3A3742;">${escapeStudentRegistrationHtml(item)}</td>
      </tr>`
    )
    .join("");
}

function registrationQrSectionHtml(): string {
  return `<tr>
            <td style="padding:8px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBFAF3;border:1px solid #E4E1D6;border-radius:20px;">
                <tr>
                  <td style="padding:22px 20px 6px 20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#E5372B;">Your Registration QR</td>
                </tr>
                <tr>
                  <td style="padding:0 20px 12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#3A3742;">
                    Keep this QR code saved on your phone for a smooth check-in at Career Uttsav.
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:8px 20px 16px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:2px solid #E4E1D6;border-radius:16px;">
                      <tr>
                        <td align="center" valign="middle" style="padding:14px;">
                          <img src="cid:${STUDENT_REGISTRATION_QR_CID}" width="136" height="136" alt="Registration QR Code" style="display:block;width:136px;height:136px;max-width:136px;border:0;margin:0 auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 22px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#3A3742;">
                    Save this email or take a screenshot of your QR code. You'll need it at the registration desk when you arrive.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

export function buildStudentRegistrationEmailContent(
  input: StudentRegistrationEmailInput
): { subject: string; html: string; text: string } {
  const greeting = studentRegistrationGreeting(input.studentName);
  const supportEmail = PARTNER_EMAIL_SUPPORT_EMAIL;
  const supportPhone = PARTNER_EMAIL_SUPPORT_PHONE;

  const html = renderPartnerEmailDocument({
    title: STUDENT_REGISTRATION_EMAIL_SUBJECT,
    eyebrow: "Registration Confirmed",
    heading: "You're all set for Career Uttsav 2026",
    subheading: "Your next step starts with exploring what's possible.",
    includeLogo: input.includeLogo,
    supportEmail,
    supportPhone,
    websiteUrl: WEBSITE_DISPLAY,
    bodyHtml: `<tr>
            <td style="padding:18px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3A3742;">
              <p style="margin:0 0 12px 0;">${greeting.html}</p>
              <p style="margin:0 0 12px 0;">Your registration for Career Uttsav 2026 is confirmed.</p>
              <p style="margin:0;">You're now all set to explore career possibilities, understand different education pathways and meet institutions and experts who can help you make more informed decisions about what comes next.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 32px 8px 32px;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:700;color:#14121A;padding:0 0 12px 0;">What you can look forward to</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${whatToExpectRows()}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBFAF3;border:1px solid #E4E1D6;border-radius:20px;">
                <tr>
                  <td style="padding:20px 20px 6px 20px;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;font-weight:700;color:#14121A;">Career Uttsav 2026</td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 4px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#14121A;font-weight:700;">
                    19&ndash;20 December 2026
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 20px 20px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6B6775;padding:0 0 6px 0;">Venue</div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;color:#14121A;font-weight:700;word-break:break-word;">${escapeStudentRegistrationHtml(STUDENT_REGISTRATION_VENUE)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${registrationQrSectionHtml()}
          <tr>
            <td style="padding:16px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3A3742;">
              We look forward to welcoming you to Career Uttsav 2026 and helping you discover what your tomorrow could look like.
            </td>
          </tr>`,
  });

  const text = [
    "You're Registered for Career Uttsav 2026",
    "",
    greeting.text,
    "",
    "Your registration for Career Uttsav 2026 is confirmed.",
    "",
    "You're now all set to explore career possibilities, understand different education pathways and meet institutions and experts who can help you make more informed decisions about what comes next.",
    "",
    "What you can look forward to",
    ...WHAT_TO_EXPECT.map((item) => `- ${item}`),
    "",
    "Event:",
    "19–20 December 2026",
    STUDENT_REGISTRATION_VENUE,
    "",
    "Your registration QR is included in the HTML version of this email. Please save the email or QR image for event check-in.",
    "",
    "We look forward to welcoming you to Career Uttsav 2026 and helping you discover what your tomorrow could look like.",
    "",
    "Warm regards,",
    "Team Career Uttsav",
    "",
    supportEmail,
    supportPhone,
    WEBSITE_DISPLAY,
  ].join("\n");

  return {
    subject: STUDENT_REGISTRATION_EMAIL_SUBJECT,
    html,
    text,
  };
}
