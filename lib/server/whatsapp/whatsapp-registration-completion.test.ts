import { beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { __setRegistrationAttemptStoreForTests } from "@/lib/server/registration-attempt-store";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";

const createStudentRegistrationMock = vi.fn();
const resolveDuplicateMock = vi.fn();
const getRegistrationMock = vi.fn();
const finalizeMock = vi.fn();
const linkMock = vi.fn();
const cancelMock = vi.fn();
const loadConversationMock = vi.fn();
const getSeminarsMock = vi.fn();
const getCatalogMock = vi.fn();
const generateQrMock = vi.fn();
const generatePassMock = vi.fn();

vi.mock("@/lib/server/registration-service", () => ({
  createStudentRegistration: (...args: unknown[]) =>
    createStudentRegistrationMock(...args),
  resolveStudentRegistrationDuplicate: (...args: unknown[]) =>
    resolveDuplicateMock(...args),
  getRegistrationForApi: (...args: unknown[]) => getRegistrationMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  loadWhatsAppConversationRecordByWaId: (...args: unknown[]) =>
    loadConversationMock(...args),
  finalizeWhatsAppConversationRegistration: (...args: unknown[]) =>
    finalizeMock(...args),
  linkWhatsAppConversationToRegistration: (...args: unknown[]) =>
    linkMock(...args),
  cancelWhatsAppConversationForEmailDuplicate: (...args: unknown[]) =>
    cancelMock(...args),
}));

const reconcileMock = vi.fn();
const scheduleGrowthMock = vi.fn();

vi.mock("@/lib/server/whatsapp/whatsapp-post-registration-schedule", () => ({
  schedulePostRegistrationGrowthTriggers: (...args: unknown[]) =>
    scheduleGrowthMock(...args),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-completed-conversation-reconcile", () => ({
  reconcileCompletedWhatsAppConversation: (...args: unknown[]) =>
    reconcileMock(...args),
}));

const getEventArtworkSeminarsMock = vi.fn();

vi.mock("@/lib/server/whatsapp/whatsapp-seminar-context", () => ({
  getWhatsAppSeminarOptions: (...args: unknown[]) => getSeminarsMock(...args),
  getWhatsAppEventArtworkSeminarOptions: (...args: unknown[]) =>
    getEventArtworkSeminarsMock(...args),
  getWhatsAppSeminarDayCatalog: (...args: unknown[]) => getCatalogMock(...args),
}));

vi.mock("@/lib/server/event-service", () => ({
  getEventForApi: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  generateRegistrationQrPngBase64: (...args: unknown[]) => generateQrMock(...args),
}));

vi.mock("@/lib/server/whatsapp/event-pass", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/whatsapp/event-pass")
  >("@/lib/server/whatsapp/event-pass");
  return {
    ...actual,
    generateWhatsAppEntryPassPngBase64: (...args: unknown[]) =>
      generatePassMock(...args),
  };
});

import { CAREER_UTTSAV_SEMINARS } from "@/features/dashboard/seminars";
import { mockEvents } from "@/lib/mock-data/events";
import { getEventForApi } from "@/lib/server/event-service";
import { getRegistrationSeminarOptions } from "@/lib/server/registration-seminar-options";
import {
  completeWhatsAppRegistrationForConversation,
  duplicateAllowsRegistrationNumberReveal,
  resolveSeminarTitlesFromIds,
} from "@/lib/server/whatsapp/whatsapp-registration-completion";
import {
  buildTestSeminarDayCatalog,
  buildTestSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-seminar-test-fixtures";
import { buildWhatsAppSeminarDayCatalog } from "@/lib/server/whatsapp/whatsapp-seminar-day-catalog";

const getEventForApiMock = vi.mocked(getEventForApi);

async function catalogOptionsForPartialEvent() {
  const event = mockEvents[0]!;
  getEventForApiMock.mockResolvedValue({
    ...event,
    seminars: [event.seminars[0]!],
  });
  return getRegistrationSeminarOptions();
}

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
  selectedSeminarIds: ["sem-2026-01"],
  completedRegistrationId: null,
};

const seminarOptions = buildTestSeminarOptions();
const seminarDayCatalog = buildTestSeminarDayCatalog(seminarOptions);

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
  seminarInterests: [CAREER_UTTSAV_SEMINARS[0]],
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

function mockNoDuplicateResolution() {
  return {
    resolution: { outcome: "none" as const },
    registration: null,
  };
}

describe("whatsapp registration completion", () => {
  beforeEach(() => {
    __setRegistrationAttemptStoreForTests([]);
    vi.clearAllMocks();
    loadConversationMock.mockResolvedValue(readyConversation);
    getSeminarsMock.mockResolvedValue(seminarOptions);
    getEventArtworkSeminarsMock.mockResolvedValue(seminarOptions);
    getCatalogMock.mockResolvedValue(seminarDayCatalog);
    resolveDuplicateMock.mockResolvedValue(mockNoDuplicateResolution());
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
    generatePassMock.mockResolvedValue("pass-base64");
    getRegistrationMock.mockResolvedValue(createdRegistration);
    reconcileMock.mockImplementation(async (conversation) => conversation);
  });

  it("creates one student registration for a READY_TO_REGISTER conversation", async () => {
    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("SUCCESS");
    expect(createStudentRegistrationMock).toHaveBeenCalledOnce();
    expect(finalizeMock).toHaveBeenCalledWith({
      waId: "919876543210",
      registrationId: "reg-001",
    });
    expect(scheduleGrowthMock).toHaveBeenCalledOnce();
    expect(scheduleGrowthMock.mock.calls[0]?.[0]).toMatchObject({
      waId: "919876543210",
      registrationId: "reg-001",
    });
    expect(generatePassMock).toHaveBeenCalledWith({
      registrationId: "CU-BLR-2026-00042",
      seminarTitles: [CAREER_UTTSAV_SEMINARS[0]],
    });
    expect(generateQrMock).not.toHaveBeenCalled();
    const media = result.actions.filter((action) => action.type === "MEDIA");
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      type: "MEDIA",
      mimeType: "image/png",
      filename: "career-uttsav-event-pass.png",
      contentBase64: "pass-base64",
    });
    expect(result.actions[0]).toMatchObject({
      type: "TEXT",
    });
    if (result.actions[0]?.type === "TEXT") {
      expect(result.actions[0].body).toContain("YOU\u2019RE IN, Aarav!");
      expect(result.actions[0].body).toContain("Registration ID: CU-BLR-2026-00042");
      expect(result.actions[0].body).not.toContain("9876543210");
    }
    expect(result.conversation?.status).toBe("COMPLETED");
    const lastAction = result.actions.at(-1);
    expect(lastAction).toMatchObject({
      type: "TEXT",
      body: "\u{1F4F1} Save this QR code. You\u2019ll need it when you arrive.",
    });
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.toLowerCase().includes("come alone")
      )
    ).toBe(false);
  });

  it("reuses already resolved seminar titles when the saved record has none", async () => {
    createStudentRegistrationMock.mockResolvedValue({
      ok: true,
      registration: {
        ...createdRegistration,
        seminarInterests: undefined,
      },
    });

    await completeWhatsAppRegistrationForConversation("919876543210");

    expect(generatePassMock).toHaveBeenCalledWith({
      registrationId: "CU-BLR-2026-00042",
      seminarTitles: [CAREER_UTTSAV_SEMINARS[0]],
    });
    expect(generateQrMock).not.toHaveBeenCalled();
  });

  it("does not repeat seminar-saved confirmation in success actions", async () => {
    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Your seminar preferences are saved")
      )
    ).toBe(false);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("YOU\u2019RE IN")
      )
    ).toBe(true);
  });

  it("does not repeat seminar-saved confirmation after finishing with two seminars", async () => {
    loadConversationMock.mockResolvedValue({
      ...readyConversation,
      selectedSeminarIds: ["sem-2026-01", "sem-2026-02"],
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("SUCCESS");
    expect(
      result.actions.filter(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("Your seminar preferences are saved")
      )
    ).toHaveLength(0);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("YOU\u2019RE IN")
      )
    ).toBe(true);
  });

  it("heals same-mobile duplicate into COMPLETED with completedRegistrationId", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: {
        outcome: "both",
        registration: existingSameMobileRegistration,
      },
      registration: {
        id: existingSameMobileRegistration.id,
        registrationNumber: existingSameMobileRegistration.registrationNumber,
        studentName: existingSameMobileRegistration.studentName,
        email: existingSameMobileRegistration.email,
        phone: existingSameMobileRegistration.phone,
      },
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
    expect(scheduleGrowthMock).not.toHaveBeenCalled();
  });

  it("resends the event pass from stored seminar titles for an existing registration", async () => {
    const storedTitles = [CAREER_UTTSAV_SEMINARS[2], CAREER_UTTSAV_SEMINARS[4]];
    getRegistrationMock.mockResolvedValue({
      ...existingSameMobileRegistration,
      seminarInterests: storedTitles,
    });
    resolveDuplicateMock.mockResolvedValue({
      resolution: {
        outcome: "both",
        registration: existingSameMobileRegistration,
      },
      registration: {
        id: existingSameMobileRegistration.id,
        registrationNumber: existingSameMobileRegistration.registrationNumber,
        studentName: existingSameMobileRegistration.studentName,
        email: existingSameMobileRegistration.email,
        phone: existingSameMobileRegistration.phone,
      },
    });
    finalizeMock.mockResolvedValue(mockHealedConversation("reg-existing"));

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
    expect(scheduleGrowthMock).not.toHaveBeenCalled();
    expect(generatePassMock).toHaveBeenCalledWith({
      registrationId: "CU-BLR-2026-00001",
      seminarTitles: storedTitles,
    });
    expect(generateQrMock).not.toHaveBeenCalled();
    expect(JSON.stringify(generatePassMock.mock.calls)).not.toContain("9876543210");
    expect(result.actions.filter((action) => action.type === "MEDIA")).toHaveLength(1);
  });

  it("recovers when registration was committed but finalize previously failed", async () => {
    resolveDuplicateMock
      .mockResolvedValueOnce(mockNoDuplicateResolution())
      .mockResolvedValueOnce({
        resolution: { outcome: "both", registration: createdRegistration },
        registration: {
          id: createdRegistration.id,
          registrationNumber: createdRegistration.registrationNumber,
          studentName: createdRegistration.studentName,
          email: createdRegistration.email,
          phone: createdRegistration.phone,
        },
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
    resolveDuplicateMock.mockResolvedValue({
      resolution: {
        outcome: "both",
        registration: existingSameMobileRegistration,
      },
      registration: {
        id: existingSameMobileRegistration.id,
        registrationNumber: existingSameMobileRegistration.registrationNumber,
        studentName: existingSameMobileRegistration.studentName,
        email: existingSameMobileRegistration.email,
        phone: existingSameMobileRegistration.phone,
      },
    });
    finalizeMock.mockResolvedValue(mockHealedConversation("reg-existing"));

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(result.conversation?.completedRegistrationId).toBe("reg-existing");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });

  it("handles registration conflicts without revealing either registration", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: { outcome: "conflict" },
      registration: null,
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("CONFLICT");
    expect(cancelMock).toHaveBeenCalledWith("919876543210");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("linked to different existing registrations")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("1 seminar selected")
      )
    ).toBe(false);
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });

  it("cancels email-only duplicate without exposing registration number", async () => {
    resolveDuplicateMock.mockResolvedValue({
      resolution: {
        outcome: "email",
        registration: existingEmailOnlyRegistration,
      },
      registration: {
        id: existingEmailOnlyRegistration.id,
        registrationNumber: existingEmailOnlyRegistration.registrationNumber,
        studentName: existingEmailOnlyRegistration.studentName,
        email: existingEmailOnlyRegistration.email,
        phone: existingEmailOnlyRegistration.phone,
      },
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
          action.body.includes("send *Hi*")
      )
    ).toBe(true);
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("1 seminar selected")
      )
    ).toBe(false);
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
    getRegistrationMock.mockResolvedValue(createdRegistration);

    const result = await completeWhatsAppRegistrationForConversation("919876543210");
    expect(result.status).toBe("ALREADY_COMPLETED");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(result.registrationNumber).toBe("CU-BLR-2026-00042");
  });

  it("does not treat a deleted registration as already completed", async () => {
    loadConversationMock.mockResolvedValue({
      ...readyConversation,
      status: "COMPLETED",
      currentStep: "COMPLETED",
      completedRegistrationId: "reg-deleted",
    });
    getRegistrationMock.mockResolvedValue(null);
    reconcileMock.mockResolvedValue({
      ...readyConversation,
      status: "ACTIVE",
      currentStep: "AWAITING_START",
      completedRegistrationId: null,
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).not.toBe("ALREADY_COMPLETED");
    expect(
      result.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("already registered")
      )
    ).toBe(false);
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
    expect(scheduleGrowthMock).not.toHaveBeenCalled();
  });

  it("repairs stale seminar IDs instead of staying stuck in READY_TO_REGISTER", async () => {
    loadConversationMock.mockResolvedValue({
      ...readyConversation,
      selectedSeminarIds: ["sem-2026-01", "sem-stale"],
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("SEMINAR_RECOVERY");
    expect(result.conversation?.status).toBe("ACTIVE");
    expect(result.conversation?.currentStep).toBe("AWAITING_SEMINARS");
    expect(result.conversation?.selectedSeminarIds).toEqual([]);
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });

  it("does not silently complete registration during seminar recovery", async () => {
    loadConversationMock.mockResolvedValue({
      ...readyConversation,
      selectedSeminarIds: ["sem-stale"],
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("SEMINAR_RECOVERY");
    expect(result.conversation?.selectedSeminarIds).toEqual([]);
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });
});

describe("whatsapp registration completion artwork seminar guard", () => {
  beforeEach(() => {
    __setRegistrationAttemptStoreForTests([]);
    vi.clearAllMocks();
    loadConversationMock.mockResolvedValue(readyConversation);
    resolveDuplicateMock.mockResolvedValue(mockNoDuplicateResolution());
    getSeminarsMock.mockResolvedValue(seminarOptions);
    getEventArtworkSeminarsMock.mockResolvedValue(seminarOptions);
    getCatalogMock.mockResolvedValue(seminarDayCatalog);
  });

  it("recovers when selected ids are outside the artwork seminar set", async () => {
    loadConversationMock.mockResolvedValue({
      ...readyConversation,
      selectedSeminarIds: ["cat-offbeat-careers"],
    });

    const result = await completeWhatsAppRegistrationForConversation("919876543210");

    expect(result.status).toBe("SEMINAR_RECOVERY");
    expect(createStudentRegistrationMock).not.toHaveBeenCalled();
  });
});

describe("resolveSeminarTitlesFromIds", () => {
  it("maps seminar ids to titles and rejects foreign ids", () => {
    expect(
      resolveSeminarTitlesFromIds(["sem-2026-01", "sem-2026-02"], seminarOptions)
    ).toEqual({
      ok: true,
      titles: [CAREER_UTTSAV_SEMINARS[0], CAREER_UTTSAV_SEMINARS[1]],
    });
    expect(
      resolveSeminarTitlesFromIds(["sem-foreign"], seminarOptions).ok
    ).toBe(false);
  });

  it("accepts more than three seminar ids for WhatsApp completion", () => {
    expect(
      resolveSeminarTitlesFromIds(
        ["sem-2026-01", "sem-2026-02", "sem-2026-03", "sem-2026-08"],
        seminarOptions
      )
    ).toEqual({
      ok: true,
      titles: [
        CAREER_UTTSAV_SEMINARS[0],
        CAREER_UTTSAV_SEMINARS[1],
        CAREER_UTTSAV_SEMINARS[2],
        CAREER_UTTSAV_SEMINARS[7],
      ],
    });
  });

  it("resolves cat-{slug} catalogue ids through the seminar options map", async () => {
    const catalogOptions = await catalogOptionsForPartialEvent();
    const catalogueOnly = catalogOptions.find(
      (option) => option.title === CAREER_UTTSAV_SEMINARS[13]
    )!;

    expect(catalogueOnly.id.startsWith("cat-")).toBe(true);
    expect(resolveSeminarTitlesFromIds([catalogueOnly.id], catalogOptions)).toEqual({
      ok: true,
      titles: [CAREER_UTTSAV_SEMINARS[13]],
    });
  });

  it("resolves a mixed list of event ids and cat-{slug} ids", async () => {
    const catalogOptions = await catalogOptionsForPartialEvent();
    const realEventSeminar = catalogOptions.find(
      (option) => option.id === "sem-2026-01"
    )!;
    const catalogueOnly = catalogOptions.find(
      (option) => option.title === CAREER_UTTSAV_SEMINARS[13]
    )!;

    expect(
      resolveSeminarTitlesFromIds(
        [realEventSeminar.id, catalogueOnly.id],
        catalogOptions
      )
    ).toEqual({
      ok: true,
      titles: [CAREER_UTTSAV_SEMINARS[0], CAREER_UTTSAV_SEMINARS[13]],
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
