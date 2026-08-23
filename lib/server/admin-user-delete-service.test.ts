import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashAdminPassword } from "@/lib/admin-password";
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

function prismaRecord(user: User) {
  return {
    ...user,
    status:
      user.status === "Pending Approval" ? "PendingApproval" : user.status,
    passwordHash: hashAdminPassword("secret-pass"),
    phone: user.phone ?? null,
    avatar: user.avatar ?? null,
    department: user.department ?? null,
    lastLogin: null,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

const {
  findUniqueMock,
  countMock,
  deleteMock,
  createMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
  deleteMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    adminUser: {
      findUnique: findUniqueMock,
      count: countMock,
      delete: deleteMock,
      create: createMock,
    },
  },
}));

import {
  createPrismaRegisteredAdminUser,
  deletePrismaAdminUser,
} from "@/lib/server/admin-user-prisma-store";
import { deleteAdminUser } from "@/lib/server/admin-user-service";

describe("deleteAdminUser prisma service", () => {
  const originalPersistence = process.env.ADMIN_USER_PERSISTENCE;

  beforeEach(() => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    vi.clearAllMocks();
    countMock.mockResolvedValue(2);
    deleteMock.mockResolvedValue({});
  });

  afterEach(() => {
    if (originalPersistence === undefined) {
      delete process.env.ADMIN_USER_PERSISTENCE;
    } else {
      process.env.ADMIN_USER_PERSISTENCE = originalPersistence;
    }
  });

  it("hard deletes user row from Prisma only", async () => {
    findUniqueMock.mockResolvedValue(prismaRecord(makeUser()));

    await deleteAdminUser(makeUser().id, { actorUserId: actorSuperuser.id });

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "usr-target" } });
    expect(deleteMock).toHaveBeenCalledOnce();
  });

  it("can delete inactive, pending, and additional superuser accounts", async () => {
    for (const user of [
      makeUser({ status: "Inactive" }),
      makeUser({ status: "Pending Approval" }),
      makeUser({
        id: "usr-super-2",
        role: "superuser",
        roleId: ROLE_ID_BY_NAME.superuser,
      }),
    ]) {
      vi.clearAllMocks();
      countMock.mockResolvedValue(2);
      findUniqueMock.mockResolvedValue(prismaRecord(user));
      await deleteAdminUser(user.id, { actorUserId: actorSuperuser.id });
      expect(deleteMock).toHaveBeenCalledOnce();
    }
  });

  it("blocks deleting own account", async () => {
    findUniqueMock.mockResolvedValue(prismaRecord(actorSuperuser));

    await expect(
      deleteAdminUser(actorSuperuser.id, { actorUserId: actorSuperuser.id })
    ).rejects.toMatchObject({
      status: 409,
      message: "You cannot delete your own account.",
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("blocks deleting the last active superuser", async () => {
    findUniqueMock.mockResolvedValue(prismaRecord(actorSuperuser));
    countMock.mockResolvedValue(1);

    await expect(
      deleteAdminUser(actorSuperuser.id, { actorUserId: "usr-other-super" })
    ).rejects.toMatchObject({
      status: 409,
      message: "At least one active superuser must remain.",
    });
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("returns 404 when user does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      deleteAdminUser("missing", { actorUserId: actorSuperuser.id })
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("deletePrismaAdminUser store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMock.mockResolvedValue({});
  });

  it("removes passwordHash with the deleted row", async () => {
    await deletePrismaAdminUser("usr-target");
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "usr-target" } });
  });
});

describe("registration after delete", () => {
  const originalPersistence = process.env.ADMIN_USER_PERSISTENCE;

  beforeEach(() => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalPersistence === undefined) {
      delete process.env.ADMIN_USER_PERSISTENCE;
    } else {
      process.env.ADMIN_USER_PERSISTENCE = originalPersistence;
    }
  });

  it("allows re-registration with new id and hashed password", async () => {
    createMock.mockImplementation(async ({ data }) => ({
      ...data,
      lastLogin: null,
    }));

    const user = await createPrismaRegisteredAdminUser({
      fullName: "Returning User",
      email: "target@careeruttsav.in",
      mobile: "9876543210",
      password: "new-password",
    });

    expect(user.status).toBe("Pending Approval");
    expect(user.id).toMatch(/^usr-/);
    const createData = createMock.mock.calls[0]![0] as {
      data: { passwordHash: string; id: string };
    };
    expect(createData.data.passwordHash).not.toBe("new-password");
    expect(createData.data.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(createData.data.id).not.toBe("usr-target");
  });
});
