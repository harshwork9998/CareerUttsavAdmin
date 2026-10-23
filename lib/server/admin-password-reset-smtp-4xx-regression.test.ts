import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashAdminPassword } from "@/lib/admin-password";
import { ROLE_ID_BY_NAME } from "@/constants";

const sendMail = vi.fn();
const createTransport = vi.fn((_options: unknown) => ({
  sendMail,
  close: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (options: unknown) => createTransport(options),
  },
}));

vi.mock("@/lib/server/admin-user-persistence-mode", () => ({
  isPrismaAdminUserPersistence: vi.fn(() => true),
}));

vi.mock("@/lib/server/admin-forgot-password-throttle", () => ({
  shouldThrottleForgotPasswordRequest: vi.fn(() => false),
}));

vi.mock("@/lib/server/admin-user-prisma-store", () => ({
  findPrismaAdminUserRecordByEmail: vi.fn(),
  createPrismaPasswordResetToken: vi.fn(),
  revokePrismaPasswordResetTokenById: vi.fn(),
  revokeOtherUnusedPrismaResetTokensForUser: vi.fn(),
}));

import { sendEmail } from "@/lib/email";
import {
  FORGOT_PASSWORD_GENERIC_MESSAGE,
  requestAdminPasswordReset,
} from "@/lib/server/admin-password-reset-service";
import {
  createPrismaPasswordResetToken,
  findPrismaAdminUserRecordByEmail,
  revokeOtherUnusedPrismaResetTokensForUser,
  revokePrismaPasswordResetTokenById,
} from "@/lib/server/admin-user-prisma-store";

const activeUser = {
  id: "usr-active",
  name: "Active User",
  email: "active@careeruttsav.in",
  role: "user" as const,
  roleId: ROLE_ID_BY_NAME.user,
  status: "Active" as const,
  passwordHash: hashAdminPassword("old-password"),
  authVersion: 0,
  phone: null,
  avatar: null,
  department: null,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_REQUIRE_TLS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "SMTP_EHLO_NAME",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

function smtpRejection(responseCode: number, message: string) {
  return Object.assign(new Error(message), {
    code: responseCode >= 500 ? "EENVELOPE" : "EMESSAGE",
    response: message,
    responseCode,
    command: "DATA",
  });
}

describe("password reset SMTP temporary rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp-relay.gmail.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_REQUIRE_TLS = "true";
    process.env.SMTP_FROM_EMAIL = "registrations@careeruttsav.in";
    process.env.SMTP_FROM_NAME = "Career Uttsav";
    process.env.SMTP_EHLO_NAME =
      "ec2-65-2-156-37.ap-south-1.compute.amazonaws.com";
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(createPrismaPasswordResetToken).mockResolvedValue("tok-new");
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("keeps the password-reset token when Google returns 451 4.3.0", async () => {
    const rejection = smtpRejection(
      451,
      "451 4.3.0 Mail server temporarily rejected message."
    );
    sendMail.mockRejectedValue(rejection);

    const emailResult = await sendEmail({
      to: activeUser.email,
      subject: "Reset your Career Uttsav admin password",
      html: "<p>Reset</p>",
      timeoutMs: 12_000,
    });

    expect(emailResult).toMatchObject({
      ok: false,
      error: "451 4.3.0 Mail server temporarily rejected message.",
      outcome: "unknown",
    });

    const result = await requestAdminPasswordReset(activeUser.email);

    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(createPrismaPasswordResetToken).toHaveBeenCalledOnce();
    expect(revokePrismaPasswordResetTokenById).not.toHaveBeenCalled();
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();
  });

  it("revokes the new password-reset token when SMTP returns 550", async () => {
    sendMail.mockRejectedValue(
      smtpRejection(550, "550 5.1.1 mailbox unavailable")
    );

    const emailResult = await sendEmail({
      to: activeUser.email,
      subject: "Reset your Career Uttsav admin password",
      html: "<p>Reset</p>",
      timeoutMs: 12_000,
    });

    expect(emailResult).toMatchObject({
      ok: false,
      outcome: "definitive_failure",
    });

    const result = await requestAdminPasswordReset(activeUser.email);

    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(revokePrismaPasswordResetTokenById).toHaveBeenCalledWith("tok-new");
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();
  });
});
