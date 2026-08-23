import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

const actorSuperuser: User = {
  id: "usr-super",
  name: "Super Admin",
  email: "super@careeruttsav.in",
  role: "superuser",
  roleId: ROLE_ID_BY_NAME.superuser,
  status: "Active",
  createdAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "usr-target",
    name: "Target User",
    email: "target@careeruttsav.in",
    role: "user",
    roleId: ROLE_ID_BY_NAME.user,
    status: "Active",
    createdAt: "2026-08-23T10:00:00.000Z",
    updatedAt: "2026-08-23T10:00:00.000Z",
    ...overrides,
  };
}

vi.mock("@/lib/server/admin-user-service", () => ({
  findAdminUserById: vi.fn(),
  updateAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { GET as meGet } from "@/app/api/auth/me/route";
import { DELETE, PATCH } from "@/app/api/users/[id]/route";
import {
  deleteAdminUser,
  findAdminUserById,
  updateAdminUser,
} from "@/lib/server/admin-user-service";
import { AdminUserError } from "@/lib/server/admin-user-errors";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

describe("DELETE /api/users/[id] route", () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
    vi.clearAllMocks();
    vi.mocked(findAdminUserById).mockImplementation(async (id) => {
      if (id === actorSuperuser.id) return actorSuperuser;
      if (id === makeUser().id) return makeUser();
      return null;
    });
    vi.mocked(deleteAdminUser).mockResolvedValue(undefined);
    const token = createAdminSessionToken({ userId: actorSuperuser.id });
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

  it("allows superuser to delete another user", async () => {
    const response = await DELETE(new Request("http://localhost/api/users/usr-target"), {
      params: Promise.resolve({ id: "usr-target" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean; message: string };
    expect(body.message).toBe("User deleted successfully.");
    expect(deleteAdminUser).toHaveBeenCalledWith("usr-target", {
      actorUserId: actorSuperuser.id,
    });
  });

  it("returns conflict when deleting own account", async () => {
    vi.mocked(deleteAdminUser).mockRejectedValue(
      new AdminUserError(409, "You cannot delete your own account.")
    );

    const response = await DELETE(
      new Request(`http://localhost/api/users/${actorSuperuser.id}`),
      { params: Promise.resolve({ id: actorSuperuser.id }) }
    );

    expect(response.status).toBe(409);
  });

  it("rejects unauthenticated delete requests", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as Awaited<ReturnType<typeof cookies>>);

    const response = await DELETE(new Request("http://localhost/api/users/usr-target"), {
      params: Promise.resolve({ id: "usr-target" }),
    });

    expect(response.status).toBe(401);
    expect(deleteAdminUser).not.toHaveBeenCalled();
  });

  it("rejects normal user delete attempts", async () => {
    const normalUser = makeUser({ id: "usr-normal", role: "user" });
    const token = createAdminSessionToken({ userId: normalUser.id });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(findAdminUserById).mockResolvedValue(normalUser);

    const response = await DELETE(new Request("http://localhost/api/users/usr-target"), {
      params: Promise.resolve({ id: "usr-target" }),
    });

    expect(response.status).toBe(403);
    expect(deleteAdminUser).not.toHaveBeenCalled();
  });
});

describe("deleted user session security", () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalSecret;
    }
  });

  it("invalidates /api/auth/me after account deletion", async () => {
    const deletedUser = makeUser({ id: "usr-deleted" });
    const token = createAdminSessionToken({ userId: deletedUser.id });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(findAdminUserById).mockResolvedValue(null);

    const response = await meGet();
    expect(response.status).toBe(401);
  });
});

describe("activate/deactivate still works", () => {
  const originalSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
    vi.clearAllMocks();
    vi.mocked(findAdminUserById).mockImplementation(async (id) => {
      if (id === actorSuperuser.id) return actorSuperuser;
      if (id === makeUser().id) return makeUser();
      return null;
    });
    vi.mocked(updateAdminUser).mockResolvedValue({
      ...makeUser(),
      status: "Inactive",
    });
    const token = createAdminSessionToken({ userId: actorSuperuser.id });
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

  it("allows PATCH deactivate flow for superuser", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/users/usr-target", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Inactive" }),
      }),
      { params: Promise.resolve({ id: "usr-target" }) }
    );

    expect(response.status).toBe(200);
    expect(updateAdminUser).toHaveBeenCalledWith("usr-target", { status: "Inactive" });
  });
});
