import { describe, expect, it } from "vitest";

import {
  CURRENT_EVENT_CITY,
  CURRENT_EVENT_ID,
  getCurrentEvent,
  getCurrentEvents,
} from "@/lib/current-events";
import type { Event } from "@/types";

function stubEvent(id: string, city: string): Event {
  return {
    id,
    title: `${city} event`,
    slug: id,
    description: "",
    shortDescription: "",
    status: "Published",
    venue: "",
    address: "",
    city,
    state: "Karnataka",
    pincode: "",
    startDate: "2026-01-01",
    endDate: "2026-01-01",
    startTime: "09:00",
    endTime: "18:00",
    hallCount: 1,
    seminars: [],
    registrationDeadline: "2026-01-01T00:00:00+05:30",
    maxCapacity: 1,
    registrationCount: 0,
    checkInCount: 0,
    bannerImage: "",
    isFeatured: false,
    tags: [],
    createdBy: "usr-001",
    createdAt: "2026-01-01T00:00:00+05:30",
    updatedAt: "2026-01-01T00:00:00+05:30",
  };
}

describe("current-events", () => {
  it("exports Bangalore current constants", () => {
    expect(CURRENT_EVENT_ID).toBe("evt-001");
    expect(CURRENT_EVENT_CITY).toBe("Bangalore");
  });

  it("returns only evt-001 and never falls back to Mysore/Hubli", () => {
    const events = [
      stubEvent("evt-002", "Mysore"),
      stubEvent("evt-001", "Bangalore"),
      stubEvent("evt-003", "Hubli"),
    ];
    const current = getCurrentEvents(events);
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe("evt-001");
    expect(getCurrentEvent(events)?.id).toBe("evt-001");
    expect(events).toHaveLength(3);
  });

  it("returns empty when evt-001 is missing", () => {
    const events = [
      stubEvent("evt-002", "Mysore"),
      stubEvent("evt-003", "Hubli"),
    ];
    expect(getCurrentEvents(events)).toEqual([]);
    expect(getCurrentEvent(events)).toBeNull();
  });
});
