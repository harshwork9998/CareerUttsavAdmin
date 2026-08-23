import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

const activeSuperuser: User = {
  id: "usr-super",
  name: "Super Admin",
  email: "super@careeruttsav.in",
  role: "superuser",
  roleId: ROLE_ID_BY_NAME.superuser,
  status: "Active",
  createdAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
};

const pendingUser: User = {
  id: "usr-pending",
  name: "Pending User",
  email: "pending@careeruttsav.in",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
  status: "Pending Approval",
  createdAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
};

const approvedUser: User = {
  ...pendingUser,
  status: "Active",
  role: "superuser",
  roleId: ROLE_ID_BY_NAME.superuser,
};

const rejectedUser: User = {
  ...pendingUser,
  status: "Rejected",
};

vi.mock("@/lib/server/admin-user-service", () => ({
  findAdminUserById: vi.fn(),
  reviewAdminUserAccount: vi.fn(),
}));

vi.mock("@/lib/server/admin-auth-email", () => ({
  sendAdminAccountApprovedEmail: vi.fn(),
  sendAdminAccountRejectedEmail: vi.fn(),
  buildAdminReviewSuccessMessage: vi.fn(
    (action: "approve" | "reject", notification: { sent: boolean }) => {
      if (action === "approve") {
        return notification.sent
          ? "Account approved and notification email sent."
          : "Account approved, but notification email could not be sent.";
      }
      return notification.sent
        ? "Account rejected and notification email sent."
        : "Account rejected, but notification email could not be sent.";
    }
  ),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { POST } from "@/app/api/users/[id]/review/route";
import {
  sendAdminAccountApprovedEmail,
  sendAdminAccountRejectedEmail,
} from "@/lib/server/admin-auth-email";
import {
  findAdminUserById,
  reviewAdminUserAccount,
} from "@/lib/server/admin-user-service";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

describe("admin review route notifications", () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
    vi.clearAllMocks();
    vi.mocked(findAdminUserById).mockImplementation(async (id) => {
      if (id === activeSuperuser.id) return activeSuperuser;
      if (id === pendingUser.id) return pendingUser;
      return null;
    });
    vi.mocked(reviewAdminUserAccount).mockImplementation(async (_id, action) =>
      action === "approve" ? approvedUser : rejectedUser
    );
    const token = createAdminSessionToken({ userId: "usr-super" });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSecret;
    }
  });

  it("calls approval email service after persisting approval", async () => {
    vi.mocked(sendAdminAccountApprovedEmail).mockResolvedValue({
      attempted: true,
      sent: true,
    });

    const response = await POST(
      new Request("http://localhost/api/users/usr-pending/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", role: "superuser" }),
      }),
      { params: Promise.resolve({ id: "usr-pending" }) }
    );

    expect(response.status).toBe(200);
    expect(reviewAdminUserAccount).toHaveBeenCalledOnce();
    expect(sendAdminAccountApprovedEmail).toHaveBeenCalledOnce();
    expect(sendAdminAccountApprovedEmail).toHaveBeenCalledWith(approvedUser);

    const body = (await response.json()) as {
      notification: { sent: boolean };
      message: string;
    };
    expect(body.notification).toEqual({ attempted: true, sent: true });
    expect(body.message).toBe("Account approved and notification email sent.");
  });

  it("keeps approval successful when email fails", async () => {
    vi.mocked(sendAdminAccountApprovedEmail).mockResolvedValue({
      attempted: true,
      sent: false,
    });

    const response = await POST(
      new Request("http://localhost/api/users/usr-pending/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", role: "user" }),
      }),
      { params: Promise.resolve({ id: "usr-pending" }) }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      notification: { sent: boolean };
      message: string;
      user: User;
    };
    expect(body.success).toBe(true);
    expect(body.user.status).toBe("Active");
    expect(body.notification.sent).toBe(false);
    expect(body.message).toBe(
      "Account approved, but notification email could not be sent."
    );
  });

  it("calls rejection email service and reports sent=false on failure", async () => {
    vi.mocked(sendAdminAccountRejectedEmail).mockResolvedValue({
      attempted: true,
      sent: false,
    });

    const response = await POST(
      new Request("http://localhost/api/users/usr-pending/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      }),
      { params: Promise.resolve({ id: "usr-pending" }) }
    );

    expect(response.status).toBe(200);
    expect(sendAdminAccountRejectedEmail).toHaveBeenCalledWith(rejectedUser);
    const body = (await response.json()) as {
      notification: { sent: boolean };
      message: string;
    };
    expect(body.notification.sent).toBe(false);
    expect(body.message).toBe(
      "Account rejected, but notification email could not be sent."
    );
  });
});
