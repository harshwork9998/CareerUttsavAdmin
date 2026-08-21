import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/event-service", () => ({
  listEventsForApi: vi.fn(async () => []),
  getEventForApi: vi.fn(async () => null),
}));

vi.mock("@/lib/server/events-persistence", () => ({
  loadEvents: vi.fn(() => [
    {
      id: "evt-001",
      title: "Career Uttsav Bengaluru 2026",
      slug: "career-uttsav-bengaluru-2026",
      description: "Desc",
      status: "Published",
      venue: "Palace Grounds",
      address: "Bellary Road",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560052",
      startDate: "2026-08-15",
      endDate: "2026-08-16",
      startTime: "09:00",
      endTime: "18:00",
      hallCount: 3,
      seminars: [],
      registrationDeadline: "2026-08-10T23:59:59+05:30",
      maxCapacity: 15000,
      registrationCount: 8429,
      checkInCount: 0,
      isFeatured: true,
      tags: [],
      createdBy: "usr-001",
      createdAt: "2025-11-01T10:00:00+05:30",
      updatedAt: "2026-06-20T14:30:00+05:30",
    },
  ]),
  saveEvents: vi.fn((events: unknown[]) => events),
}));

vi.mock("@/lib/server/partners-persistence", () => ({
  loadPartners: vi.fn(() => []),
  savePartners: vi.fn((partners: unknown[]) => partners),
}));

vi.mock("@/lib/server/registrations-persistence", () => ({
  loadRawRegistrations: vi.fn(() => []),
  saveRegistrations: vi.fn((registrations: unknown[]) => registrations),
}));

vi.mock("@/lib/server/seminar-rosters-persistence", () => ({
  loadRawSeminarRosters: vi.fn(() => []),
  saveSeminarRosters: vi.fn((rosters: unknown[]) => rosters),
}));

import { POST } from "@/app/api/events/route";
import {
  DELETE as DELETE_BY_ID,
  PATCH as PATCH_BY_ID,
} from "@/app/api/events/[id]/route";
import { EVENT_ADMIN_UNAVAILABLE_MESSAGE } from "@/lib/server/event-write-guard";
import * as eventsPersistence from "@/lib/server/events-persistence";

describe("event write freeze routes", () => {
  const original = process.env.REGISTRATION_PERSISTENCE;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = original;
    }
  });

  it("allows POST in json mode and persists to JSON", async () => {
    delete process.env.REGISTRATION_PERSISTENCE;

    const response = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Event",
          slug: "test-event",
          description: "Desc",
          status: "Draft",
          venue: "Venue",
          address: "Address",
          city: "Bangalore",
          state: "Karnataka",
          pincode: "560001",
          startDate: "2026-08-15",
          endDate: "2026-08-16",
          hallCount: 1,
          seminars: [],
          registrationDeadline: "2026-08-10T23:59:59+05:30",
          maxCapacity: 100,
          registrationCount: 0,
          checkInCount: 0,
          isFeatured: false,
          tags: [],
          createdBy: "usr-001",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(eventsPersistence.saveEvents).toHaveBeenCalledOnce();
  });

  it("allows PATCH in json mode and persists to JSON", async () => {
    delete process.env.REGISTRATION_PERSISTENCE;

    const response = await PATCH_BY_ID(
      new Request("http://localhost/api/events/evt-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ id: "evt-001" }) }
    );

    expect(response.status).toBe(200);
    expect(eventsPersistence.saveEvents).toHaveBeenCalledOnce();
  });

  it("allows DELETE in json mode and persists to JSON", async () => {
    delete process.env.REGISTRATION_PERSISTENCE;

    const response = await DELETE_BY_ID(
      new Request("http://localhost/api/events/evt-001", { method: "DELETE" }),
      { params: Promise.resolve({ id: "evt-001" }) }
    );

    expect(response.status).toBe(200);
    expect(eventsPersistence.saveEvents).toHaveBeenCalledOnce();
  });

  it("blocks POST in prisma mode without persisting", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";

    const response = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: "Bangalore" }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: EVENT_ADMIN_UNAVAILABLE_MESSAGE,
    });
    expect(eventsPersistence.saveEvents).not.toHaveBeenCalled();
  });

  it("blocks PATCH in prisma mode without persisting", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";

    const response = await PATCH_BY_ID(
      new Request("http://localhost/api/events/evt-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ id: "evt-001" }) }
    );

    expect(response.status).toBe(503);
    expect(eventsPersistence.saveEvents).not.toHaveBeenCalled();
  });

  it("blocks DELETE in prisma mode without persisting", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";

    const response = await DELETE_BY_ID(
      new Request("http://localhost/api/events/evt-001", { method: "DELETE" }),
      { params: Promise.resolve({ id: "evt-001" }) }
    );

    expect(response.status).toBe(503);
    expect(eventsPersistence.saveEvents).not.toHaveBeenCalled();
  });
});
