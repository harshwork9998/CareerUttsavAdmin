import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Registration } from "@/types";

const { checkInPrismaRegistration, isPrismaRegistrationPersistence } = vi.hoisted(
  () => ({
    checkInPrismaRegistration: vi.fn(),
    isPrismaRegistrationPersistence: vi.fn(() => true),
  })
);

vi.mock("@/lib/server/registration-persistence-mode", () => ({
  isPrismaRegistrationPersistence: () => isPrismaRegistrationPersistence(),
}));

vi.mock("@/lib/server/registration-prisma-store", () => ({
  checkInPrismaRegistration: (...args: unknown[]) =>
    checkInPrismaRegistration(...args),
}));

import {
  checkInRegistrationForApi,
  resolveCheckInIdentifiers,
} from "@/lib/server/registration-check-in";

function sampleRegistration(
  overrides: Partial<Registration> = {}
): Registration {
  return {
    id: "reg-abc",
    registrationNumber: "CU-BLR-2026-00042",
    kind: "student",
    eventId: "evt-001",
    eventTitle: "Career Uttsav",
    status: "Confirmed",
    paymentStatus: "Waived",
    registeredAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    studentName: "Aarav Sharma",
    email: "aarav@example.com",
    phone: "9876543210",
    college: "School",
    classLabel: "12",
    city: "Bengaluru",
    seminarInterests: [],
    source: "WEBSITE",
    ...overrides,
  } as Registration;
}

describe("resolveCheckInIdentifiers", () => {
  it("uses trimmed qrPayload as registrationNumber", () => {
    expect(
      resolveCheckInIdentifiers({
        eventId: "evt-001",
        qrPayload: "  CU-BLR-2026-00042 ",
      })
    ).toEqual({
      eventId: "evt-001",
      registrationNumber: "CU-BLR-2026-00042",
    });
  });
});

describe("checkInRegistrationForApi (prisma)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPrismaRegistrationPersistence.mockReturnValue(true);
  });

  it("returns 404 when registration is missing", async () => {
    checkInPrismaRegistration.mockResolvedValue({ outcome: "not_found" });
    const result = await checkInRegistrationForApi({
      eventId: "evt-001",
      qrPayload: "CU-BLR-2026-99999",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
      expect(result.code).toBe("invalid_registration");
    }
  });

  it("rejects event mismatch", async () => {
    checkInPrismaRegistration.mockResolvedValue({
      outcome: "event_mismatch",
      registration: sampleRegistration({ eventId: "evt-002" }),
    });
    const result = await checkInRegistrationForApi({
      eventId: "evt-001",
      qrPayload: "CU-BLR-2026-00042",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("event_mismatch");
      expect(result.status).toBe(409);
    }
  });

  it("transitions Confirmed to Checked In", async () => {
    const checkedIn = sampleRegistration({
      status: "Checked In",
      checkInTime: "2026-04-10T08:30:00.000Z",
    });
    checkInPrismaRegistration.mockResolvedValue({
      outcome: "checked_in",
      registration: checkedIn,
    });
    const result = await checkInRegistrationForApi({
      eventId: "evt-001",
      qrPayload: "CU-BLR-2026-00042",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.alreadyCheckedIn).toBe(false);
      expect(result.data.status).toBe("Checked In");
      expect(result.data.checkInTime).toBeDefined();
    }
  });

  it("returns alreadyCheckedIn on second scan", async () => {
    const checkedIn = sampleRegistration({
      status: "Checked In",
      checkInTime: "2026-04-10T08:30:00.000Z",
    });
    checkInPrismaRegistration.mockResolvedValue({
      outcome: "already_checked_in",
      registration: checkedIn,
    });
    const result = await checkInRegistrationForApi({
      eventId: "evt-001",
      qrPayload: "CU-BLR-2026-00042",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.alreadyCheckedIn).toBe(true);
    }
  });
});
