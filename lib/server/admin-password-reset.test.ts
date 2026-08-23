import { beforeEach, describe, expect, it, vi } from "vitest";

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
  revokeUnusedPrismaResetTokensForUser: vi.fn(),
  resetAdminPasswordWithPrismaToken: vi.fn(),
}));

import { sendAdminPasswordResetEmail } from "@/lib/server/admin-auth-email";
import { shouldThrottleForgotPasswordRequest } from "@/lib/server/admin-forgot-password-throttle";
import {
  FORGOT_PASSWORD_GENERIC_MESSAGE,
  requestAdminPasswordReset,
  resetAdminPasswordWithToken,
} from "@/lib/server/admin-password-reset-service";
import {
  generateRawResetToken,
  hashResetToken,
  INVALID_RESET_LINK_MESSAGE,
} from "@/lib/server/admin-reset-token";
import {
  createPrismaPasswordResetToken,
  findPrismaAdminUserRecordByEmail,
  resetAdminPasswordWithPrismaToken,
  revokeUnusedPrismaResetTokensForUser,
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

describe("reset token helpers", () => {
  it("hashes raw token with SHA-256", () => {
    const raw = generateRawResetToken();
    expect(hashResetToken(raw)).toHaveLength(64);
    expect(hashResetToken(raw)).not.toBe(raw);
  });
});

describe("requestAdminPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue({
      attempted: true,
      sent: true,
    });
    vi.mocked(createPrismaPasswordResetToken).mockResolvedValue("tok-1");
  });

  it("returns the same generic message for unknown email", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(null);
    const result = await requestAdminPasswordReset("missing@careeruttsav.in");
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(sendAdminPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("does not email pending approval accounts", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue({
      ...activeUser,
      status: "PendingApproval",
    });
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
  });

  it("revokes token when email send fails", async () => {
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(sendAdminPasswordResetEmail).mockResolvedValue({
      attempted: true,
      sent: false,
    });
    await requestAdminPasswordReset(activeUser.email);
    expect(revokeUnusedPrismaResetTokensForUser).toHaveBeenCalledWith(
      activeUser.id
    );
  });

  it("returns generic response when throttled", async () => {
    vi.mocked(shouldThrottleForgotPasswordRequest).mockReturnValue(true);
    const result = await requestAdminPasswordReset(activeUser.email);
    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(createPrismaPasswordResetToken).not.toHaveBeenCalled();
  });
});

describe("resetAdminPasswordWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expiresAt: new Date(Date.now() + 60_000),
    });
    const args = vi.mocked(createPrismaPasswordResetToken).mock.calls[0]![0];
    expect(args.tokenHash).not.toBe(raw);
  });
});
