import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Event } from "@/types";

vi.mock("@/lib/server/event-prisma-store", () => ({
  listPrismaEvents: vi.fn(async () => []),
}));

vi.mock("@/lib/server/events-persistence", () => ({
  loadEvents: vi.fn(() => []),
  saveEvents: vi.fn((events: Event[]) => events),
}));

vi.mock("@/lib/server/event-prisma-write-store", () => ({
  createPrismaEventForApi: vi.fn(),
  patchPrismaEventForApi: vi.fn(),
  deletePrismaEventForApi: vi.fn(),
}));

vi.mock("@/lib/server/partner-service", () => ({
  prunePartnersForEventCatalog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/server/seminar-roster-service", () => ({
  pruneSeminarRostersForEventCatalog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/server/registrations-persistence", () => ({
  loadRawRegistrations: vi.fn(() => []),
  saveRegistrations: vi.fn((rows: unknown[]) => rows),
}));

import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import {
  createPrismaEventForApi,
  deletePrismaEventForApi,
  patchPrismaEventForApi,
} from "@/lib/server/event-prisma-write-store";
import {
  createEventForApi,
  deleteEventForApi,
  patchEventForApi,
} from "@/lib/server/event-write-service";
import { pruneSeminarRostersForEventCatalog } from "@/lib/server/seminar-roster-service";

const sampleEvent: Event = {
  id: "evt-001",
  title: "Event",
  slug: "event",
  description: "Desc",
  status: "Draft",
  venue: "Venue",
  address: "Address",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
  startDate: "2026-08-15",
  endDate: "2026-08-16",
  startTime: "09:00",
  endTime: "18:00",
  hallCount: 1,
  seminars: [],
  registrationDeadline: "2026-08-10T23:59:59+05:30",
  maxCapacity: 100,
  registrationCount: 0,
  checkInCount: 0,
  isFeatured: false,
  tags: [],
  createdBy: "usr-001",
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
};

describe("event write service routing", () => {
  const original = process.env.EVENT_WRITE_PERSISTENCE;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadEvents).mockReturnValue([sampleEvent]);
    vi.mocked(createPrismaEventForApi).mockResolvedValue(sampleEvent);
    vi.mocked(patchPrismaEventForApi).mockResolvedValue(sampleEvent);
    vi.mocked(deletePrismaEventForApi).mockResolvedValue([]);
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EVENT_WRITE_PERSISTENCE;
    } else {
      process.env.EVENT_WRITE_PERSISTENCE = original;
    }
  });

  it("uses JSON backend by default", async () => {
    delete process.env.EVENT_WRITE_PERSISTENCE;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } =
      sampleEvent;
    const result = await createEventForApi(input);
    expect(result.ok).toBe(true);
    expect(saveEvents).toHaveBeenCalled();
    expect(createPrismaEventForApi).not.toHaveBeenCalled();
  });

  it("uses Prisma backend when event write persistence is prisma", async () => {
    process.env.EVENT_WRITE_PERSISTENCE = "prisma";
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } =
      sampleEvent;
    await createEventForApi(input);
    expect(createPrismaEventForApi).toHaveBeenCalledOnce();
    expect(saveEvents).not.toHaveBeenCalled();
  });

  it("does not call JSON persistence on Prisma patch", async () => {
    process.env.EVENT_WRITE_PERSISTENCE = "prisma";
    await patchEventForApi("evt-001", { title: "Updated" });
    expect(patchPrismaEventForApi).toHaveBeenCalledOnce();
    expect(saveEvents).not.toHaveBeenCalled();
    expect(pruneSeminarRostersForEventCatalog).not.toHaveBeenCalled();
  });

  it("prunes JSON rosters after JSON patch", async () => {
    delete process.env.EVENT_WRITE_PERSISTENCE;
    await patchEventForApi("evt-001", { title: "Updated" });
    expect(pruneSeminarRostersForEventCatalog).toHaveBeenCalledOnce();
  });
});
