import { afterEach, describe, expect, it } from "vitest";

import {
  getSeminarRosterPersistenceMode,
  isPrismaSeminarRosterPersistence,
} from "@/lib/server/seminar-roster-persistence-mode";

describe("seminar roster persistence mode", () => {
  const original = process.env.SEMINAR_ROSTER_PERSISTENCE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SEMINAR_ROSTER_PERSISTENCE;
    } else {
      process.env.SEMINAR_ROSTER_PERSISTENCE = original;
    }
  });

  it("defaults to json when unset", () => {
    delete process.env.SEMINAR_ROSTER_PERSISTENCE;
    expect(getSeminarRosterPersistenceMode()).toBe("json");
    expect(isPrismaSeminarRosterPersistence()).toBe(false);
  });

  it("treats unknown values as json", () => {
    process.env.SEMINAR_ROSTER_PERSISTENCE = "supabase";
    expect(getSeminarRosterPersistenceMode()).toBe("json");
    expect(isPrismaSeminarRosterPersistence()).toBe(false);
  });

  it("uses prisma only when explicitly set", () => {
    process.env.SEMINAR_ROSTER_PERSISTENCE = "prisma";
    expect(getSeminarRosterPersistenceMode()).toBe("prisma");
    expect(isPrismaSeminarRosterPersistence()).toBe(true);
  });
});
