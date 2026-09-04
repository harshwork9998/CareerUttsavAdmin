import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashAdminPassword, verifyAdminPassword } from "@/lib/admin-password";
import { ROLE_ID_BY_NAME } from "@/constants";

vi.mock("@/lib/server/admin-user-persistence-mode", () => ({
  isPrismaAdminUserPersistence: vi.fn(() => true),
}));

vi.mock("@/lib/server/admin-forgot-password-throttle", () => ({
  shouldThrottleForgotPasswordRequest: vi.fn(() => false),
}));

vi.mock("@/lib/server/admin-auth-email", () => ({
  sendAdminPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/server/admin-user-prisma-store", () => ({
  findPrismaAdminUserRecordByEmail: vi.fn(),
  createPrismaPasswordResetToken: vi.fn(),
  revokePrismaPasswordResetTokenById: vi.fn(),
  revokeOtherUnusedPrismaResetTokensForUser: vi.fn(),
  resetAdminPasswordWithPrismaToken: vi.fn(),
}));

import { sendAdminPasswordResetEmail } from "@/lib/server/admin-auth-email";
import { isPrismaAdminUserPersistence } from "@/lib/server/admin-user-persistence-mode";
import { shouldThrottleForgotPasswordRequest } from "@/lib/server/admin-forgot-password-throttle";
import {
  FORGOT_PASSWORD_GENERIC_MESSAGE,
  requestAdminPasswordReset,
  resetAdminPasswordWithToken,
} from "@/lib/server/admin-password-reset-service";
import {
  buildPasswordResetUrl,
  generateRawResetToken,
  hashResetToken,
  INVALID_RESET_LINK_MESSAGE,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/server/admin-reset-token";
import {
  createPrismaPasswordResetToken,
  findPrismaAdminUserRecordByEmail,
  resetAdminPasswordWithPrismaToken,
  revokeOtherUnusedPrismaResetTokensForUser,
  revokePrismaPasswordResetTokenById,
} from "@/lib/server/admin-user-prisma-store";
import { AdminUserError } from "@/lib/server/admin-user-errors";

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

function successfulEmailResult() {
  return {
    attempted: true,
    outcome: "accepted" as const,
    sent: true,
    messageId: "email-001",
    durationMs: 120,
  };
}

describe("reset token helpers", () => {
  it("uses a 60-minute TTL", () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("hashes raw token with SHA-256", () => {
    const raw = generateRawResetToken();
    expect(hashResetToken(raw)).toHaveLength(64);
    expect(hashResetToken(raw)).not.toBe(raw);
  });

  it("builds reset URL from ADMIN_LOGIN_URL", () => {
    const original = process.env.ADMIN_LOGIN_URL;
    process.env.ADMIN_LOGIN_URL = "https://admin.example.test";
    const raw = generateRawResetToken();
    expect(buildPasswordResetUrl(raw)).toBe(
      `https://admin.example.test/reset-password?token=${encodeURIComponent(raw)}`
    );
    if (original === undefined) {
      delete process.env.ADMIN_LOGIN_URL;
    } else {
      process.env.ADMIN_LOGIN_URL = original;
    }
  });
});

describe("requestAdminPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    vi.mocked(isPrismaAdminUserPersistence).mockReturnValue(true);
    vi.mocked(shouldThrottleForgotPasswordRequest).mockReturnValue(false);
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue(successfulEmailResult());
    vi.mocked(createPrismaPasswordResetToken).mockResolvedValue("tok-new");
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("returns the same generic message for unknown email", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(null);
    const result = await requestAdminPasswordReset("missing@careeruttsav.in");
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(sendAdminPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("returns the same generic message for inactive users", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue({
      ...activeUser,
      status: "PendingApproval",
    });
    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(createPrismaPasswordResetToken).not.toHaveBeenCalled();
  });

  it("returns the same generic message when throttled", async () => {
    vi.mocked(shouldThrottleForgotPasswordRequest).mockReturnValue(true);
    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(createPrismaPasswordResetToken).not.toHaveBeenCalled();
  });

  it("creates token and sends email for active users", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(createPrismaPasswordResetToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: activeUser.id,
        tokenHash: expect.any(String),
      })
    );
    expect(sendAdminPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: activeUser.email,
        resetUrl: expect.stringContaining("/reset-password?token="),
      })
    );
    expect(revokeOtherUnusedPrismaResetTokensForUser).toHaveBeenCalledWith(
      activeUser.id,
      "tok-new"
    );
  });

  it("returns generic response when provider send fails", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue({
      attempted: true,
      outcome: "definitive_failure",
      sent: false,
      error: "Provider unavailable",
      durationMs: 250,
    });

    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(revokePrismaPasswordResetTokenById).toHaveBeenCalledWith("tok-new");
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();
  });

  it("returns generic response when provider throws via email layer", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue({
      attempted: true,
      outcome: "definitive_failure",
      sent: false,
      error: "RESEND_API_KEY is not set in the environment",
      durationMs: 5,
    });

    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(revokePrismaPasswordResetTokenById).toHaveBeenCalledWith("tok-new");
  });

  it("returns generic response when provider times out", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue({
      attempted: true,
      outcome: "unknown",
      sent: false,
      error: "EMAIL_SEND_TIMEOUT",
      durationMs: 12_000,
    });

    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(revokePrismaPasswordResetTokenById).not.toHaveBeenCalled();
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();
  });

  it("preserves all tokens when send outcome is unknown", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue({
      attempted: true,
      outcome: "unknown",
      sent: false,
      error: "Unable to fetch data. The request could not be resolved.",
      durationMs: 500,
    });

    await requestAdminPasswordReset(activeUser.email);

    expect(revokePrismaPasswordResetTokenById).not.toHaveBeenCalled();
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();
  });

  it("preserves previous valid token when new email send fails definitively", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue({
      attempted: true,
      outcome: "definitive_failure",
      sent: false,
      error: "Provider unavailable",
      durationMs: 100,
    });

    await requestAdminPasswordReset(activeUser.email);

    expect(revokePrismaPasswordResetTokenById).toHaveBeenCalledWith("tok-new");
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();
  });

  it("invalidates previous tokens only after successful send", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    await requestAdminPasswordReset(activeUser.email);

    expect(revokeOtherUnusedPrismaResetTokensForUser).toHaveBeenCalledWith(
      activeUser.id,
      "tok-new"
    );
    expect(revokePrismaPasswordResetTokenById).not.toHaveBeenCalled();
  });

  it("exposes provider message ID in internal email result", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    await requestAdminPasswordReset(activeUser.email);

    expect(sendAdminPasswordResetEmail).toHaveBeenCalled();
    const emailResult = await vi.mocked(sendAdminPasswordResetEmail).mock.results[0]
      ?.value;
    expect(emailResult).toMatchObject({
      outcome: "accepted",
      sent: true,
      messageId: "email-001",
    });
  });

  it("logs safely without raw token or reset URL", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await requestAdminPasswordReset(activeUser.email);

    const logged = JSON.stringify([
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ]);
    expect(logged).not.toMatch(/\/reset-password\?token=/);
    expect(logged).not.toContain("re_test_key");

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("logs persistence-mode no-op while keeping generic response", async () => {
    vi.mocked(isPrismaAdminUserPersistence).mockReturnValue(false);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(
      errorSpy.mock.calls.some(
        (call) =>
          call[0] === "[admin-password-reset]" &&
          (call[1] as { event?: string })?.event === "persistence_mode_noop"
      )
    ).toBe(true);

    errorSpy.mockRestore();
  });
});

describe("resetAdminPasswordWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPrismaAdminUserPersistence).mockReturnValue(true);
  });

  it("resets password using hashed token lookup", async () => {
    const raw = generateRawResetToken();
    vi.mocked(resetAdminPasswordWithPrismaToken).mockResolvedValue(undefined);

    const result = await resetAdminPasswordWithToken(raw, "new-password-123");
    expect(result.message).toContain("reset successfully");
    expect(resetAdminPasswordWithPrismaToken).toHaveBeenCalledWith({
      tokenHash: hashResetToken(raw),
      passwordHash: expect.stringMatching(/^scrypt\$/),
    });
    const args = vi.mocked(resetAdminPasswordWithPrismaToken).mock.calls[0]![0];
    expect(verifyAdminPassword("new-password-123", args.passwordHash)).toBe(true);
    expect(args.passwordHash).not.toBe("new-password-123");
  });

  it("rejects invalid token with generic message", async () => {
    vi.mocked(resetAdminPasswordWithPrismaToken).mockRejectedValue(
      new AdminUserError(400, INVALID_RESET_LINK_MESSAGE)
    );

    await expect(
      resetAdminPasswordWithToken("bad-token", "new-password-123")
    ).rejects.toMatchObject({ message: INVALID_RESET_LINK_MESSAGE });
  });
});

describe("createPrismaPasswordResetToken policy", () => {
  it("is invoked with hashed token only", async () => {
    vi.mocked(createPrismaPasswordResetToken).mockResolvedValue("tok-1");
    const raw = generateRawResetToken();
    await createPrismaPasswordResetToken({
      userId: activeUser.id,
      tokenHash: hashResetToken(raw),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });
    const args = vi.mocked(createPrismaPasswordResetToken).mock.calls[0]![0];
    expect(args.tokenHash).not.toBe(raw);
  });
});
