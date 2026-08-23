import { verifyAdminPassword } from "@/lib/admin-password";
import type { User } from "@/types";

export type AdminUserReconciliationRow = {
  userId: string;
  metadataExactMatch: boolean;
  metadataMismatches: string[];
  passwordValidAgainstSource: boolean;
};

export type AdminUserReconciliationReport = {
  userCountJson: number;
  userCountPrisma: number;
  rows: AdminUserReconciliationRow[];
  exactMetadataMatchCount: number;
  metadataMismatchCount: number;
  passwordMismatchCount: number;
  safeForCutover: boolean;
};

const METADATA_FIELDS = [
  "name",
  "email",
  "phone",
  "avatar",
  "role",
  "roleId",
  "status",
  "department",
  "lastLogin",
  "createdAt",
  "updatedAt",
] as const;

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function timestampInstant(value: string | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function compareMetadata(jsonUser: User, prismaUser: User): string[] {
  const mismatches: string[] = [];

  for (const field of METADATA_FIELDS) {
    const jsonValue = jsonUser[field];
    const prismaValue = prismaUser[field];

    if (field === "email") {
      const jsonEmail = String(jsonValue).trim().toLowerCase();
      const prismaEmail = String(prismaValue).trim().toLowerCase();
      if (jsonEmail !== prismaEmail) mismatches.push(field);
      continue;
    }

    if (field === "phone" || field === "avatar" || field === "department") {
      if (
        normalizeOptionalString(jsonValue as string | undefined) !==
        normalizeOptionalString(prismaValue as string | undefined)
      ) {
        mismatches.push(field);
      }
      continue;
    }

    if (field === "lastLogin" || field === "createdAt" || field === "updatedAt") {
      if (
        timestampInstant(jsonValue as string | undefined) !==
        timestampInstant(prismaValue as string | undefined)
      ) {
        mismatches.push(field);
      }
      continue;
    }

    if (jsonValue !== prismaValue) {
      mismatches.push(field);
    }
  }

  return mismatches;
}

export function reconcileAdminUsersJsonToPrisma(input: {
  jsonUsers: User[];
  sourcePasswordsByUserId: Map<string, string>;
  prismaUsers: User[];
  prismaPasswordHashesByUserId: Map<string, string>;
}): AdminUserReconciliationReport {
  const prismaById = new Map(input.prismaUsers.map((user) => [user.id, user]));
  const rows: AdminUserReconciliationRow[] = [];
  let exactMetadataMatchCount = 0;
  let passwordMismatchCount = 0;

  for (const jsonUser of input.jsonUsers) {
    const prismaUser = prismaById.get(jsonUser.id);
    if (!prismaUser) {
      rows.push({
        userId: jsonUser.id,
        metadataExactMatch: false,
        metadataMismatches: ["missing_in_db"],
        passwordValidAgainstSource: false,
      });
      passwordMismatchCount += 1;
      continue;
    }

    const metadataMismatches = compareMetadata(jsonUser, prismaUser);
    const metadataExactMatch = metadataMismatches.length === 0;
    if (metadataExactMatch) exactMetadataMatchCount += 1;

    const sourcePassword = input.sourcePasswordsByUserId.get(jsonUser.id) ?? "";
    const passwordHash =
      input.prismaPasswordHashesByUserId.get(jsonUser.id) ?? "";
    const passwordValidAgainstSource = verifyAdminPassword(
      sourcePassword,
      passwordHash
    );
    if (!passwordValidAgainstSource) passwordMismatchCount += 1;

    rows.push({
      userId: jsonUser.id,
      metadataExactMatch,
      metadataMismatches,
      passwordValidAgainstSource,
    });
  }

  const metadataMismatchCount = rows.filter((row) => !row.metadataExactMatch).length;
  const safeForCutover =
    input.jsonUsers.length === input.prismaUsers.length &&
    metadataMismatchCount === 0 &&
    passwordMismatchCount === 0;

  return {
    userCountJson: input.jsonUsers.length,
    userCountPrisma: input.prismaUsers.length,
    rows,
    exactMetadataMatchCount,
    metadataMismatchCount,
    passwordMismatchCount,
    safeForCutover,
  };
}
