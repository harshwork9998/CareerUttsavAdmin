import { afterEach, describe, expect, it } from "vitest";

import {
  getRegistrationPersistenceMode,
  isPrismaRegistrationPersistence,
} from "@/lib/server/registration-persistence-mode";

describe("registration persistence mode", () => {
  const original = process.env.REGISTRATION_PERSISTENCE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = original;
    }
  });

  it("defaults to json when unset", () => {
    delete process.env.REGISTRATION_PERSISTENCE;
    expect(getRegistrationPersistenceMode()).toBe("json");
    expect(isPrismaRegistrationPersistence()).toBe(false);
  });

  it("uses prisma only when explicitly set", () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    expect(getRegistrationPersistenceMode()).toBe("prisma");
    expect(isPrismaRegistrationPersistence()).toBe(true);
  });

  it("treats unknown values as json", () => {
    process.env.REGISTRATION_PERSISTENCE = "postgres";
    expect(getRegistrationPersistenceMode()).toBe("json");
  });
});
