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
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
};

const activeUser: User = {
  ...activeSuperuser,
  id: "usr-normal",
  email: "user@careeruttsav.in",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
};

vi.mock("@/lib/server/admin-user-service", () => ({
  authenticateAdminUser: vi.fn(),
  listAdminUsers: vi.fn(),
  findAdminUserById: vi.fn(),
  updateAdminUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { GET as usersGet } from "@/app/api/users/route";
import { PATCH as userPatch } from "@/app/api/users/[id]/route";
import {
  authenticateAdminUser,
  findAdminUserById,
  listAdminUsers,
  updateAdminUser,
} from "@/lib/server/admin-user-service";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

describe("admin auth routes", () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
    vi.clearAllMocks();
    vi.mocked(listAdminUsers).mockResolvedValue([activeSuperuser]);
    vi.mocked(findAdminUserById).mockImplementation(async (id) => {
      if (id === activeSuperuser.id) return activeSuperuser;
      if (id === activeUser.id) return activeUser;
      return null;
    });
    vi.mocked(updateAdminUser).mockResolvedValue({
      ...activeSuperuser,
      name: "Updated Name",
    });
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSecret;
    }
  });

  it("login succeeds for Active user and sets session cookie", async () => {
    vi.mocked(authenticateAdminUser).mockResolvedValue({
      ok: true,
      user: activeSuperuser,
    });

    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "super@careeruttsav.in",
          password: "secret",
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; user: User };
    expect(body.success).toBe(true);
    expect("passwordHash" in body.user).toBe(false);
    expect(response.headers.get("set-cookie")).toContain(ADMIN_SESSION_COOKIE);
  });

  it.each([
    ["Pending Approval", { ok: false, reason: "blocked", status: "Pending Approval", user: { ...activeSuperuser, status: "Pending Approval" } }],
    ["Inactive", { ok: false, reason: "blocked", status: "Inactive", user: { ...activeSuperuser, status: "Inactive" } }],
    ["Suspended", { ok: false, reason: "blocked", status: "Suspended", user: { ...activeSuperuser, status: "Suspended" } }],
    ["Rejected", { ok: false, reason: "blocked", status: "Rejected", user: { ...activeSuperuser, status: "Rejected" } }],
  ] as const)("login blocks %s users", async (_label, authResult) => {
    vi.mocked(authenticateAdminUser).mockResolvedValue(authResult);
    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "super@careeruttsav.in", password: "secret" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("returns current user from /api/auth/me for valid session", async () => {
    const token = createAdminSessionToken({ userId: activeSuperuser.id });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);

    const response = await meGet();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: User };
    expect(body.user.id).toBe(activeSuperuser.id);
    expect("passwordHash" in body.user).toBe(false);
  });

  it("rejects disabled user session on /api/auth/me", async () => {
    const token = createAdminSessionToken({ userId: "usr-suspended" });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(findAdminUserById).mockResolvedValue({
      ...activeSuperuser,
      id: "usr-suspended",
      status: "Suspended",
    });

    const response = await meGet();
    expect(response.status).toBe(401);
  });

  it("logout clears session cookie", async () => {
    const response = await logoutPost();
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("rejects unauthenticated GET /api/users", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as Awaited<ReturnType<typeof cookies>>);

    const response = await usersGet();
    expect(response.status).toBe(401);
    expect(listAdminUsers).not.toHaveBeenCalled();
  });

  it("rejects normal user on GET /api/users", async () => {
    const token = createAdminSessionToken({ userId: activeUser.id });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);

    const response = await usersGet();
    expect(response.status).toBe(403);
    expect(listAdminUsers).not.toHaveBeenCalled();
  });

  it("allows superuser on GET /api/users", async () => {
    const token = createAdminSessionToken({ userId: activeSuperuser.id });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);

    const response = await usersGet();
    expect(response.status).toBe(200);
    expect(listAdminUsers).toHaveBeenCalledOnce();
  });

  it("PATCH delegates protected fields to service allowlist", async () => {
    const token = createAdminSessionToken({ userId: activeSuperuser.id });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);

    const response = await userPatch(
      new Request(`http://localhost/api/users/${activeSuperuser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          id: "usr-hijack",
          role: "user",
          roleId: "role-superuser",
        }),
      }),
      { params: Promise.resolve({ id: activeSuperuser.id }) }
    );

    expect(response.status).toBe(200);
    expect(updateAdminUser).toHaveBeenCalledWith(
      activeSuperuser.id,
      expect.objectContaining({ name: "Updated Name", role: "user" })
    );
  });
});
