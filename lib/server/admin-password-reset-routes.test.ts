import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

vi.mock("@/lib/server/admin-password-reset-service", () => ({
  requestAdminPasswordReset: vi.fn(),
  resetAdminPasswordWithToken: vi.fn(),
  FORGOT_PASSWORD_GENERIC_MESSAGE:
    "If an account exists for this email, a password reset link has been sent.",
}));

import { POST as forgotPasswordPost } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordPost } from "@/app/api/auth/reset-password/route";
import {
  FORGOT_PASSWORD_GENERIC_MESSAGE,
  requestAdminPasswordReset,
  resetAdminPasswordWithToken,
} from "@/lib/server/admin-password-reset-service";
import { AdminUserError } from "@/lib/server/admin-user-errors";
import { INVALID_RESET_LINK_MESSAGE } from "@/lib/server/admin-reset-token";

describe("forgot-password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestAdminPasswordReset).mockResolvedValue({
      message: FORGOT_PASSWORD_GENERIC_MESSAGE,
    });
  });

  it("returns generic success message", async () => {
    const response = await forgotPasswordPost(
      new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@careeruttsav.in" }),
      })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; message: string };
    expect(body.message).toBe(FORGOT_PASSWORD_GENERIC_MESSAGE);
  });
});

describe("reset-password route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resetAdminPasswordWithToken).mockResolvedValue({
      message: "Your password has been reset successfully. You can now sign in.",
    });
  });

  it("returns success for valid reset", async () => {
    const response = await resetPasswordPost(
      new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "a".repeat(64),
          password: "new-password",
        }),
      })
    );
    expect(response.status).toBe(200);
  });

  it("returns invalid link message for bad token", async () => {
    vi.mocked(resetAdminPasswordWithToken).mockRejectedValue(
      new AdminUserError(400, INVALID_RESET_LINK_MESSAGE)
    );
    const response = await resetPasswordPost(
      new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "bad",
          password: "new-password",
        }),
      })
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe(INVALID_RESET_LINK_MESSAGE);
  });
});
