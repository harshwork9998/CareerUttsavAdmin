import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "@/lib/email";
import {
  ADMIN_APPROVED_EMAIL_SUBJECT,
  ADMIN_REJECTED_EMAIL_SUBJECT,
  buildAdminAccountApprovedEmailContent,
  buildAdminAccountRejectedEmailContent,
  buildAdminPasswordResetEmailContent,
  buildAdminReviewSuccessMessage,
  PASSWORD_RESET_EMAIL_TIMEOUT_MS,
  sendAdminAccountApprovedEmail,
  sendAdminAccountRejectedEmail,
  sendAdminPasswordResetEmail,
} from "@/lib/server/admin-auth-email";

const approvedUser: User = {
  id: "usr-001",
  name: "New Admin",
  email: "new.admin@careeruttsav.in",
  role: "superuser",
  roleId: ROLE_ID_BY_NAME.superuser,
  status: "Active",
  createdAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
};

const rejectedUser: User = {
  ...approvedUser,
  status: "Rejected",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
};

describe("admin auth email content", () => {
  it("includes assigned role in approval email", () => {
    const content = buildAdminAccountApprovedEmailContent({
      name: "New Admin",
      email: "new.admin@careeruttsav.in",
      role: "superuser",
      loginUrl: "https://admin.careeruttsav.in",
    });

    expect(content.subject).toBe(ADMIN_APPROVED_EMAIL_SUBJECT);
    expect(content.text).toContain("Access level: Superuser");
    expect(content.html).toContain("Superuser");
    expect(content.text).toContain("https://admin.careeruttsav.in");
  });

  it("never includes password or passwordHash in approval email", () => {
    const content = buildAdminAccountApprovedEmailContent({
      name: "New Admin",
      email: "new.admin@careeruttsav.in",
      role: "user",
      loginUrl: "https://admin.careeruttsav.in",
    });

    expect(content.text).not.toMatch(/passwordHash/i);
    expect(content.text).not.toContain("securepass");
    expect(content.html).not.toMatch(/passwordHash/i);
  });

  it("builds rejection email without internal metadata", () => {
    const content = buildAdminAccountRejectedEmailContent({
      name: "New Admin",
      email: "new.admin@careeruttsav.in",
    });

    expect(content.subject).toBe(ADMIN_REJECTED_EMAIL_SUBJECT);
    expect(content.text).toContain("has not been approved");
    expect(content.text).not.toContain("password");
  });
});

describe("admin auth email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends approval email to the registered address", async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      id: "email-001",
      durationMs: 10,
      outcome: "accepted",
    });

    const result = await sendAdminAccountApprovedEmail(approvedUser);

    expect(result).toEqual({ attempted: true, sent: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: approvedUser.email,
        subject: ADMIN_APPROVED_EMAIL_SUBJECT,
        html: expect.any(String),
        text: expect.any(String),
      })
    );
  });

  it("sends rejection email to the registered address", async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      id: "email-002",
      durationMs: 10,
      outcome: "accepted",
    });

    const result = await sendAdminAccountRejectedEmail(rejectedUser);

    expect(result).toEqual({ attempted: true, sent: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: rejectedUser.email,
        subject: ADMIN_REJECTED_EMAIL_SUBJECT,
      })
    );
  });

  it("returns sent=false when mail transport fails without throwing", async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      ok: false,
      error: "Provider unavailable",
      durationMs: 15,
      outcome: "definitive_failure",
    });

    const result = await sendAdminAccountApprovedEmail(approvedUser);
    expect(result).toEqual({ attempted: true, sent: false });
  });
});

describe("admin review success messages", () => {
  it("reflects actual mail result for approval", () => {
    expect(
      buildAdminReviewSuccessMessage("approve", { attempted: true, sent: true })
    ).toBe("Account approved and notification email sent.");
    expect(
      buildAdminReviewSuccessMessage("approve", { attempted: true, sent: false })
    ).toBe("Account approved, but notification email could not be sent.");
  });

  it("reflects actual mail result for rejection", () => {
    expect(
      buildAdminReviewSuccessMessage("reject", { attempted: true, sent: true })
    ).toBe("Account rejected and notification email sent.");
    expect(
      buildAdminReviewSuccessMessage("reject", { attempted: true, sent: false })
    ).toBe("Account rejected, but notification email could not be sent.");
  });
});

describe("admin password reset email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  it("mentions a 60-minute expiry in email copy", () => {
    const content = buildAdminPasswordResetEmailContent({
      name: "Admin User",
      email: "admin@careeruttsav.in",
      resetUrl: "https://admin.careeruttsav.in/reset-password?token=example",
    });
    expect(content.text).toContain("60 minutes");
    expect(content.html).toContain("60 minutes");
  });

  it("returns provider message id and duration on success", async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      id: "email-reset-001",
      durationMs: 88,
      outcome: "accepted",
    });

    const result = await sendAdminPasswordResetEmail({
      name: "Admin User",
      email: "admin@careeruttsav.in",
      resetUrl: "https://admin.careeruttsav.in/reset-password?token=example",
    });

    expect(result).toEqual({
      attempted: true,
      outcome: "accepted",
      sent: true,
      messageId: "email-reset-001",
      durationMs: 88,
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: PASSWORD_RESET_EMAIL_TIMEOUT_MS,
      })
    );
  });

  it("returns safe failure details when provider rejects", async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      ok: false,
      error: "Provider unavailable",
      durationMs: 42,
      outcome: "definitive_failure",
    });

    const result = await sendAdminPasswordResetEmail({
      name: "Admin User",
      email: "admin@careeruttsav.in",
      resetUrl: "https://admin.careeruttsav.in/reset-password?token=example",
    });

    expect(result).toEqual({
      attempted: true,
      outcome: "definitive_failure",
      sent: false,
      error: "Provider unavailable",
      durationMs: 42,
    });
  });

  it("returns unknown outcome for timeout without treating it as definitive failure", async () => {
    vi.mocked(sendEmail).mockResolvedValue({
      ok: false,
      error: "EMAIL_SEND_TIMEOUT",
      durationMs: 12_000,
      outcome: "unknown",
    });

    const result = await sendAdminPasswordResetEmail({
      name: "Admin User",
      email: "admin@careeruttsav.in",
      resetUrl: "https://admin.careeruttsav.in/reset-password?token=example",
    });

    expect(result).toEqual({
      attempted: true,
      outcome: "unknown",
      sent: false,
      error: "EMAIL_SEND_TIMEOUT",
      durationMs: 12_000,
    });
  });
});
