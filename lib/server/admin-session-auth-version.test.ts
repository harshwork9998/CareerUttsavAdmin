import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

const activeUser: User = {
  id: "usr-active",
  name: "Active User",
  email: "active@careeruttsav.in",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
  status: "Active",
  createdAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
};

vi.mock("@/lib/server/admin-user-service", () => ({
  findAdminUserById: vi.fn(),
  getAdminUserAuthVersion: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { GET as meGet } from "@/app/api/auth/me/route";
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  ADMIN_SESSION_COOKIE,
} from "@/lib/server/admin-session";
import {
  findAdminUserById,
  getAdminUserAuthVersion,
} from "@/lib/server/admin-user-service";
import { cookies } from "next/headers";

describe("admin session authVersion", () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
    vi.clearAllMocks();
    vi.mocked(findAdminUserById).mockResolvedValue(activeUser);
    vi.mocked(getAdminUserAuthVersion).mockResolvedValue(0);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSecret;
    }
  });

  it("accepts legacy cookies without authVersion as version 0", () => {
    const token = createAdminSessionToken({ userId: activeUser.id });
    const session = verifyAdminSessionToken(token);
    expect(session?.authVersion).toBe(0);
  });

  it("embeds current authVersion in new sessions", () => {
    const token = createAdminSessionToken({
      userId: activeUser.id,
      authVersion: 2,
    });
    const session = verifyAdminSessionToken(token);
    expect(session?.authVersion).toBe(2);
  });

  it("rejects stale authVersion on /api/auth/me", async () => {
    const token = createAdminSessionToken({
      userId: activeUser.id,
      authVersion: 0,
    });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(getAdminUserAuthVersion).mockResolvedValue(1);

    const response = await meGet();
    expect(response.status).toBe(401);
  });

  it("allows matching authVersion on /api/auth/me", async () => {
    const token = createAdminSessionToken({
      userId: activeUser.id,
      authVersion: 1,
    });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(getAdminUserAuthVersion).mockResolvedValue(1);

    const response = await meGet();
    expect(response.status).toBe(200);
  });
});
