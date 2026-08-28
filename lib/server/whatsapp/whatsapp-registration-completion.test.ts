import { beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";

const createStudentRegistrationMock = vi.fn();
const checkDuplicateMock = vi.fn();
const getRegistrationMock = vi.fn();
const finalizeMock = vi.fn();
const cancelMock = vi.fn();
const loadConversationMock = vi.fn();
const getSeminarsMock = vi.fn();
const generateQrMock = vi.fn();

vi.mock("@/lib/server/registration-service", () => ({
  createStudentRegistration: (...args: unknown[]) =>
    createStudentRegistrationMock(...args),
  checkStudentRegistrationDuplicate: (...args: unknown[]) =>
    checkDuplicateMock(...args),
  getRegistrationForApi: (...args: unknown[]) => getRegistrationMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  loadWhatsAppConversationRecordByWaId: (...args: unknown[]) =>
    loadConversationMock(...args),
  finalizeWhatsAppConversationRegistration: (...args: unknown[]) =>
    finalizeMock(...args),
  cancelWhatsAppConversationForEmailDuplicate: (...args: unknown[]) =>
    cancelMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-seminar-context", () => ({
  getWhatsAppSeminarOptions: (...args: unknown[]) => getSeminarsMock(...args),
}));

vi.mock("@/lib/email", () => ({
  generateRegistrationQrPngBase64: (...args: unknown[]) => generateQrMock(...args),
}));

import {
  completeWhatsAppRegistrationForConversation,
  duplicateAllowsRegistrationNumberReveal,
  resolveSeminarTitlesFromIds,
} from "@/lib/server/whatsapp/whatsapp-registration-completion";

const readyConversation: WhatsAppConversationState = {
  waId: "919876543210",
  status: "READY_TO_REGISTER",
  currentStep: "READY_TO_REGISTER",
  studentName: "Aarav Sharma",
  email: "aarav@example.com",
  classLabel: "Class 10",
  gender: "Male",
  board: "CBSE",
  interestedStream: "Science",
  college: "National Public School",
  city: "Bangalore",
  selectedSeminarIds: ["sem-001"],
  completedRegistrationId: null,
};

const seminarOptions = [
  { id: "sem-001", title: "AI Careers" },
  { id: "sem-002", title: "Design Thinking" },
];

const createdRegistration = {
  id: "reg-001",
  kind: "student" as const,
  registrationNumber: "CU-BLR-2026-00042",
  eventId: CURRENT_EVENT_ID,
  eventTitle: "Career Uttsav Bangalore 2026",
  status: "Confirmed" as const,
  paymentStatus: "Waived" as const,
  amount: 0,
  registeredAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
  studentName: "Aarav Sharma",
  email: "aarav@example.com",
  phone: "9876543210",
  college: "National Public School",
  classLabel: "Class 10",
  interestedStream: "Science",
  board: "CBSE",
  gender: "Male" as const,
  city: "Bangalore",
  state: "Karnataka",
  seminarInterests: ["AI Careers"],
};

const existingSameMobileRegistration = {
  id: "reg-existing",
  kind: "student" as const,
  registrationNumber: "CU-BLR-2026-00001",
  studentName: "Existing",
  email: "other@example.com",
  phone: "9876543210",
  eventId: CURRENT_EVENT_ID,
  eventTitle: "Career Uttsav",
  status: "Confirmed" as const,
  paymentStatus: "Waived" as const,
  amount: 0,
  registeredAt: "2026-08-23T10:00:00.000Z",
  updatedAt: "2026-08-23T10:00:00.000Z",
  college: "School",
  classLabel: "Class 10",
  interestedStream: "Science",
  board: "CBSE",
  gender: "Male" as const,
  city: "Bangalore",
  state: "Karnataka",
};

const existingEmailOnlyRegistration = {
  ...existingSameMobileRegistration,
  id: "reg-email-only",
  email: "aarav@example.com",
  phone: "9000000000",
};

function mockHealedConversation(registrationId: string) {
  return {
    ...readyConversation,
    status: "COMPLETED" as const,
    currentStep: "COMPLETED" as const,
    completedRegistrationId: registrationId,
  };
}

describe("whatsapp registration completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadConversationMock.mockResolvedValue(readyConversation);
    getSeminarsMock.mockResolvedValue(seminarOptions);
    checkDuplicateMock.mockResolvedValue({
      duplicate: false,
      message: null,
      registration: null,
    });
    createStudentRegistrationMock.mockResolvedValue({
      ok: true,
      registration: createdRegistration,
    });
    finalizeMock.mockResolvedValue(mockHealedConversation("reg-001"));
    cancelMock.mockResolvedValue({
      ...readyConversation,
      status: "CANCELLED",
      currentStep: "CANCELLED",
      completedRegistrationId: null,
    });
    generateQrMock.mockResolvedValue("qr-base64");
    getRegistrationMock.mockResolvedValue(createdRegistration);
  });

  it("creates one student registration for a READY_TO_REGISTER conversation", async () => {
    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("SUCCESS");
    expect(createStudentRegistrationMock).toHaveBeenCalledOnce();
    expect(finalizeMock).toHaveBeenCalledWith({
      waId: "919876543210",
      registrationId: "reg-001",
    });
  });

  it("heals same-mobile duplicate into COMPLETED with completedRegistrationId", async () => {
    checkDuplicateMock.mockResolvedValue({
      duplicate: true,
      message: "duplicate",
      registration: existingSameMobileRegistration,
    });
    finalizeMock.mockResolvedValue(mockHealedConversation("reg-existing"));

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(finalizeMock).toHaveBeenCalledWith({
      waId: "919876543210",
      registrationId: "reg-existing",
    });
    expect(result.conversation?.status).toBe("COMPLETED");
    expect(result.conversation?.completedRegistrationId).toBe("reg-existing");
    expect(result.registrationNumber).toBe("CU-BLR-2026-00001");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });

  it("recovers when registration was committed but finalize previously failed", async () => {
    checkDuplicateMock
      .mockResolvedValueOnce({
        duplicate: false,
        message: null,
        registration: null,
      })
      .mockResolvedValueOnce({
        duplicate: true,
        message: "duplicate",
        registration: createdRegistration,
      });
    createStudentRegistrationMock.mockResolvedValue({
      ok: false,
      error: { status: 409, body: { duplicate: true } },
    });
    finalizeMock.mockResolvedValue(mockHealedConversation("reg-001"));

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(finalizeMock).toHaveBeenCalledWith({
      waId: "919876543210",
      registrationId: "reg-001",
    });
    expect(createStudentRegistrationMock).toHaveBeenCalledOnce();
  });

  it("links Website/Admin registration with same WhatsApp mobile safely", async () => {
    checkDuplicateMock.mockResolvedValue({
      duplicate: true,
      message: "duplicate",
      registration: existingSameMobileRegistration,
    });
    finalizeMock.mockResolvedValue(mockHealedConversation("reg-existing"));

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(result.conversation?.completedRegistrationId).toBe("reg-existing");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });

  it("cancels email-only duplicate without exposing registration number", async () => {
    checkDuplicateMock.mockResolvedValue({
      duplicate: true,
      message: "duplicate",
      registration: existingEmailOnlyRegistration,
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("ALREADY_REGISTERED");
    expect(cancelMock).toHaveBeenCalledWith("919876543210");
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(result.conversation?.status).toBe("CANCELLED");
    expect(result.conversation?.completedRegistrationId).toBeNull();
    expect(result.registrationNumber).toBeUndefined();
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("privacy")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("CU-BLR-2026-00001")
      )
    ).toBe(false);
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });

  it("heals finalize failure after successful registration commit", async () => {
    finalizeMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockHealedConversation("reg-001"));

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(finalizeMock).toHaveBeenCalledTimes(2);
    expect(result.conversation?.completedRegistrationId).toBe("reg-001");
  });

  it("is idempotent when completedRegistrationId already exists", async () => {
    loadConversationMock.mockResolvedValue({
      ...readyConversation,
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedRegistrationId: "reg-001",
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");
    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(result.registrationNumber).toBe("CU-BLR-2026-00042");
  });

  it("leaves conversation recoverable when registration creation fails", async () => {
    createStudentRegistrationMock.mockResolvedValue({
      ok: false,
      error: { status: 500, body: { error: "db down" } },
    });
    const result = await completeWhatsAppRegistrationForConversation("919876543210");
    expect(result.status).toBe("FAILED");
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(result.conversation?.status).toBe("READY_TO_REGISTER");
  });
});

describe("resolveSeminarTitlesFromIds", () => {
  it("maps seminar ids to titles and rejects foreign ids", () => {
    expect(
      resolveSeminarTitlesFromIds(["sem-001", "sem-002"], seminarOptions)
    ).toEqual({ ok: true, titles: ["AI Careers", "Design Thinking"] });
    expect(
      resolveSeminarTitlesFromIds(["sem-foreign"], seminarOptions).ok
    ).toBe(false);
  });

  it("accepts more than three seminar ids for WhatsApp completion", () => {
    const extendedSeminars = [
      ...seminarOptions,
      { id: "sem-003", title: "Startup Skills" },
      { id: "sem-004", title: "Entrepreneurship" },
    ];
    expect(
      resolveSeminarTitlesFromIds(
        ["sem-001", "sem-002", "sem-003", "sem-004"],
        extendedSeminars
      )
    ).toEqual({
      ok: true,
      titles: ["AI Careers", "Design Thinking", "Startup Skills", "Entrepreneurship"],
    });
  });
});

describe("duplicateAllowsRegistrationNumberReveal", () => {
  it("reveals only when duplicate mobile matches", () => {
    expect(
      duplicateAllowsRegistrationNumberReveal(
        createdRegistration,
        "9876543210"
      )
    ).toBe(true);
    expect(
      duplicateAllowsRegistrationNumberReveal(
        createdRegistration,
        "9000000000"
      )
    ).toBe(false);
  });
});
