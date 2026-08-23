import { afterEach, describe, expect, it } from "vitest";

import {
  getAdminUserPersistenceMode,
  isPrismaAdminUserPersistence,
} from "@/lib/server/admin-user-persistence-mode";

describe("admin user persistence mode", () => {
  const original = process.env.ADMIN_USER_PERSISTENCE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADMIN_USER_PERSISTENCE;
    } else {
      process.env.ADMIN_USER_PERSISTENCE = original;
    }
  });

  it("defaults to json when unset", () => {
    delete process.env.ADMIN_USER_PERSISTENCE;
    expect(getAdminUserPersistenceMode()).toBe("json");
    expect(isPrismaAdminUserPersistence()).toBe(false);
  });

  it("treats invalid values as json", () => {
    process.env.ADMIN_USER_PERSISTENCE = "invalid";
    expect(getAdminUserPersistenceMode()).toBe("json");
  });

  it("enables prisma mode explicitly", () => {
    process.env.ADMIN_USER_PERSISTENCE = "prisma";
    expect(getAdminUserPersistenceMode()).toBe("prisma");
    expect(isPrismaAdminUserPersistence()).toBe(true);
  });
});
