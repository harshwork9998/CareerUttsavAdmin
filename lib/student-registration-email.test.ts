import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateRegistrationQrPngBase64, sendEmail } from "@/lib/email";
import { sendStudentWelcomeEmail } from "@/lib/server/student-registration-email";
import {
  buildStudentRegistrationEmailContent,
  escapeStudentRegistrationHtml,
  STUDENT_REGISTRATION_EMAIL_SUBJECT,
  STUDENT_REGISTRATION_QR_CID,
  STUDENT_REGISTRATION_VENUE,
  studentRegistrationGreeting,
} from "@/lib/server/student-registration-email-template";
import { PARTNER_EMAIL_LOGO_CID } from "@/lib/server/partner-email-layout";

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...actual,
    sendEmail: vi.fn(),
  };
});

const FORBIDDEN_PHRASES = [
  "WhatsApp Community",
  "Join WhatsApp Community",
  "Stay connected",
  "unlock exclusive perks",
  "Welcome aboard",
  "professional growth",
  "journey to career growth",
  "accelerate your professional growth",
  "industry leaders",
  "incredible experience",
  "community announcements",
  "Bring your best self",
  "unlock amazing opportunities",
];

function built(overrides: { studentName?: string; includeLogo?: boolean } = {}) {
  return buildStudentRegistrationEmailContent({
    studentName: overrides.studentName ?? "Aarav Sharma",
    includeLogo: overrides.includeLogo ?? true,
  });
}

describe("student registration confirmation email template", () => {
  it("uses the required subject and registration-confirmed wording", () => {
    const message = built();
    expect(message.subject).toBe(STUDENT_REGISTRATION_EMAIL_SUBJECT);
    expect(message.subject).toBe(
      "You're Registered for Career Uttsav 2026 | Save Your Entry QR"
    );
    expect(message.html).toContain("Registration Confirmed");
    expect(message.html).toContain("Your registration for Career Uttsav 2026 is confirmed.");
    expect(message.text).toContain("Your registration for Career Uttsav 2026 is confirmed.");
  });

  it("includes the student name, expected points, event details, and QR section", () => {
    const message = built();
    expect(message.html).toContain("Dear Aarav Sharma,");
    expect(message.text).toContain("Dear Aarav Sharma,");

    for (const point of [
      "Explore traditional and new-age career pathways",
      "Interact with universities, colleges and education institutions",
      "Attend career-focused Panel Discussions and expert sessions",
      "Get guidance to help you understand your interests and next steps",
    ]) {
      expect(message.html).toContain(point);
      expect(message.text).toContain(point);
    }

    expect(message.html).toContain("Panel Discussions");
    expect(message.html).toContain("19&ndash;20 December 2026");
    expect(message.html).toContain(STUDENT_REGISTRATION_VENUE);
    expect(message.html).toContain("Venue</div>");
    expect(message.text).toContain("19–20 December 2026");
    expect(message.text).toContain(STUDENT_REGISTRATION_VENUE);

    expect(message.html).toMatch(/YOUR REGISTRATION QR|Your Registration QR/i);
    expect(message.html).toContain(`cid:${STUDENT_REGISTRATION_QR_CID}`);
    expect(message.html).toContain(
      "Keep this QR code saved on your phone for a smooth check-in at Career Uttsav."
    );
    expect(message.html).toContain(
      "Save this email or take a screenshot of your QR code. You'll need it at the registration desk when you arrive."
    );
    expect(message.text).toContain(
      "Your registration QR is included in the HTML version of this email. Please save the email or QR image for event check-in."
    );
  });

  it("includes support contacts and website links", () => {
    const message = built();
    expect(message.html).toContain("info@careeruttsav.in");
    expect(message.html).toContain("+91 91130 64877");
    expect(message.html).toContain("www.careeruttsav.in");
    expect(message.html).toContain('href="https://www.careeruttsav.in"');
    expect(message.text).toContain("info@careeruttsav.in");
    expect(message.text).toContain("+91 91130 64877");
    expect(message.text).toContain("www.careeruttsav.in");
  });

  it("escapes student names and falls back when the name is absent", () => {
    const escaped = escapeStudentRegistrationHtml(`Aarav "<script>"`);
    expect(escaped).toBe("Aarav &quot;&lt;script&gt;&quot;");

    const named = buildStudentRegistrationEmailContent({
      studentName: `Aarav "<script>"`,
      includeLogo: false,
    });
    expect(named.html).toContain("Dear Aarav &quot;&lt;script&gt;&quot;,");
    expect(named.html).not.toContain("Dear undefined,");

    const empty = studentRegistrationGreeting("   ");
    expect(empty.html).toBe("Hello,");
    expect(empty.text).toBe("Hello,");

    const blankMessage = buildStudentRegistrationEmailContent({
      studentName: "",
      includeLogo: false,
    });
    expect(blankMessage.html).toContain("Hello,");
    expect(blankMessage.html).not.toContain("Dear undefined,");
  });

  it("does not include removed promotional or WhatsApp community copy", () => {
    const message = built();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(message.html).not.toContain(phrase);
      expect(message.text).not.toContain(phrase);
    }
  });

  it("keeps the local HTML preview aligned with the template", () => {
    const previewPath = path.join(
      process.cwd(),
      "emails/previews/student-registration-confirmation.html"
    );

    if (process.env.UPDATE_STUDENT_EMAIL_PREVIEW === "1") {
      const html = built({ studentName: "Aarav Sharma", includeLogo: true }).html
        .replaceAll("cid:career-uttsav-logo", "../../public/images/career-uttsav-logo.png")
        .replaceAll("cid:registration-qr", "../../public/images/career-uttsav-logo.png");
      writeFileSync(
        previewPath,
        `<!-- Dummy preview only. Aarav Sharma is not a production student. The sent email uses CID logo and QR attachments. -->\n${html}`
      );
    }

    const preview = readFileSync(previewPath, "utf8");
    expect(preview).toContain("Aarav Sharma");
    expect(preview).toContain("You're all set for Career Uttsav 2026");
    expect(preview).toContain(STUDENT_REGISTRATION_VENUE);
    expect(preview).toMatch(/your registration qr/i);
    expect(preview).not.toContain("WhatsApp Community");
  });
});

describe("sendStudentWelcomeEmail", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset();
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      id: "email-student-1",
      durationMs: 12,
      outcome: "accepted",
    });
  });

  it("still sends through sendEmail with QR CID attachment and plain text", async () => {
    await sendStudentWelcomeEmail({
      to: "aarav@example.com",
      name: "Aarav Sharma",
      registrationId: "CU2026-TEST-001",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const input = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(input?.subject).toBe(STUDENT_REGISTRATION_EMAIL_SUBJECT);
    expect(input?.text).toContain("Dear Aarav Sharma,");
    expect(input?.html).toContain(`cid:${STUDENT_REGISTRATION_QR_CID}`);

    const attachments = input?.attachments ?? [];
    const qrAttachment = attachments.find(
      (item) => item.contentId === STUDENT_REGISTRATION_QR_CID
    );
    expect(qrAttachment).toBeDefined();
    expect(qrAttachment?.filename).toBe("registration-qr.png");
    expect(qrAttachment?.content).toBe(
      await generateRegistrationQrPngBase64("CU2026-TEST-001")
    );

    const logoAttachment = attachments.find(
      (item) => item.contentId === PARTNER_EMAIL_LOGO_CID
    );
    expect(logoAttachment).toBeDefined();
  });
});
