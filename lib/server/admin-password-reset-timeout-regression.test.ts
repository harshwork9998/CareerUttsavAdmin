import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashAdminPassword } from "@/lib/admin-password";
import { ROLE_ID_BY_NAME } from "@/constants";
import { EMAIL_SEND_TIMEOUT_ERROR } from "@/lib/email";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => sendMock(...args),
    },
  })),
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

function mockAbortAwareDelayedSend(successDelayMs: number) {
  sendMock.mockImplementation(
    (_payload: unknown, options?: { signal?: AbortSignal }) => {
      return new Promise((resolve) => {
        const successTimer = setTimeout(
          () => resolve({ data: { id: "late-email" }, error: null }),
          successDelayMs
        );
        options?.signal?.addEventListener("abort", () => {
          clearTimeout(successTimer);
          resolve({
            data: null,
            error: {
              message:
                "Unable to fetch data. The request could not be resolved.",
            },
          });
        });
      });
    }
  );
}

describe("password reset timeout regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "Career Uttsav <noreply@careeruttsav.in>";
    vi.mocked(findPrismaAdminUserRecordByEmail).mockResolvedValue(activeUser);
    vi.mocked(createPrismaPasswordResetToken).mockResolvedValue("tok-new");
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    vi.useRealTimers();
  });

  it("preserves new and previous tokens when the send times out", async () => {
    vi.useFakeTimers();
    mockAbortAwareDelayedSend(20_000);

    const requestPromise = requestAdminPasswordReset(activeUser.email);
    await vi.advanceTimersByTimeAsync(12_000);
    const result = await requestPromise;

    expect(result.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
    expect(revokePrismaPasswordResetTokenById).not.toHaveBeenCalled();
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(20_000);
    expect(revokePrismaPasswordResetTokenById).not.toHaveBeenCalled();
    expect(revokeOtherUnusedPrismaResetTokensForUser).not.toHaveBeenCalled();
  });

  it("logs safely without raw token or reset URL during timeout handling", async () => {
    vi.useFakeTimers();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockAbortAwareDelayedSend(20_000);

    const requestPromise = requestAdminPasswordReset(activeUser.email);
    await vi.advanceTimersByTimeAsync(12_000);
    await requestPromise;

    const logged = [...infoSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flatMap((call) => call.slice(1))
      .flatMap((payload) => JSON.stringify(payload));

    expect(logged.some((entry) => entry.includes(EMAIL_SEND_TIMEOUT_ERROR))).toBe(
      true
    );
    expect(logged.some((entry) => entry.includes("resend_outcome_unknown"))).toBe(
      true
    );
    expect(logged.some((entry) => /\/reset-password\?token=/.test(entry))).toBe(
      false
    );
    expect(logged.some((entry) => /[a-f0-9]{64}/.test(entry))).toBe(false);

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
