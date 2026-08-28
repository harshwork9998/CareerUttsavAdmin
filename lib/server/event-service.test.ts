import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/event-prisma-store", () => ({
  listPrismaEvents: vi.fn(),
  getPrismaEventById: vi.fn(),
}));

import { listEventsForApi } from "@/lib/server/event-service";
import * as eventPrismaStore from "@/lib/server/event-prisma-store";
import * as eventsPersistence from "@/lib/server/events-persistence";

describe("event service read mode", () => {
  const originalRegistration = process.env.REGISTRATION_PERSISTENCE;
  const originalEventWrite = process.env.EVENT_WRITE_PERSISTENCE;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalRegistration === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = originalRegistration;
    }
    if (originalEventWrite === undefined) {
      delete process.env.EVENT_WRITE_PERSISTENCE;
    } else {
      process.env.EVENT_WRITE_PERSISTENCE = originalEventWrite;
    }
  });

  it("uses JSON persistence when mode is json", async () => {
    delete process.env.REGISTRATION_PERSISTENCE;
    delete process.env.EVENT_WRITE_PERSISTENCE;
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

  it("uses Prisma reads when event writes use prisma even if registration is json", async () => {
    delete process.env.REGISTRATION_PERSISTENCE;
    process.env.EVENT_WRITE_PERSISTENCE = "prisma";
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
