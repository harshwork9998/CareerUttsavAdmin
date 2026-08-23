import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashAdminPassword, isAdminPasswordHash } from "@/lib/admin-password";
import { ROLE_ID_BY_NAME } from "@/constants";

const baseRecord = {
  id: "usr-001",
  name: "Admin User",
  email: "admin@careeruttsav.in",
  role: "superuser" as const,
  roleId: ROLE_ID_BY_NAME.superuser,
  status: "Active" as const,
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-01-15T10:00:00.000Z"),
  passwordHash: hashAdminPassword("admin123"),
  authVersion: 0,
  phone: null,
  avatar: null,
  department: null,
  lastLogin: null,
};

const {
  findUniqueMock,
  findFirstMock,
  findManyMock,
  createMock,
  updateMock,
  countMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findFirstMock: vi.fn(),
  findManyMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    adminUser: {
      findUnique: findUniqueMock,
      findFirst: findFirstMock,
      findMany: findManyMock,
      create: createMock,
      update: updateMock,
      count: countMock,
    },
    $transaction: vi.fn(async (actions: Promise<unknown>[]) => {
      for (const action of actions) {
        await action;
      }
    }),
  },
}));

import {
  authenticatePrismaAdminUser,
  createPrismaAdminUser,
  createPrismaRegisteredAdminUser,
  listPrismaAdminUsers,
  updatePrismaAdminUser,
} from "@/lib/server/admin-user-prisma-store";

describe("admin user prisma store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
  });

  it("authenticates Active users and updates lastLogin", async () => {
    findUniqueMock.mockResolvedValue({ ...baseRecord });
    updateMock.mockResolvedValue({
      ...baseRecord,
      lastLogin: new Date("2026-08-23T10:00:00.000Z"),
      updatedAt: new Date("2026-08-23T10:00:00.000Z"),
    });

    const result = await authenticatePrismaAdminUser(
      "admin@careeruttsav.in",
      "admin123"
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.lastLogin).toBeDefined();
      expect("passwordHash" in result.user).toBe(false);
    }
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastLogin: expect.any(Date) }),
      })
    );
  });

  it("rejects wrong password", async () => {
    findUniqueMock.mockResolvedValue({ ...baseRecord });
    const result = await authenticatePrismaAdminUser(
      "admin@careeruttsav.in",
      "wrong-password"
    );
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it.each([
    ["Pending Approval", "PendingApproval"],
    ["Inactive", "Inactive"],
    ["Suspended", "Suspended"],
    ["Rejected", "Rejected"],
  ] as const)("blocks %s users", async (apiStatus, prismaStatus) => {
    findUniqueMock.mockResolvedValue({
      ...baseRecord,
      status: prismaStatus,
    });
    const result = await authenticatePrismaAdminUser(
      "admin@careeruttsav.in",
      "admin123"
    );
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "blocked") {
      expect(result.status).toBe(apiStatus);
    }
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("never returns passwordHash from list", async () => {
    findManyMock.mockResolvedValue([{ ...baseRecord }]);
    const users = await listPrismaAdminUsers();
    expect(users).toHaveLength(1);
    expect("passwordHash" in users[0]!).toBe(false);
  });

  it("stores hashed passwords on create", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseRecord,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await createPrismaAdminUser(
      {
        name: "New User",
        email: "new@careeruttsav.in",
        role: "user",
        roleId: ROLE_ID_BY_NAME.user,
        status: "Active",
      },
      "invite-password"
    );

    const createArg = createMock.mock.calls[0]![0] as {
      data: { passwordHash: string };
    };
    expect(isAdminPasswordHash(createArg.data.passwordHash)).toBe(true);
    expect(createArg.data.passwordHash).not.toBe("invite-password");
  });

  it("ignores protected patch fields and derives roleId from role", async () => {
    findUniqueMock.mockResolvedValue({ ...baseRecord });
    updateMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseRecord,
      ...data,
      role: "user",
      roleId: ROLE_ID_BY_NAME.user,
      updatedAt: new Date(),
    }));

    const updated = await updatePrismaAdminUser(baseRecord.id, {
      name: "Renamed",
      role: "user",
      roleId: "role-superuser",
      id: "usr-hijack",
      createdAt: "2099-01-01T00:00:00.000Z",
      lastLogin: "2099-01-01T00:00:00.000Z",
    });

    expect(updated.role).toBe("user");
    expect(updated.roleId).toBe(ROLE_ID_BY_NAME.user);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Renamed",
          role: "user",
          roleId: ROLE_ID_BY_NAME.user,
        }),
      })
    );
    const updateData = (updateMock.mock.calls[0]![0] as { data: Record<string, unknown> })
      .data;
    expect(updateData.id).toBeUndefined();
    expect(updateData.createdAt).toBeUndefined();
    expect(updateData.lastLogin).toBeUndefined();
  });

  it("creates self-registered user as Pending Approval with user role", async () => {
    findUniqueMock.mockResolvedValue(null);
    createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const user = await createPrismaRegisteredAdminUser({
      fullName: "New Admin",
      email: "new.admin@careeruttsav.in",
      mobile: "9876543210",
      password: "securepass",
    });

    expect(user.status).toBe("Pending Approval");
    expect(user.role).toBe("user");
    expect(user.roleId).toBe(ROLE_ID_BY_NAME.user);
    expect("passwordHash" in user).toBe(false);

    const createData = createMock.mock.calls[0]![0] as {
      data: { status: string; role: string; roleId: string; passwordHash: string };
    };
    expect(createData.data.status).toBe("PendingApproval");
    expect(createData.data.role).toBe("user");
    expect(createData.data.roleId).toBe(ROLE_ID_BY_NAME.user);
    expect(isAdminPasswordHash(createData.data.passwordHash)).toBe(true);
    expect(createData.data.passwordHash).not.toBe("securepass");
    expect(createData.data).not.toHaveProperty("password");
    expect(createData.data).not.toHaveProperty("confirmPassword");
  });
});
