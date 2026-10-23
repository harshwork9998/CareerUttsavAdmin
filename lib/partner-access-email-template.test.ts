import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail } from "@/lib/email";
import {
  partnerPortalBaseUrl,
  sendPartnerAccessEmail,
} from "@/lib/server/partner-access-email";
import {
  buildPartnerAccessEmailContent,
  escapePartnerAccessHtml,
} from "@/lib/server/partner-access-email-template";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

const PORTAL = "https://partners.careeruttsav.in";
const LOGIN = "partner@example.edu";
const PASSWORD = "Dummy-Pass-2026";

function message(overrides: Partial<Parameters<typeof buildPartnerAccessEmailContent>[0]> = {}) {
  return buildPartnerAccessEmailContent({
    institutionName: "Example University",
    portalUrl: PORTAL,
    portalLogin: LOGIN,
    temporaryPassword: PASSWORD,
    ...overrides,
  });
}

describe("partner access email template", () => {
  it("includes the institution name in the subject and body", () => {
    const built = message();
    expect(built.subject).toBe(
      "You're Onboard! Let's Get Example University Event-Ready"
    );
    expect(built.html).toContain("Example University");
    expect(built.text).toContain("Dear Example University Team,");
    expect(built.html).toContain("Dear Example University Team,");
  });

  it("shows the portal URL, login ID, temporary password, and portal CTA", () => {
    const built = message();
    expect(built.html).toContain(PORTAL);
    expect(built.text).toContain(`Partner Portal: ${PORTAL}`);
    expect(built.html).toContain(LOGIN);
    expect(built.text).toContain(`Login ID: ${LOGIN}`);
    expect(built.html).toContain(PASSWORD);
    expect(built.text).toContain(`Temporary Password: ${PASSWORD}`);
    expect(built.html).toContain(`href="${PORTAL}"`);
    expect(built.html).toContain("ACCESS PARTNER PORTAL");
    expect(built.html).not.toContain(`${PORTAL}?`);
    expect(built.html).not.toContain(`password=${PASSWORD}`);
  });

  it("uses Panel Discussion wording and does not say Seminar", () => {
    const built = message();
    expect(built.html).toMatch(/panel discussion/i);
    expect(built.text).toMatch(/panel discussion/i);
    expect(built.html).not.toMatch(/seminar/i);
    expect(built.text).not.toMatch(/seminar/i);
  });

  it("renders a supplied due date and falls back when it is absent", () => {
    const withDate = message({ dueDate: "2026-12-01" });
    expect(withDate.html).toContain("1 December 2026");
    expect(withDate.text).toContain("by 1 December 2026");
    expect(withDate.html).not.toContain("{Due Date}");

    const withoutDate = message();
    expect(withoutDate.html).toContain(
      "Kindly complete the required information at the earliest."
    );
    expect(withoutDate.text).toContain(
      "Kindly complete the required information at the earliest."
    );
    expect(withoutDate.html).not.toContain("{Due Date}");
    expect(withoutDate.text).not.toMatch(/\bby\s*\./);
  });

  it("omits a support phone when none is supplied", () => {
    const built = message();
    expect(built.html).toContain("info@careeruttsav.in");
    expect(built.text).toContain("info@careeruttsav.in");
    expect(built.html).not.toContain("+91");
    expect(built.text.split("Support:")[1]?.trim()).toBe("info@careeruttsav.in");

    const withPhone = message({ supportPhone: "+91 90000 00000" });
    expect(withPhone.html).toContain("+91 90000 00000");
    expect(withPhone.text).toContain("+91 90000 00000");
  });

  it("escapes institution names and dynamic values", () => {
    const hostile = `Good & <script>alert("x")</script> University`;
    const built = message({
      institutionName: hostile,
      portalLogin: `a<b>@example.edu`,
      temporaryPassword: `p&ss<word>`,
      portalUrl: `https://partners.careeruttsav.in/?q="x"`,
      dueDate: `1 <July>`,
      supportPhone: `+91 <000>`,
    });
    expect(built.html).toContain(escapePartnerAccessHtml(hostile));
    expect(built.html).not.toContain("<script>");
    expect(built.html).toContain("a&lt;b&gt;@example.edu");
    expect(built.html).toContain("p&amp;ss&lt;word&gt;");
    expect(built.html).toContain("q=&quot;x&quot;");
    expect(built.html).toContain("1 &lt;July&gt;");
    expect(built.html).toContain("+91 &lt;000&gt;");
    expect(built.subject).toContain("Good &");
    expect(built.text).toContain(hostile);
  });

  it("does not persist the password or read a stored hash", () => {
    const template = readFileSync(
      path.join(process.cwd(), "lib/server/partner-access-email-template.ts"),
      "utf8"
    );
    const sender = readFileSync(
      path.join(process.cwd(), "lib/server/partner-access-email.ts"),
      "utf8"
    );
    expect(template).not.toContain("portalPasswordHash");
    expect(template).not.toContain("prisma");
    expect(sender).toContain("sendEmail");
    expect(sender).toContain("buildPartnerAccessEmailContent");
    expect(sender).toContain('from "@/lib/server/partner-access-email-template"');
    expect(sender).not.toContain("api.resend.com");
    expect(sender).not.toContain("portalPasswordHash");
    expect(sender).not.toContain(
      "Your Career Uttsav Partner Portal access has been created."
    );
  });

  it("asks the recipient to change the password after first login", () => {
    const built = message();
    expect(built.html).toContain(
      "Please change your password after your first login"
    );
    expect(built.text).toContain(
      "Please change your password after your first login"
    );
  });
});

describe("partner access email transport", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset();
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      id: "msg-access",
      durationMs: 1,
      outcome: "accepted",
    });
  });

  it("still sends through sendEmail without a custom from address", async () => {
    await sendPartnerAccessEmail({
      to: "office@example.edu",
      partnerName: "Example University",
      login: LOGIN,
      temporaryPassword: PASSWORD,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const input = vi.mocked(sendEmail).mock.calls[0]?.[0];
    const portalUrl = partnerPortalBaseUrl();
    const attending =
      "Add attending team members to help us plan and coordinate the onboarding process more effectively for the event.";
    expect(input?.to).toBe("office@example.edu");
    expect(input?.from).toBeUndefined();
    expect(input?.subject).toBe(
      "You're Onboard! Let's Get Example University Event-Ready"
    );
    expect(input?.html).toContain("Example University");
    expect(input?.text).toContain("Dear Example University Team,");
    expect(input?.html).toContain(PASSWORD);
    expect(input?.text).toContain(`Temporary Password: ${PASSWORD}`);
    expect(input?.html).toContain(portalUrl);
    expect(input?.text).toContain(`Partner Portal: ${portalUrl}`);
    expect(input?.html).toContain(LOGIN);
    expect(input?.html).toContain("1 December 2026");
    expect(input?.text).toContain("by 1 December 2026");
    expect(input?.html).toContain(attending);
    expect(input?.text).toContain(attending);
    expect(input?.html).toContain("info@careeruttsav.in");
    expect(input?.text).toContain("info@careeruttsav.in");
    expect(input?.html).not.toContain(
      "Your Career Uttsav Partner Portal access has been created."
    );
    expect(input?.text).not.toContain(
      "Your Career Uttsav Partner Portal access has been created."
    );
    expect(input?.attachments?.[0]).toEqual(
      expect.objectContaining({
        filename: "career-uttsav-logo.png",
        contentId: "career-uttsav-logo",
      })
    );
    expect(input?.attachments?.[0]?.content.length).toBeGreaterThan(20);
    expect(JSON.stringify(input?.attachments ?? [])).not.toContain(PASSWORD);
    expect(input?.html).toContain("cid:career-uttsav-logo");
  });
});
