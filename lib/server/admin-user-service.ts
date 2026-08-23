import { ROLE_ID_BY_NAME } from "@/constants";
import { isPrismaAdminUserPersistence } from "@/lib/server/admin-user-persistence-mode";
import {
  authenticatePrismaAdminUser,
  countActivePrismaSuperusers,
  createPrismaAdminUser,
  createPrismaRegisteredAdminUser,
  deletePrismaAdminUser,
  findPrismaAdminUserById,
  findPrismaAdminUserRecordById,
  getPrismaAdminUserAuthVersion,
  isPrismaAdminEmailRegistered,
  listPrismaAdminUsers,
  reviewPrismaAdminUserAccount,
  updatePrismaAdminPassword,
  updatePrismaAdminUser,
  type CreateAdminUserInput,
  type PatchAdminUserInput,
} from "@/lib/server/admin-user-prisma-store";
import { AdminUserError, isAdminUserError } from "@/lib/server/admin-user-errors";
import {
  authenticateUser,
  countActiveSuperusers,
  createRegisteredUser,
  createUserRecord,
  deleteUserRecord,
  findUserById,
  isEmailRegistered,
  loadUsers,
  reviewUserAccount,
  updateStoredPassword,
  updateUserRecord,
  type AuthLookupResult,
} from "@/lib/server/users-persistence";
import type { RegisterPayload } from "@/types/auth";
import type { RoleName, User } from "@/types";

export type AdminAuthLookupResult = AuthLookupResult;

export async function authenticateAdminUser(
  email: string,
  password: string
): Promise<AdminAuthLookupResult> {
  if (isPrismaAdminUserPersistence()) {
    return authenticatePrismaAdminUser(email, password);
  }
  return authenticateUser(email, password);
}

export async function listAdminUsers(): Promise<User[]> {
  if (isPrismaAdminUserPersistence()) {
    return listPrismaAdminUsers();
  }
  return loadUsers();
}

export async function findAdminUserById(id: string): Promise<User | null> {
  if (isPrismaAdminUserPersistence()) {
    return findPrismaAdminUserById(id);
  }
  return findUserById(id);
}

export async function getAdminUserAuthVersion(userId: string): Promise<number> {
  if (isPrismaAdminUserPersistence()) {
    const version = await getPrismaAdminUserAuthVersion(userId);
    return version ?? 0;
  }
  return 0;
}

export async function isAdminEmailRegistered(email: string): Promise<boolean> {
  if (isPrismaAdminUserPersistence()) {
    return isPrismaAdminEmailRegistered(email);
  }
  return isEmailRegistered(email);
}

export async function createRegisteredAdminUser(
  payload: RegisterPayload
): Promise<User> {
  if (isPrismaAdminUserPersistence()) {
    return createPrismaRegisteredAdminUser(payload);
  }
  return createRegisteredUser(payload);
}

export async function createAdminUser(
  input: CreateAdminUserInput,
  password?: string
): Promise<User> {
  if (isPrismaAdminUserPersistence()) {
    return createPrismaAdminUser(input, password);
  }

  const role = input.role;
  if (!(role in ROLE_ID_BY_NAME)) {
    throw new AdminUserError(400, "A valid role is required");
  }

  return createUserRecord(
    {
      ...input,
      email: input.email.trim().toLowerCase(),
      roleId: ROLE_ID_BY_NAME[role],
    },
    password ?? "changeme"
  );
}

export async function updateAdminUser(
  id: string,
  patch: PatchAdminUserInput
): Promise<User> {
  if (isPrismaAdminUserPersistence()) {
    return updatePrismaAdminUser(id, patch);
  }

  const existing = findUserById(id);
  if (!existing) {
    throw new AdminUserError(404, "User not found");
  }

  const safePatch = { ...patch };
  delete (safePatch as { id?: string }).id;
  delete (safePatch as { createdAt?: string }).createdAt;
  delete (safePatch as { lastLogin?: string }).lastLogin;
  if (safePatch.role && safePatch.role in ROLE_ID_BY_NAME) {
    safePatch.roleId = ROLE_ID_BY_NAME[safePatch.role as RoleName];
  }

  const updated = updateUserRecord(id, safePatch);
  if (!updated) {
    throw new AdminUserError(404, "User not found");
  }
  return updated;
}

export async function reviewAdminUserAccount(
  id: string,
  action: "approve" | "reject",
  role?: RoleName
): Promise<User> {
  if (isPrismaAdminUserPersistence()) {
    return reviewPrismaAdminUserAccount(id, action, role);
  }

  const reviewed = reviewUserAccount(id, action, role);
  if (!reviewed) {
    throw new AdminUserError(400, "Unable to review account");
  }
  return reviewed;
}

export async function updateAdminPassword(
  email: string,
  password: string
): Promise<boolean> {
  if (isPrismaAdminUserPersistence()) {
    return updatePrismaAdminPassword(email, password);
  }
  return updateStoredPassword(email, password);
}

async function countActiveAdminSuperusers(): Promise<number> {
  if (isPrismaAdminUserPersistence()) {
    return countActivePrismaSuperusers();
  }
  return countActiveSuperusers();
}

export async function deleteAdminUser(
  id: string,
  options: { actorUserId: string }
): Promise<void> {
  const existing = await findAdminUserById(id);
  if (!existing) {
    throw new AdminUserError(404, "User not found");
  }

  if (id === options.actorUserId) {
    throw new AdminUserError(409, "You cannot delete your own account.");
  }

  if (existing.role === "superuser" && existing.status === "Active") {
    const activeSuperuserCount = await countActiveAdminSuperusers();
    if (activeSuperuserCount <= 1) {
      throw new AdminUserError(
        409,
        "At least one active superuser must remain."
      );
    }
  }

  if (isPrismaAdminUserPersistence()) {
    await deletePrismaAdminUser(id);
    return;
  }

  const deleted = deleteUserRecord(id);
  if (!deleted) {
    throw new AdminUserError(404, "User not found");
  }
}

export { AdminUserError, isAdminUserError };
