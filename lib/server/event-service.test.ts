import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/event-prisma-store", () => ({
  listPrismaEvents: vi.fn(),
  getPrismaEventById: vi.fn(),
}));

import { listEventsForApi } from "@/lib/server/event-service";
import * as eventPrismaStore from "@/lib/server/event-prisma-store";
import * as eventsPersistence from "@/lib/server/events-persistence";

describe("event service read mode", () => {
  const original = process.env.REGISTRATION_PERSISTENCE;

  afterEach(() => {
    vi.restoreAllMocks();
    if (original === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = original;
    }
  });

  it("uses JSON persistence when mode is json", async () => {
    delete process.env.REGISTRATION_PERSISTENCE;
    const jsonEvents = [{ id: "evt-json" }] as Awaited<
      ReturnType<typeof eventsPersistence.loadEvents>
    >;
    const loadEvents = vi
      .spyOn(eventsPersistence, "loadEvents")
      .mockReturnValue(jsonEvents);
    const listPrismaEvents = vi.mocked(eventPrismaStore.listPrismaEvents);

    await expect(listEventsForApi()).resolves.toBe(jsonEvents);
    expect(loadEvents).toHaveBeenCalledOnce();
    expect(listPrismaEvents).not.toHaveBeenCalled();
  });

  it("uses Prisma reads when mode is prisma", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    const prismaEvents = [{ id: "evt-prisma" }] as Awaited<
      ReturnType<typeof eventPrismaStore.listPrismaEvents>
    >;
    const listPrismaEvents = vi
      .mocked(eventPrismaStore.listPrismaEvents)
      .mockResolvedValue(prismaEvents);
    const loadEvents = vi.spyOn(eventsPersistence, "loadEvents");

    await expect(listEventsForApi()).resolves.toBe(prismaEvents);
    expect(listPrismaEvents).toHaveBeenCalledOnce();
    expect(loadEvents).not.toHaveBeenCalled();
  });
});
