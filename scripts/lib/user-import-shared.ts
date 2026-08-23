import fs from "node:fs";

import { hashAdminPassword } from "@/lib/admin-password";
import type { UserAuthRecord } from "@/lib/server/users-persistence";
import type { RoleName, User, UserStatus } from "@/types";

const KNOWN_ROLES: RoleName[] = ["user", "superuser"];
const KNOWN_STATUSES: UserStatus[] = [
  "Active",
  "Inactive",
  "Suspended",
  "Pending Approval",
  "Rejected",
];

const SEED_EMAILS = new Set([
  "admin@careeruttsav.in",
  "admin@careeruttsav.com",
  "user@careeruttsav.com",
]);

export type UserSourceRecord = {
  user: User;
  password: string;
};

export type UserPreflightReport = {
  source: string;
  totalUsers: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  duplicateEmails: string[];
  duplicateIds: string[];
  missingId: string[];
  missingEmail: string[];
  invalidEmails: string[];
  missingPassword: string[];
  invalidTimestamps: string[];
  unknownRoles: string[];
  unknownStatuses: string[];
  seedAccountPresence: Record<string, boolean>;
  issues: string[];
  safeToImport: boolean;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseTimestamp(value: string | undefined, label: string): boolean {
  if (!value) return true;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function readUserAuthSource(sourcePath: string): UserSourceRecord[] {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  const raw = fs.readFileSync(sourcePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Source must be a JSON array: ${sourcePath}`);
  }
  return parsed as UserSourceRecord[];
}

export function buildUserPreflightReport(
  sourcePath: string,
  records: UserSourceRecord[]
): UserPreflightReport {
  const byRole: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const emailToIds = new Map<string, string[]>();
  const idCounts = new Map<string, number>();
  const missingId: string[] = [];
  const missingEmail: string[] = [];
  const invalidEmails: string[] = [];
  const missingPassword: string[] = [];
  const invalidTimestamps: string[] = [];
  const unknownRoles: string[] = [];
  const unknownStatuses: string[] = [];
  const issues: string[] = [];

  for (const [index, record] of records.entries()) {
    const label = `record[${index}]`;
    const user = record.user;
    const email = user?.email?.trim().toLowerCase() ?? "";
    const id = user?.id?.trim() ?? "";

    if (!id) missingId.push(label);
    if (!email) missingEmail.push(label);
    if (email && !isValidEmail(email)) invalidEmails.push(email);

    if (!record.password || record.password.trim().length === 0) {
      missingPassword.push(id || label);
    }

    if (id) {
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
    if (email) {
      const ids = emailToIds.get(email) ?? [];
      ids.push(id || label);
      emailToIds.set(email, ids);
    }

    if (user?.role && !KNOWN_ROLES.includes(user.role)) {
      unknownRoles.push(user.role);
    }
    if (user?.status && !KNOWN_STATUSES.includes(user.status)) {
      unknownStatuses.push(user.status);
    }

    byRole[user?.role ?? "unknown"] = (byRole[user?.role ?? "unknown"] ?? 0) + 1;
    byStatus[user?.status ?? "unknown"] =
      (byStatus[user?.status ?? "unknown"] ?? 0) + 1;

    for (const field of ["createdAt", "updatedAt", "lastLogin"] as const) {
      if (!parseTimestamp(user?.[field], field)) {
        invalidTimestamps.push(`${id || label}:${field}`);
      }
    }
  }

  const duplicateEmails = [...emailToIds.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([email]) => email);
  const duplicateIds = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  if (duplicateEmails.length > 0) {
    issues.push(`duplicateEmails: ${duplicateEmails.join(", ")}`);
  }
  if (duplicateIds.length > 0) {
    issues.push(`duplicateIds: ${duplicateIds.join(", ")}`);
  }
  if (missingPassword.length > 0) {
    issues.push(`missingPassword: ${missingPassword.length}`);
  }

  const seedAccountPresence = Object.fromEntries(
    [...SEED_EMAILS].map((email) => [
      email,
      records.some(
        (record) => record.user.email.trim().toLowerCase() === email
      ),
    ])
  );

  const safeToImport =
    duplicateEmails.length === 0 &&
    duplicateIds.length === 0 &&
    missingId.length === 0 &&
    missingEmail.length === 0 &&
    invalidEmails.length === 0 &&
    missingPassword.length === 0 &&
    unknownRoles.length === 0 &&
    unknownStatuses.length === 0;

  return {
    source: sourcePath,
    totalUsers: records.length,
    byRole,
    byStatus,
    duplicateEmails,
    duplicateIds,
    missingId,
    missingEmail,
    invalidEmails,
    missingPassword,
    invalidTimestamps,
    unknownRoles: [...new Set(unknownRoles)],
    unknownStatuses: [...new Set(unknownStatuses)],
    seedAccountPresence,
    issues,
    safeToImport,
  };
}

export function recordsToImportRows(records: UserSourceRecord[]): Array<{
  user: User;
  passwordHash: string;
}> {
  return records.map((record) => ({
    user: {
      ...record.user,
      email: record.user.email.trim().toLowerCase(),
    },
    passwordHash: hashAdminPassword(record.password),
  }));
}
