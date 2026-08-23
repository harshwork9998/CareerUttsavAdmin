import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

const sampleUser: User = {
  id: "usr-json-1",
  name: "JSON User",
  email: "json@careeruttsav.in",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
  status: "Active",
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
};

vi.mock("@/lib/server/users-persistence", () => ({
  authenticateUser: vi.fn(),
  loadUsers: vi.fn(),
  findUserById: vi.fn(),
  isEmailRegistered: vi.fn(),
  createRegisteredUser: vi.fn(),
  createUserRecord: vi.fn(),
  reviewUserAccount: vi.fn(),
  updateStoredPassword: vi.fn(),
  updateUserRecord: vi.fn(),
  countActiveSuperusers: vi.fn(),
  deleteUserRecord: vi.fn(),
}));

vi.mock("@/lib/server/admin-user-prisma-store", () => ({
  authenticatePrismaAdminUser: vi.fn(),
  countActivePrismaSuperusers: vi.fn(),
  createPrismaAdminUser: vi.fn(),
  createPrismaRegisteredAdminUser: vi.fn(),
  deletePrismaAdminUser: vi.fn(),
  findPrismaAdminUserById: vi.fn(),
  isPrismaAdminEmailRegistered: vi.fn(),
  listPrismaAdminUsers: vi.fn(),
  reviewPrismaAdminUserAccount: vi.fn(),
  updatePrismaAdminPassword: vi.fn(),
  updatePrismaAdminUser: vi.fn(),
}));

import {
  authenticatePrismaAdminUser,
  createPrismaAdminUser,
  deletePrismaAdminUser,
  findPrismaAdminUserById,
  listPrismaAdminUsers,
} from "@/lib/server/admin-user-prisma-store";
import {
  authenticateAdminUser,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
} from "@/lib/server/admin-user-service";
import {
  authenticateUser,
  createUserRecord,
  deleteUserRecord,
  loadUsers,
} from "@/lib/server/users-persistence";

describe("admin user service routing", () => {
  const original = process.env.ADMIN_USER_PERSISTENCE;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadUsers).mockReturnValue([sampleUser]);
    vi.mocked(authenticateUser).mockReturnValue({
      ok: true,
      user: sampleUser,
    });
    vi.mocked(listPrismaAdminUsers).mockResolvedValue([sampleUser]);
    vi.mocked(authenticatePrismaAdminUser).mockResolvedValue({
      ok: true,
      user: sampleUser,
    });
    vi.mocked(createPrismaAdminUser).mockResolvedValue(sampleUser);
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADMIN_USER_PERSISTENCE;
    } else {
      process.env.ADMIN_USER_PERSISTENCE = original;
    }
  });

  it("uses JSON backend by default", async () => {
    delete process.env.ADMIN_USER_PERSISTENCE;
    await listAdminUsers();
    expect(loadUsers).toHaveBeenCalledOnce();
    expect(listPrismaAdminUsers).not.toHaveBeenCalled();
  });

  it("uses Prisma backend when configured", async () => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    await listAdminUsers();
    expect(listPrismaAdminUsers).toHaveBeenCalledOnce();
    expect(loadUsers).not.toHaveBeenCalled();
  });

  it("does not dual-write in prisma mode", async () => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    await authenticateAdminUser("json@careeruttsav.in", "secret");
    expect(authenticatePrismaAdminUser).toHaveBeenCalledOnce();
    expect(authenticateUser).not.toHaveBeenCalled();
  });

  it("does not write JSON backend in prisma mode on create", async () => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    await createAdminUser({
      name: "New",
      email: "new@careeruttsav.in",
      role: "user",
      roleId: ROLE_ID_BY_NAME.user,
      status: "Active",
    });
    expect(createPrismaAdminUser).toHaveBeenCalledOnce();
    expect(createUserRecord).not.toHaveBeenCalled();
  });

  it("does not call ensureSeedAccounts path in prisma mode", async () => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    await listAdminUsers();
    expect(loadUsers).not.toHaveBeenCalled();
  });

  it("uses Prisma delete backend without writing JSON", async () => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    vi.mocked(findPrismaAdminUserById).mockResolvedValue({
      ...sampleUser,
      id: "usr-target",
    });
    vi.mocked(deletePrismaAdminUser).mockResolvedValue(undefined);

    await deleteAdminUser("usr-target", { actorUserId: "usr-super" });

    expect(deletePrismaAdminUser).toHaveBeenCalledWith("usr-target");
    expect(deleteUserRecord).not.toHaveBeenCalled();
  });
});
