import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegistrationStatus as PrismaRegistrationStatus } from "@/lib/generated/prisma/client";

const findUnique = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    registration: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
}));

import { checkInPrismaRegistration } from "@/lib/server/registration-prisma-store";

const baseRecord = {
  id: "reg-1",
  registrationNumber: "CU-BLR-2026-00042",
  kind: "student",
  eventId: "evt-001",
  eventTitle: "Event",
  status: PrismaRegistrationStatus.Confirmed,
  paymentStatus: "Waived",
  registeredAt: new Date("2026-01-01T10:00:00.000Z"),
  updatedAt: new Date("2026-01-01T10:00:00.000Z"),
  amount: null,
  checkInTime: null,
  studentName: "Student",
  email: "s@example.com",
  phone: "9876543210",
  registrationSeminars: [],
};

describe("checkInPrismaRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("performs conditional update from Confirmed", async () => {
    findUnique
      .mockResolvedValueOnce(baseRecord)
      .mockResolvedValueOnce({
        ...baseRecord,
        status: PrismaRegistrationStatus.CheckedIn,
        checkInTime: new Date("2026-04-10T09:00:00.000Z"),
      });
    updateMany.mockResolvedValue({ count: 1 });

    const result = await checkInPrismaRegistration({
      eventId: "evt-001",
      registrationNumber: "CU-BLR-2026-00042",
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "reg-1",
        status: PrismaRegistrationStatus.Confirmed,
      },
      data: expect.objectContaining({
        status: PrismaRegistrationStatus.CheckedIn,
        checkInTime: expect.any(Date),
      }),
    });
    expect(result.outcome).toBe("checked_in");
  });

  it("returns already_checked_in without updateMany when status is Checked In", async () => {
    findUnique.mockResolvedValue({
      ...baseRecord,
      status: PrismaRegistrationStatus.CheckedIn,
      checkInTime: new Date("2026-04-10T08:00:00.000Z"),
    });

    const result = await checkInPrismaRegistration({
      eventId: "evt-001",
      registrationNumber: "CU-BLR-2026-00042",
    });

    expect(updateMany).not.toHaveBeenCalled();
    expect(result.outcome).toBe("already_checked_in");
  });

  it("handles race when updateMany count is zero", async () => {
    findUnique
      .mockResolvedValueOnce(baseRecord)
      .mockResolvedValueOnce({
        ...baseRecord,
        status: PrismaRegistrationStatus.CheckedIn,
        checkInTime: new Date("2026-04-10T08:00:00.000Z"),
      });
    updateMany.mockResolvedValue({ count: 0 });

    const result = await checkInPrismaRegistration({
      eventId: "evt-001",
      registrationNumber: "CU-BLR-2026-00042",
    });

    expect(result.outcome).toBe("already_checked_in");
  });
});
