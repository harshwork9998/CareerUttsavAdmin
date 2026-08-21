import { afterEach, describe, expect, it } from "vitest";

import {
  getPartnerPersistenceMode,
  isPrismaPartnerPersistence,
} from "@/lib/server/partner-persistence-mode";

describe("partner persistence mode", () => {
  const original = process.env.PARTNER_PERSISTENCE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PARTNER_PERSISTENCE;
    } else {
      process.env.PARTNER_PERSISTENCE = original;
    }
  });

  it("defaults to json when unset", () => {
    delete process.env.PARTNER_PERSISTENCE;
    expect(getPartnerPersistenceMode()).toBe("json");
    expect(isPrismaPartnerPersistence()).toBe(false);
  });

  it("uses prisma only when explicitly set", () => {
    process.env.PARTNER_PERSISTENCE = "prisma";
    expect(getPartnerPersistenceMode()).toBe("prisma");
    expect(isPrismaPartnerPersistence()).toBe(true);
  });

  it("treats unknown values as json", () => {
    process.env.PARTNER_PERSISTENCE = "supabase";
    expect(getPartnerPersistenceMode()).toBe("json");
  });
});
