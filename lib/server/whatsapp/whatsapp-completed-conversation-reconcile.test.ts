import { beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import {
  createInitialConversationState,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";

const getRegistrationMock = vi.fn();
const resolveDuplicateMock = vi.fn();

vi.mock("@/lib/server/registration-service", () => ({
  getRegistrationForApi: (...args: unknown[]) => getRegistrationMock(...args),
  resolveStudentRegistrationDuplicate: (...args: unknown[]) =>
    resolveDuplicateMock(...args),
}));

import {
  reconcileCompletedWhatsAppConversation,
  registrationExistsForConversationLink,
  resolveCompletedRegistrationNumberForConversation,
} from "@/lib/server/whatsapp/whatsapp-completed-conversation-reconcile";

const WA_ID = "919876543210";

const existingRegistration = {
  id: "reg-existing",
  kind: "student" as const,
  registrationNumber: "CU-BLR-2026-00001",
  eventId: CURRENT_EVENT_ID,
  eventTitle: "Career Uttsav",
  status: "Confirmed" as const,
  paymentStatus: "Waived" as const,
  amount: 0,
  registeredAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
  studentName: "Existing",
  email: "existing@example.com",
  phone: "9876543210",
  college: "School",
  classLabel: "Class 10",
  interestedStream: "Science",
  board: "CBSE",
  gender: "Male" as const,
  city: "Bangalore",
  state: "Karnataka",
  seminarInterests: [],
};

const replacementRegistration = {
  ...existingRegistration,
  id: "reg-replacement",
  registrationNumber: "CU-BLR-2026-00099",
  email: "replacement@example.com",
};

function completedConversation(
  overrides: Partial<WhatsAppConversationState> = {}
): WhatsAppConversationState {
  return {
    ...createInitialConversationState(WA_ID),
    status: "COMPLETED",
    currentStep: "COMPLETED",
    completedRegistrationId: "reg-existing",
    studentName: "Existing",
    email: "existing@example.com",
    ...overrides,
  };
}

describe("whatsapp completed conversation reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "none" },
      registration: null,
    });
  });

  it("reports when a linked registration still exists", async () => {
    getRegistrationMock.mockResolvedValue(existingRegistration);
    await expect(
      registrationExistsForConversationLink("reg-existing")
    ).resolves.toBe(true);
  });

  it("reports when a linked registration was deleted", async () => {
    getRegistrationMock.mockResolvedValue(null);
    await expect(
      registrationExistsForConversationLink("reg-deleted")
    ).resolves.toBe(false);
  });

  it("keeps a valid completed conversation unchanged", async () => {
    getRegistrationMock.mockResolvedValue(existingRegistration);
    const conversation = completedConversation();

    const result = await reconcileCompletedWhatsAppConversation(conversation);

    expect(result).toEqual(conversation);
    expect(resolveDuplicateMock).not.toHaveBeenCalled();
  });

  it("resets a stale completed conversation when no registration exists", async () => {
    getRegistrationMock.mockResolvedValue(null);
    const conversation = completedConversation({
      completedRegistrationId: null,
      studentName: "Old Name",
      email: "old@example.com",
    });

    const result = await reconcileCompletedWhatsAppConversation(conversation);

    expect(result.status).toBe("ACTIVE");
    expect(result.currentStep).toBe("AWAITING_START");
    expect(result.completedRegistrationId).toBeNull();
    expect(result.studentName).toBeNull();
    expect(result.email).toBeNull();
    expect(resolveDuplicateMock).toHaveBeenCalledWith({
      eventId: CURRENT_EVENT_ID,
      phone: "9876543210",
    });
  });

  it("heals a stale completed conversation to another same-phone registration", async () => {
    getRegistrationMock.mockResolvedValue(null);
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "phone", registration: replacementRegistration },
      registration: {
        id: replacementRegistration.id,
        registrationNumber: replacementRegistration.registrationNumber,
        studentName: replacementRegistration.studentName,
        email: replacementRegistration.email,
        phone: replacementRegistration.phone,
      },
    });

    const result = await reconcileCompletedWhatsAppConversation(
      completedConversation({ completedRegistrationId: "reg-deleted" })
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.completedRegistrationId).toBe("reg-replacement");
    expect(result.studentName).toBeNull();
  });

  it("returns null registration number when the linked registration is gone", async () => {
    getRegistrationMock.mockResolvedValue(null);
    await expect(
      resolveCompletedRegistrationNumberForConversation(
        completedConversation()
      )
    ).resolves.toBeNull();
  });

  it("returns the registration number for a valid completed conversation", async () => {
    getRegistrationMock.mockResolvedValue(existingRegistration);
    await expect(
      resolveCompletedRegistrationNumberForConversation(
        completedConversation()
      )
    ).resolves.toBe("CU-BLR-2026-00001");
  });
});
