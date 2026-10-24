import {
  generateRegistrationQrPngBase64,
  sendEmail,
  type SendEmailResult,
} from "@/lib/email";
import {
  loadPartnerEmailLogo,
  PARTNER_EMAIL_LOGO_CID,
} from "@/lib/server/partner-email-layout";
import {
  buildStudentRegistrationEmailContent,
  STUDENT_REGISTRATION_QR_CID,
} from "@/lib/server/student-registration-email-template";

export type StudentWelcomeEmailInput = {
  to: string;
  name: string;
  /** Unique registration identifier encoded into the QR code */
  registrationId: string;
};

/**
 * Send the Career Uttsav student registration confirmation email.
 * Failures are returned to the caller — registration flows should not abort on them.
 */
export async function sendStudentWelcomeEmail(
  input: StudentWelcomeEmailInput
): Promise<SendEmailResult> {
  const [logoContent, qrContent] = await Promise.all([
    loadPartnerEmailLogo(),
    generateRegistrationQrPngBase64(input.registrationId),
  ]);

  const message = buildStudentRegistrationEmailContent({
    studentName: input.name,
    includeLogo: Boolean(logoContent),
  });

  const attachments = [
    {
      filename: "registration-qr.png",
      content: qrContent,
      contentId: STUDENT_REGISTRATION_QR_CID,
    },
    ...(logoContent
      ? [
          {
            filename: "career-uttsav-logo.png",
            content: logoContent,
            contentId: PARTNER_EMAIL_LOGO_CID,
          },
        ]
      : []),
  ];

  return sendEmail({
    to: input.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    attachments,
    tags: [
      { name: "category", value: "student-welcome" },
      { name: "registration_id", value: input.registrationId.slice(0, 64) },
    ],
  });
}
