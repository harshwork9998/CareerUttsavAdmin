import { describe, expect, it } from "vitest";

import { hashAdminPassword } from "@/lib/admin-password";
import { reconcileAdminUsersJsonToPrisma } from "@/lib/server/admin-user-reconciliation";
import type { User } from "@/types";

const baseUser: User = {
  id: "usr-001",
  name: "Admin",
  email: "admin@careeruttsav.in",
  role: "superuser",
  roleId: "role-superuser",
  status: "Active",
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
};

describe("admin user reconciliation", () => {
  it("reports password validity without exposing secrets", () => {
    const password = "admin123";
    const hash = hashAdminPassword(password);
    const report = reconcileAdminUsersJsonToPrisma({
      jsonUsers: [baseUser],
      sourcePasswordsByUserId: new Map([[baseUser.id, password]]),
      prismaUsers: [baseUser],
      prismaPasswordHashesByUserId: new Map([[baseUser.id, hash]]),
    });

    expect(report.safeForCutover).toBe(true);
    expect(report.rows[0]?.passwordValidAgainstSource).toBe(true);
  });

  it("flags password mismatch", () => {
    const report = reconcileAdminUsersJsonToPrisma({
      jsonUsers: [baseUser],
      sourcePasswordsByUserId: new Map([[baseUser.id, "admin123"]]),
      prismaUsers: [baseUser],
      prismaPasswordHashesByUserId: new Map([
        [baseUser.id, hashAdminPassword("different")],
      ]),
    });

    expect(report.safeForCutover).toBe(false);
    expect(report.passwordMismatchCount).toBe(1);
  });
});
