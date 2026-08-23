import type {
  AdminRole as PrismaAdminRole,
  AdminUserStatus as PrismaAdminUserStatus,
} from "@/lib/generated/prisma/client";
import type { RoleName, User, UserStatus } from "@/types";

export type PrismaAdminUserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  role: PrismaAdminRole;
  roleId: string;
  status: PrismaAdminUserStatus;
  department: string | null;
  passwordHash: string;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_TO_API: Record<PrismaAdminUserStatus, UserStatus> = {
  Active: "Active",
  Inactive: "Inactive",
  Suspended: "Suspended",
  PendingApproval: "Pending Approval",
  Rejected: "Rejected",
};

const STATUS_TO_PRISMA: Record<UserStatus, PrismaAdminUserStatus> = {
  Active: "Active",
  Inactive: "Inactive",
  Suspended: "Suspended",
  "Pending Approval": "PendingApproval",
  Rejected: "Rejected",
};

const ROLE_TO_API: Record<PrismaAdminRole, RoleName> = {
  user: "user",
  superuser: "superuser",
};

const ROLE_TO_PRISMA: Record<RoleName, PrismaAdminRole> = {
  user: "user",
  superuser: "superuser",
};

export function mapPrismaAdminUserStatusToApi(
  status: PrismaAdminUserStatus
): UserStatus {
  return STATUS_TO_API[status];
}

export function mapApiAdminUserStatusToPrisma(
  status: UserStatus
): PrismaAdminUserStatus {
  return STATUS_TO_PRISMA[status];
}

export function mapPrismaAdminRoleToApi(role: PrismaAdminRole): RoleName {
  return ROLE_TO_API[role];
}

export function mapApiAdminRoleToPrisma(role: RoleName): PrismaAdminRole {
  return ROLE_TO_PRISMA[role];
}

/** Safe API user — never includes passwordHash. */
export function mapPrismaAdminUserToApi(record: PrismaAdminUserRecord): User {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone ?? undefined,
    avatar: record.avatar ?? undefined,
    role: mapPrismaAdminRoleToApi(record.role),
    roleId: record.roleId,
    status: mapPrismaAdminUserStatusToApi(record.status),
    department: record.department ?? undefined,
    lastLogin: record.lastLogin?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
