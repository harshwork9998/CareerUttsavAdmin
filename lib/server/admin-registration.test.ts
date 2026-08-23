import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

const validBody = {
  fullName: "New Admin",
  email: "new.admin@careeruttsav.in",
  mobile: "9876543210",
  password: "securepass",
};

const pendingUser: User = {
  id: "usr-new",
  name: "New Admin",
  email: "new.admin@careeruttsav.in",
  phone: "9876543210",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
  status: "Pending Approval",
  department: "Pending Review",
  createdAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
};

vi.mock("@/lib/server/admin-user-service", () => ({
  createRegisteredAdminUser: vi.fn(),
  isAdminEmailRegistered: vi.fn(),
  authenticateAdminUser: vi.fn(),
}));

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import {
  authenticateAdminUser,
  createRegisteredAdminUser,
  isAdminEmailRegistered,
} from "@/lib/server/admin-user-service";

describe("admin self-registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAdminEmailRegistered).mockResolvedValue(false);
    vi.mocked(createRegisteredAdminUser).mockResolvedValue(pendingUser);
  });

  it("registers with client payload (no confirmPassword)", async () => {
    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(body.message).toContain("Awaiting administrator approval");
    expect(createRegisteredAdminUser).toHaveBeenCalledWith({
      fullName: validBody.fullName,
      email: validBody.email,
      mobile: validBody.mobile,
      password: validBody.password,
    });
  });

  it("rejects invalid email with user-facing message", async () => {
    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, email: "bad-email" }),
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Please enter a valid email address");
    expect(createRegisteredAdminUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate email with conflict response", async () => {
    vi.mocked(isAdminEmailRegistered).mockResolvedValue(true);

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      })
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("already exists");
    expect(createRegisteredAdminUser).not.toHaveBeenCalled();
  });

  it("rejects superuser escalation from public payload", async () => {
    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validBody,
          role: "superuser",
          roleId: ROLE_ID_BY_NAME.superuser,
          status: "Active",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(createRegisteredAdminUser).toHaveBeenCalledWith({
      fullName: validBody.fullName,
      email: validBody.email,
      mobile: validBody.mobile,
      password: validBody.password,
    });
  });

  it("blocks Pending Approval user login", async () => {
    vi.mocked(authenticateAdminUser).mockResolvedValue({
      ok: false,
      reason: "blocked",
      status: "Pending Approval",
      user: pendingUser,
    });

    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingUser.email,
          password: "securepass",
        }),
      })
    );

    expect(response.status).toBe(403);
  });
});
