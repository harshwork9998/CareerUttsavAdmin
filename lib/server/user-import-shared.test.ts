import { describe, expect, it } from "vitest";

import { isAdminPasswordHash, verifyAdminPassword } from "@/lib/admin-password";
import {
  buildUserPreflightReport,
  recordsToImportRows,
  type UserSourceRecord,
} from "../../scripts/lib/user-import-shared";
import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

function sourceRecord(
  overrides: Partial<UserSourceRecord> = {}
): UserSourceRecord {
  const user: User = {
    id: "usr-001",
    name: "Admin",
    email: "admin@careeruttsav.in",
    role: "superuser",
    roleId: ROLE_ID_BY_NAME.superuser,
    status: "Active",
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
    ...(overrides.user ?? {}),
  };
  return {
    password: overrides.password ?? "admin123",
    user,
  };
}

describe("user import shared", () => {
  it("hashes plaintext passwords for prisma import rows", () => {
    const rows = recordsToImportRows([sourceRecord({ password: "plain-secret" })]);
    expect(rows).toHaveLength(1);
    expect(isAdminPasswordHash(rows[0]!.passwordHash)).toBe(true);
    expect(rows[0]!.passwordHash).not.toBe("plain-secret");
  });

  it("never stores plaintext in import rows", () => {
    const password = "super-secret";
    const rows = recordsToImportRows([sourceRecord({ password })]);
    for (const row of rows) {
      expect(row.passwordHash).not.toBe(password);
      expect(row.passwordHash.startsWith("scrypt$")).toBe(true);
    }
  });

  it("flags duplicate emails in preflight", () => {
    const report = buildUserPreflightReport("/tmp/users.json", [
      sourceRecord(),
      sourceRecord({
        user: {
          id: "usr-002",
          name: "Dup",
          email: "admin@careeruttsav.in",
          role: "user",
          roleId: ROLE_ID_BY_NAME.user,
          status: "Active",
          createdAt: "2024-01-15T10:00:00.000Z",
          updatedAt: "2024-01-15T10:00:00.000Z",
        },
      }),
    ]);
    expect(report.duplicateEmails).toContain("admin@careeruttsav.in");
    expect(report.safeToImport).toBe(false);
  });

  it("reconciliation-compatible hashes verify against source password", () => {
    const password = "import-password";
    const rows = recordsToImportRows([sourceRecord({ password })]);
    expect(verifyAdminPassword(password, rows[0]!.passwordHash)).toBe(true);
    expect(verifyAdminPassword("wrong", rows[0]!.passwordHash)).toBe(false);
  });
});
