import { randomBytes } from "crypto";

import { ROLE_ID_BY_NAME } from "@/constants";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/admin-password";
import { AdminUserError } from "@/lib/server/admin-user-errors";
import {
  mapApiAdminRoleToPrisma,
  mapApiAdminUserStatusToPrisma,
  mapPrismaAdminUserToApi,
  type PrismaAdminUserRecord,
} from "@/lib/server/admin-user-prisma-map";
import { prisma } from "@/lib/server/prisma";
import { generateId } from "@/lib/utils";
import type { RegisterPayload } from "@/types/auth";
import type { RoleName, User, UserStatus } from "@/types";

export const PATCH_PROTECTED_ADMIN_USER_FIELDS = [
  "id",
  "createdAt",
  "lastLogin",
  "roleId",
] as const;

export const PATCH_EDITABLE_ADMIN_USER_FIELDS = [
  "name",
  "email",
  "phone",
  "avatar",
  "role",
  "status",
  "department",
] as const;

export type CreateAdminUserInput = Omit<User, "id" | "createdAt" | "updatedAt">;

export type PatchAdminUserInput = Partial<User>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseIsoDate(value: string | undefined, field: string): Date {
  if (!value) {
    throw new AdminUserError(400, `Invalid ${field}`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminUserError(400, `Invalid ${field}`);
  }
  return date;
}

function generateInvitePassword(): string {
  return randomBytes(24).toString("base64url");
}

function pickEditablePatch(patch: PatchAdminUserInput): Partial<User> {
  const picked: Partial<User> = {};
  for (const field of PATCH_EDITABLE_ADMIN_USER_FIELDS) {
    if (patch[field] !== undefined) {
      (picked as Record<string, unknown>)[field] = patch[field];
    }
  }
  return picked;
}

export type PrismaAuthLookupResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "blocked"; status: UserStatus; user: User };

export async function authenticatePrismaAdminUser(
  email: string,
  password: string
): Promise<PrismaAuthLookupResult> {
  const normalized = normalizeEmail(email);
  const record = await prisma.adminUser.findUnique({
    where: { email: normalized },
  });

  if (!record || !verifyAdminPassword(password, record.passwordHash)) {
    return { ok: false, reason: "invalid" };
  }

  const user = mapPrismaAdminUserToApi(record);

  if (user.status !== "Active") {
    return {
      ok: false,
      reason: "blocked",
      status: user.status,
      user,
    };
  }

  const now = new Date();
  const updated = await prisma.adminUser.update({
    where: { id: record.id },
    data: { lastLogin: now, updatedAt: now },
  });

  return { ok: true, user: mapPrismaAdminUserToApi(updated) };
}

export async function listPrismaAdminUsers(): Promise<User[]> {
  const records = await prisma.adminUser.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return records.map((record) => mapPrismaAdminUserToApi(record));
}

export async function findPrismaAdminUserById(id: string): Promise<User | null> {
  const record = await prisma.adminUser.findUnique({ where: { id } });
  return record ? mapPrismaAdminUserToApi(record) : null;
}

export async function isPrismaAdminEmailRegistered(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const count = await prisma.adminUser.count({ where: { email: normalized } });
  return count > 0;
}

export async function createPrismaRegisteredAdminUser(
  payload: RegisterPayload
): Promise<User> {
  const now = new Date();
  const normalizedEmail = normalizeEmail(payload.email);

  const existing = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    throw new AdminUserError(409, "An account with this email already exists");
  }

  const created = await prisma.adminUser.create({
    data: {
      id: `usr-${generateId()}`,
      name: payload.fullName.trim(),
      email: normalizedEmail,
      phone: payload.mobile,
      role: "user",
      roleId: ROLE_ID_BY_NAME.user,
      status: "PendingApproval",
      department: "Pending Review",
      passwordHash: hashAdminPassword(payload.password),
      createdAt: now,
      updatedAt: now,
    },
  });

  return mapPrismaAdminUserToApi(created);
}

export async function createPrismaAdminUser(
  input: CreateAdminUserInput,
  password?: string
): Promise<User> {
  const now = new Date();
  const normalizedEmail = normalizeEmail(input.email);
  const plainPassword = password?.trim() || generateInvitePassword();

  const existing = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    throw new AdminUserError(409, "An account with this email already exists");
  }

  const role = input.role;
  const created = await prisma.adminUser.create({
    data: {
      id: `usr-${generateId()}`,
      name: input.name.trim(),
      email: normalizedEmail,
      phone: input.phone ?? null,
      avatar: input.avatar ?? null,
      role: mapApiAdminRoleToPrisma(role),
      roleId: ROLE_ID_BY_NAME[role],
      status: mapApiAdminUserStatusToPrisma(input.status),
      department: input.department ?? null,
      passwordHash: hashAdminPassword(plainPassword),
      lastLogin: input.lastLogin ? parseIsoDate(input.lastLogin, "lastLogin") : null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return mapPrismaAdminUserToApi(created);
}

export async function updatePrismaAdminUser(
  id: string,
  patch: PatchAdminUserInput
): Promise<User> {
  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    throw new AdminUserError(404, "User not found");
  }

  const scalarPatch = pickEditablePatch(patch);
  if (scalarPatch.email !== undefined) {
    scalarPatch.email = normalizeEmail(scalarPatch.email);
    const duplicate = await prisma.adminUser.findFirst({
      where: { email: scalarPatch.email, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) {
      throw new AdminUserError(409, "An account with this email already exists");
    }
  }

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (scalarPatch.name !== undefined) data.name = scalarPatch.name.trim();
  if (scalarPatch.email !== undefined) data.email = scalarPatch.email;
  if (scalarPatch.phone !== undefined) data.phone = scalarPatch.phone ?? null;
  if (scalarPatch.avatar !== undefined) data.avatar = scalarPatch.avatar ?? null;
  if (scalarPatch.department !== undefined) {
    data.department = scalarPatch.department ?? null;
  }
  if (scalarPatch.status !== undefined) {
    data.status = mapApiAdminUserStatusToPrisma(scalarPatch.status);
  }
  if (scalarPatch.role !== undefined) {
    data.role = mapApiAdminRoleToPrisma(scalarPatch.role);
    data.roleId = ROLE_ID_BY_NAME[scalarPatch.role];
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data,
  });

  return mapPrismaAdminUserToApi(updated);
}

export async function reviewPrismaAdminUserAccount(
  id: string,
  action: "approve" | "reject",
  role?: RoleName
): Promise<User> {
  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    throw new AdminUserError(404, "User not found");
  }

  if (existing.status !== "PendingApproval") {
    throw new AdminUserError(400, "Only pending accounts can be reviewed");
  }

  const now = new Date();

  if (action === "reject") {
    const updated = await prisma.adminUser.update({
      where: { id },
      data: { status: "Rejected", updatedAt: now },
    });
    return mapPrismaAdminUserToApi(updated);
  }

  const assignedRole = role ?? "user";
  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      status: "Active",
      role: mapApiAdminRoleToPrisma(assignedRole),
      roleId: ROLE_ID_BY_NAME[assignedRole],
      department:
        existing.department === "Pending Review" ? null : existing.department,
      updatedAt: now,
    },
  });

  return mapPrismaAdminUserToApi(updated);
}

export async function updatePrismaAdminPassword(
  email: string,
  password: string
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const existing = await prisma.adminUser.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (!existing) return false;

  await prisma.adminUser.update({
    where: { id: existing.id },
    data: {
      passwordHash: hashAdminPassword(password),
      updatedAt: new Date(),
    },
  });
  return true;
}

export async function importPrismaAdminUsers(
  rows: Array<{
    user: User;
    passwordHash: string;
  }>
): Promise<void> {
  await prisma.$transaction(
    rows.map((row) =>
      prisma.adminUser.create({
        data: {
          id: row.user.id,
          name: row.user.name,
          email: normalizeEmail(row.user.email),
          phone: row.user.phone ?? null,
          avatar: row.user.avatar ?? null,
          role: mapApiAdminRoleToPrisma(row.user.role),
          roleId: row.user.roleId,
          status: mapApiAdminUserStatusToPrisma(row.user.status),
          department: row.user.department ?? null,
          passwordHash: row.passwordHash,
          lastLogin: row.user.lastLogin
            ? parseIsoDate(row.user.lastLogin, "lastLogin")
            : null,
          createdAt: parseIsoDate(row.user.createdAt, "createdAt"),
          updatedAt: parseIsoDate(row.user.updatedAt, "updatedAt"),
        },
      })
    )
  );
}

export async function countPrismaAdminUsers(): Promise<number> {
  return prisma.adminUser.count();
}

export async function findPrismaAdminUserRecordById(
  id: string
): Promise<PrismaAdminUserRecord | null> {
  return prisma.adminUser.findUnique({ where: { id } });
}

export async function findPrismaAdminUserRecordByEmail(
  email: string
): Promise<PrismaAdminUserRecord | null> {
  const normalized = email.trim().toLowerCase();
  return prisma.adminUser.findUnique({ where: { email: normalized } });
}

export async function getPrismaAdminUserAuthVersion(
  userId: string
): Promise<number | null> {
  const record = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { authVersion: true },
  });
  return record?.authVersion ?? null;
}

export async function createPrismaPasswordResetToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<string> {
  const created = await prisma.adminPasswordResetToken.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    },
  });
  return created.id;
}

export async function revokePrismaPasswordResetTokenById(
  tokenId: string
): Promise<void> {
  await prisma.adminPasswordResetToken.deleteMany({
    where: { id: tokenId, usedAt: null },
  });
}

export async function revokeOtherUnusedPrismaResetTokensForUser(
  userId: string,
  keepTokenId: string
): Promise<void> {
  await prisma.adminPasswordResetToken.deleteMany({
    where: {
      userId,
      usedAt: null,
      id: { not: keepTokenId },
    },
  });
}

export async function revokeUnusedPrismaResetTokensForUser(
  userId: string
): Promise<void> {
  await prisma.adminPasswordResetToken.deleteMany({
    where: { userId, usedAt: null },
  });
}

export async function resetAdminPasswordWithPrismaToken(input: {
  tokenHash: string;
  passwordHash: string;
}): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const token = await tx.adminPasswordResetToken.findUnique({
      where: { tokenHash: input.tokenHash },
      include: { user: true },
    });

    if (
      !token ||
      token.usedAt !== null ||
      token.expiresAt <= now ||
      token.user.status !== "Active"
    ) {
      throw new AdminUserError(400, "Reset link is invalid or has expired.");
    }

    await tx.adminUser.update({
      where: { id: token.userId },
      data: {
        passwordHash: input.passwordHash,
        authVersion: { increment: 1 },
        updatedAt: now,
      },
    });

    await tx.adminPasswordResetToken.update({
      where: { id: token.id },
      data: { usedAt: now },
    });

    await tx.adminPasswordResetToken.deleteMany({
      where: {
        userId: token.userId,
        id: { not: token.id },
        usedAt: null,
      },
    });
  });
}

export async function countActivePrismaSuperusers(): Promise<number> {
  return prisma.adminUser.count({
    where: { role: "superuser", status: "Active" },
  });
}

export async function deletePrismaAdminUser(id: string): Promise<void> {
  await prisma.adminUser.delete({ where: { id } });
}
