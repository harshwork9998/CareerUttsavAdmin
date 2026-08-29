import { beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import {
  REGISTRATION_INTERACTIVE_IDS,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  createInitialConversationState,
  type SeminarOption,
} from "@/lib/server/whatsapp/registration-conversation";

const resolveDuplicateMock = vi.fn();
const generateQrMock = vi.fn();
const reconcileMock = vi.fn();
const resolveCompletedNumberMock = vi.fn();

vi.mock("@/lib/server/registration-service", () => ({
  resolveStudentRegistrationDuplicate: (...args: unknown[]) =>
    resolveDuplicateMock(...args),
}));

vi.mock("@/lib/email", () => ({
  generateRegistrationQrPngBase64: (...args: unknown[]) => generateQrMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-completed-conversation-reconcile", () => ({
  reconcileCompletedWhatsAppConversation: (...args: unknown[]) =>
    reconcileMock(...args),
  resolveCompletedRegistrationNumberForConversation: (...args: unknown[]) =>
    resolveCompletedNumberMock(...args),
}));

import { processWhatsAppRegistrationConversationTurnAsync } from "@/lib/server/whatsapp/whatsapp-registration-duplicate-flow";

const seminarOptions: SeminarOption[] = [
  { id: "sem-001", title: "AI Careers" },
];

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
  email: "other@example.com",
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

const emailOnlyRegistration = {
  ...existingRegistration,
  id: "reg-email-only",
  email: "aarav@example.com",
  phone: "9000000000",
  registrationNumber: "CU-BLR-2026-00002",
};

function duplicatePayload(registration: typeof existingRegistration) {
  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    studentName: registration.studentName,
    email: registration.email,
    phone: registration.phone,
  };
}

describe("whatsapp registration duplicate flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateQrMock.mockResolvedValue("qr-base64");
    reconcileMock.mockImplementation(async (conversation) => conversation);
    resolveCompletedNumberMock.mockResolvedValue("CU-BLR-2026-00001");
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "none" },
      registration: null,
    });
  });

  it("detects existing WhatsApp mobile before asking for name", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "phone", registration: existingRegistration },
      registration: duplicatePayload(existingRegistration),
    });

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation: null,
      message: { text: "hi" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(resolveDuplicateMock).toHaveBeenCalledWith({
      eventId: CURRENT_EVENT_ID,
      phone: "9876543210",
    });
    expect(result.conversation.currentStep).toBe("COMPLETED");
    expect(result.conversation.completedRegistrationId).toBe("reg-existing");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body === "You're already registered for Career Uttsav."
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body === "Registration Number:\nCU-BLR-2026-00001"
      )
    ).toBe(true);
    expect(
      result.actions.some((action) => action.type === "MEDIA")
    ).toBe(true);
  });

  it("detects email duplicates immediately after email entry", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "email", registration: emailOnlyRegistration },
      registration: duplicatePayload(emailOnlyRegistration),
    });

    let conversation = createInitialConversationState("919876543210");
    conversation = {
      ...conversation,
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
    };

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation,
      message: { text: "aarav@example.com" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(result.conversation.status).toBe("CANCELLED");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("send *Hi*")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("CU-BLR-2026-00002")
      )
    ).toBe(false);
    expect(
      result.actions.some((action) => action.type === "MEDIA")
    ).toBe(false);
  });

  it("resolves same-mobile different-email without suggesting the email was saved", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "phone", registration: existingRegistration },
      registration: duplicatePayload(existingRegistration),
    });

    let conversation = createInitialConversationState("919876543210");
    conversation = {
      ...conversation,
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
    };

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation,
      message: { text: "newemail@example.com" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(result.conversation.status).toBe("COMPLETED");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body ===
            "You're already registered for Career Uttsav with this WhatsApp number."
      )
    ).toBe(true);
  });

  it("handles phone and email conflicts safely at email entry", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "conflict" },
      registration: null,
    });

    let conversation = createInitialConversationState("919876543210");
    conversation = {
      ...conversation,
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
    };

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation,
      message: { text: "aarav@example.com" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(result.conversation.status).toBe("CANCELLED");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("linked to different existing registrations")
      )
    ).toBe(true);
  });

  it("returns existing registration details for completed users without restarting", async () => {
    const completed = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED" as const,
      currentStep: "COMPLETED" as const,
      completedRegistrationId: "reg-existing",
    };

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation: completed,
      message: { text: "hello" },
      seminarOptions,
      waId: "919876543210",
      completedRegistrationNumber: "CU-BLR-2026-00001",
    });

    expect(result.conversation.status).toBe("COMPLETED");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("already registered")
      )
    ).toBe(true);
    expect(
      result.actions.some((action) => action.type === "MEDIA")
    ).toBe(true);
    expect(resolveDuplicateMock).not.toHaveBeenCalled();
  });

  it("shows fresh welcome after admin deletion resets a stale completed conversation", async () => {
    const staleCompleted = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED" as const,
      currentStep: "COMPLETED" as const,
      completedRegistrationId: null,
      studentName: "Old Name",
      email: "old@example.com",
    };
    const freshConversation = createInitialConversationState("919876543210");
    reconcileMock.mockResolvedValueOnce(freshConversation);
    resolveCompletedNumberMock.mockResolvedValueOnce(null);

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation: staleCompleted,
      message: { text: "hi" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(reconcileMock).toHaveBeenCalledWith(staleCompleted);
    expect(result.conversation.currentStep).toBe("AWAITING_START");
    expect(
      result.actions.some(
        (action) =>
          action.type === "BUTTONS" &&
          action.body.includes("Welcome to Career Uttsav")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("already registered")
      )
    ).toBe(false);
    expect(result.actions.some((action) => action.type === "MEDIA")).toBe(false);
  });

  it("does not resend QR after a stale completed conversation is reset", async () => {
    const staleCompleted = {
      ...createInitialConversationState("919876543210"),
      status: "COMPLETED" as const,
      currentStep: "COMPLETED" as const,
      completedRegistrationId: "reg-deleted",
    };
    reconcileMock.mockResolvedValueOnce(
      createInitialConversationState("919876543210")
    );
    resolveCompletedNumberMock.mockResolvedValueOnce(null);

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation: staleCompleted,
      message: { text: "hello" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(generateQrMock).not.toHaveBeenCalled();
    expect(result.actions.some((action) => action.type === "MEDIA")).toBe(false);
  });

  it("continues a valid new registration after email when no duplicate exists", async () => {
    let conversation = createInitialConversationState("919876543210");
    conversation = {
      ...conversation,
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
    };

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation,
      message: { text: "newuser@example.com" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(result.conversation.currentStep).toBe("AWAITING_CLASS");
    expect(result.conversation.email).toBe("newuser@example.com");
  });

  it("does not start registration when Start Registration is tapped for an existing mobile", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "both", registration: existingRegistration },
      registration: duplicatePayload(existingRegistration),
    });

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation: createInitialConversationState("919876543210"),
      message: { interactiveId: REGISTRATION_INTERACTIVE_IDS.START },
      seminarOptions,
      waId: "919876543210",
    });

    expect(result.conversation.currentStep).toBe("COMPLETED");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" && action.body.includes("What is your full name?")
      )
    ).toBe(false);
  });

  it("allows progressing past email for a unique email on a unique mobile", async () => {
    let conversation = createInitialConversationState("919876543210");
    conversation = {
      ...conversation,
      currentStep: "AWAITING_NAME",
    };
    conversation = (
      await processWhatsAppRegistrationConversationTurnAsync({
        conversation,
        message: { text: "Aarav Sharma" },
        seminarOptions,
        waId: "919876543210",
      })
    ).conversation;

    const result = await processWhatsAppRegistrationConversationTurnAsync({
      conversation,
      message: { text: "newuser@example.com" },
      seminarOptions,
      waId: "919876543210",
    });

    expect(resolveDuplicateMock).toHaveBeenLastCalledWith({
      eventId: CURRENT_EVENT_ID,
      phone: "9876543210",
      email: "newuser@example.com",
    });
    expect(result.conversation.currentStep).toBe("AWAITING_CLASS");
  });
});
