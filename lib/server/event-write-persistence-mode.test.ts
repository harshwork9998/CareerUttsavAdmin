import { afterEach, describe, expect, it } from "vitest";

import {
  getEventWritePersistenceMode,
  isPrismaEventWritePersistence,
} from "@/lib/server/event-write-persistence-mode";

describe("event write persistence mode", () => {
  const original = process.env.EVENT_WRITE_PERSISTENCE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EVENT_WRITE_PERSISTENCE;
    } else {
      process.env.EVENT_WRITE_PERSISTENCE = original;
    }
  });

  it("defaults to json when unset", () => {
    delete process.env.EVENT_WRITE_PERSISTENCE;
    expect(getEventWritePersistenceMode()).toBe("json");
    expect(isPrismaEventWritePersistence()).toBe(false);
  });

  it("treats unknown values as json", () => {
    process.env.EVENT_WRITE_PERSISTENCE = "supabase";
    expect(getEventWritePersistenceMode()).toBe("json");
    expect(isPrismaEventWritePersistence()).toBe(false);
  });

  it("uses prisma only when explicitly set", () => {
    process.env.EVENT_WRITE_PERSISTENCE = "prisma";
    expect(getEventWritePersistenceMode()).toBe("prisma");
    expect(isPrismaEventWritePersistence()).toBe(true);
  });
});
