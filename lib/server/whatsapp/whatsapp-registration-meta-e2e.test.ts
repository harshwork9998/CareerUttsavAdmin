import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
} from "@/lib/server/whatsapp/registration-options";
import {
  REGISTRATION_INTERACTIVE_IDS,
  boardInteractiveId,
  classInteractiveId,
  genderInteractiveId,
  seminarInteractiveId,
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import {
  processRegistrationConversationTurn,
  type SeminarOption,
  type WhatsAppBotAction,
  type WhatsAppConversationState,
} from "@/lib/server/whatsapp/registration-conversation";
import { dispatchWhatsAppBotActions } from "@/lib/server/whatsapp/whatsapp-bot-dispatcher";
import { setMetaClientFetchForTests } from "@/lib/server/whatsapp/meta-client";

const createStudentRegistrationMock = vi.fn();
const checkDuplicateMock = vi.fn();
const finalizeMock = vi.fn();
const loadConversationMock = vi.fn();
const getSeminarsMock = vi.fn();
const generateQrMock = vi.fn();

vi.mock("@/lib/server/registration-service", () => ({
  createStudentRegistration: (...args: unknown[]) =>
    createStudentRegistrationMock(...args),
  checkStudentRegistrationDuplicate: (...args: unknown[]) =>
    checkDuplicateMock(...args),
  getRegistrationForApi: vi.fn(),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  loadWhatsAppConversationRecordByWaId: (...args: unknown[]) =>
    loadConversationMock(...args),
  finalizeWhatsAppConversationRegistration: (...args: unknown[]) =>
    finalizeMock(...args),
  cancelWhatsAppConversationForEmailDuplicate: vi.fn(),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-seminar-context", () => ({
  getWhatsAppSeminarOptions: (...args: unknown[]) => getSeminarsMock(...args),
}));

vi.mock("@/lib/email", () => ({
  generateRegistrationQrPngBase64: (...args: unknown[]) => generateQrMock(...args),
}));

import { completeWhatsAppRegistrationForConversation } from "@/lib/server/whatsapp/whatsapp-registration-completion";

const WA_ID = "919876543210";
const QR_BASE64 = Buffer.from("same-qr-png-bytes").toString("base64");
const REGISTRATION_NUMBER = "CU-BLR-2026-00042";

const seminarOptions: SeminarOption[] = [
  { id: "sem-001", title: "AI Careers" },
  { id: "sem-002", title: "Design Thinking" },
  { id: "sem-003", title: "Startup Skills" },
];

function mockJsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function turn(
  conversation: WhatsAppConversationState | null,
  message: { text?: string; interactiveId?: string }
) {
  return processRegistrationConversationTurn({
    conversation,
    message,
    seminarOptions,
    waId: WA_ID,
  });
}

const createdRegistration = {
  id: "reg-001",
  kind: "student" as const,
  registrationNumber: REGISTRATION_NUMBER,
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
  classLabel: REGISTRATION_CLASS_OPTIONS[1]!,
  interestedStream: REGISTRATION_STREAM_OPTIONS[0]!,
  board: REGISTRATION_BOARD_OPTIONS[0]!,
  gender: "Male" as const,
  city: "Bangalore",
  state: "Karnataka",
  seminarInterests: ["AI Careers"],
};

describe("whatsapp registration meta e2e (mocked)", () => {
  const originalEnv = { ...process.env };
  const outboundTypes: string[] = [];

  beforeEach(() => {
    outboundTypes.length = 0;
    vi.clearAllMocks();

    process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token-local-only";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789012345";
    process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";

    getSeminarsMock.mockResolvedValue(seminarOptions);
    checkDuplicateMock.mockResolvedValue({ duplicate: false });
    createStudentRegistrationMock.mockResolvedValue({
      ok: true,
      registration: createdRegistration,
    });
    generateQrMock.mockResolvedValue(QR_BASE64);
    finalizeMock.mockImplementation(async () => ({
      waId: WA_ID,
      status: "COMPLETED" as const,
      currentStep: "COMPLETED" as const,
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: REGISTRATION_CLASS_OPTIONS[1]!,
      gender: "Male" as const,
      board: REGISTRATION_BOARD_OPTIONS[0]!,
      interestedStream: REGISTRATION_STREAM_OPTIONS[0]!,
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: "reg-001",
    }));

    setMetaClientFetchForTests(
      vi.fn(async (url, init) => {
        if (String(url).endsWith("/media")) {
          outboundTypes.push("MEDIA_UPLOAD");
          return mockJsonResponse(200, { id: "media-qr-001" });
        }
        const body = JSON.parse(String(init?.body));
        outboundTypes.push(body.type);
        expect(body.to).toBe(WA_ID);
        expect(body.to).not.toBe(createdRegistration.phone);
        return mockJsonResponse(200, {
          messages: [{ id: `wamid.${outboundTypes.length}` }],
        });
      }) as typeof fetch
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setMetaClientFetchForTests(null);
    vi.restoreAllMocks();
  });

  it("walks the full registration journey and dispatches Meta actions in order", async () => {
    const dispatchedActions: WhatsAppBotAction[] = [];
    let conversation: WhatsAppConversationState | null = null;

    const steps: Array<{ text?: string; interactiveId?: string }> = [
      { text: "hi" },
      { interactiveId: REGISTRATION_INTERACTIVE_IDS.START },
      { text: "Aarav Sharma" },
      { text: "aarav@example.com" },
      { interactiveId: classInteractiveId(REGISTRATION_CLASS_OPTIONS[1]!) },
      { interactiveId: genderInteractiveId("Male") },
      { interactiveId: boardInteractiveId(REGISTRATION_BOARD_OPTIONS[0]!) },
      {
        interactiveId: streamInteractiveId(REGISTRATION_STREAM_OPTIONS[0]!),
      },
      { text: "National Public School" },
      { text: "Bangalore" },
      { interactiveId: seminarInteractiveId("sem-001") },
      { interactiveId: seminarInteractiveId("sem-002") },
      { interactiveId: seminarInteractiveId("sem-003") },
    ];

    for (const message of steps) {
      const result = turn(conversation, message);
      conversation = result.conversation;
      dispatchedActions.push(...result.actions);
      await dispatchWhatsAppBotActions(WA_ID, result.actions);
    }

    loadConversationMock.mockResolvedValue(conversation);
    const completion = await completeWhatsAppRegistrationForConversation(WA_ID);
    await dispatchWhatsAppBotActions(WA_ID, completion.actions);

    expect(conversation?.currentStep).toBe("READY_TO_REGISTER");
    expect(
      dispatchedActions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.toLowerCase().includes("review")
      )
    ).toBe(false);
    expect(createStudentRegistrationMock).toHaveBeenCalledOnce();
    expect(createStudentRegistrationMock.mock.calls[0]?.[1]).toEqual({
      requirePhoneVerification: false,
    });
    expect(generateQrMock).toHaveBeenCalledWith(REGISTRATION_NUMBER);
    expect(completion.status).toBe("SUCCESS");
    expect(completion.registrationNumber).toBe(REGISTRATION_NUMBER);
    expect(
      completion.actions[0].type === "TEXT" &&
        completion.actions[0].body.includes(REGISTRATION_NUMBER)
    ).toBe(true);
    expect(
      completion.actions[1].type === "MEDIA" &&
        completion.actions[1].contentBase64 === QR_BASE64
    ).toBe(true);
    expect(completion.conversation?.status).toBe("COMPLETED");
    expect(completion.conversation?.completedRegistrationId).toBe("reg-001");
    expect(outboundTypes).toContain("interactive");
    expect(outboundTypes).toContain("text");
    expect(outboundTypes.at(-3)).toBe("text");
    expect(outboundTypes.at(-2)).toBe("MEDIA_UPLOAD");
    expect(outboundTypes.at(-1)).toBe("image");
    expect(outboundTypes.filter((type) => type === "MEDIA_UPLOAD")).toHaveLength(
      1
    );
  });
});

describe("whatsapp registration completion delivery failures (mocked)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token-local-only";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789012345";
    process.env.WHATSAPP_GRAPH_API_VERSION = "v22.0";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setMetaClientFetchForTests(null);
    vi.restoreAllMocks();
  });

  it("does not create another registration when WhatsApp success text fails", async () => {
    const readyConversation = {
      waId: WA_ID,
      status: "READY_TO_REGISTER" as const,
      currentStep: "READY_TO_REGISTER" as const,
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: REGISTRATION_CLASS_OPTIONS[1]!,
      gender: "Male" as const,
      board: REGISTRATION_BOARD_OPTIONS[0]!,
      interestedStream: REGISTRATION_STREAM_OPTIONS[0]!,
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: null,
    };
    const completedConversation = {
      ...readyConversation,
      status: "COMPLETED" as const,
      currentStep: "COMPLETED" as const,
      completedRegistrationId: "reg-001",
    };

    getSeminarsMock.mockResolvedValue(seminarOptions);
    checkDuplicateMock.mockResolvedValue({ duplicate: false });
    createStudentRegistrationMock.mockResolvedValue({
      ok: true,
      registration: createdRegistration,
    });
    generateQrMock.mockResolvedValue(QR_BASE64);
    finalizeMock.mockResolvedValue(completedConversation);
    loadConversationMock
      .mockResolvedValueOnce(readyConversation)
      .mockResolvedValueOnce(completedConversation);

    setMetaClientFetchForTests(
      vi.fn(async () =>
        mockJsonResponse(500, {
          error: { message: "temporary failure", code: 2 },
        })
      ) as typeof fetch
    );

    const completion = await completeWhatsAppRegistrationForConversation(WA_ID);
    await dispatchWhatsAppBotActions(WA_ID, completion.actions);
    const retry = await completeWhatsAppRegistrationForConversation(WA_ID);

    expect(createStudentRegistrationMock).toHaveBeenCalledOnce();
    expect(completion.status).toBe("SUCCESS");
    expect(retry.status).toBe("ALREADY_COMPLETED");
  });

  it("does not create another registration when QR upload fails", async () => {
    getSeminarsMock.mockResolvedValue(seminarOptions);
    checkDuplicateMock.mockResolvedValue({ duplicate: false });
    createStudentRegistrationMock.mockResolvedValue({
      ok: true,
      registration: createdRegistration,
    });
    generateQrMock.mockResolvedValue(QR_BASE64);
    finalizeMock.mockResolvedValue({
      waId: WA_ID,
      status: "COMPLETED",
      currentStep: "COMPLETED",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: REGISTRATION_CLASS_OPTIONS[1]!,
      gender: "Male",
      board: REGISTRATION_BOARD_OPTIONS[0]!,
      interestedStream: REGISTRATION_STREAM_OPTIONS[0]!,
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: "reg-001",
    });
    loadConversationMock.mockResolvedValue({
      waId: WA_ID,
      status: "READY_TO_REGISTER",
      currentStep: "READY_TO_REGISTER",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: REGISTRATION_CLASS_OPTIONS[1]!,
      gender: "Male",
      board: REGISTRATION_BOARD_OPTIONS[0]!,
      interestedStream: REGISTRATION_STREAM_OPTIONS[0]!,
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: null,
    });

    setMetaClientFetchForTests(
      vi.fn(async (url) => {
        if (String(url).endsWith("/media")) {
          return mockJsonResponse(500, {
            error: { message: "upload failed", code: 2 },
          });
        }
        return mockJsonResponse(200, {
          messages: [{ id: "wamid.text" }],
        });
      }) as typeof fetch
    );

    const completion = await completeWhatsAppRegistrationForConversation(WA_ID);
    const summary = await dispatchWhatsAppBotActions(WA_ID, completion.actions);

    expect(createStudentRegistrationMock).toHaveBeenCalledOnce();
    expect(summary.results[0].success).toBe(true);
    expect(summary.results[1].success).toBe(false);
  });

  it("keeps a completed conversation completed after delivery failure", async () => {
    const completedConversation: WhatsAppConversationState = {
      waId: WA_ID,
      status: "COMPLETED",
      currentStep: "COMPLETED",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: "CBSE",
      interestedStream: "Science",
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: "reg-001",
    };

    loadConversationMock.mockResolvedValue(completedConversation);

    setMetaClientFetchForTests(
      vi.fn(async () =>
        mockJsonResponse(500, {
          error: { message: "temporary failure", code: 2 },
        })
      ) as typeof fetch
    );

    const completion = await completeWhatsAppRegistrationForConversation(WA_ID);
    await dispatchWhatsAppBotActions(WA_ID, completion.actions);

    expect(completion.status).toBe("ALREADY_COMPLETED");
    expect(completedConversation.status).toBe("COMPLETED");
    expect(completedConversation.completedRegistrationId).toBe("reg-001");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });
});
