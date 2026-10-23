import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CURRENT_EVENT_ID } from "@/lib/current-events";
import { migrateLegacyRegistration, REGISTRATION_KINDS } from "@/lib/registration-kinds";
import {
  countVisiblePartialAttempts,
  lastStepForWhatsAppConversation,
  partialRegistrationExportRow,
  partialRegistrationMatchesSearch,
  PARTIAL_REGISTRATION_EXPORT_HEADERS,
  toPartialRegistrationView,
} from "@/lib/registration-attempt";
import type { Event, Registration, StudentRegistration } from "@/types";
import { PARTIAL_REGISTRATIONS_TAB } from "@/features/registrations/partial-registrations";
import {
  buildRegistrationColumns,
  exportHeadersForKind,
  exportRowForKind,
  registrationMatchesSearch,
} from "@/features/registrations/registration-table-config";

const PHONE = "9876543210";
const OTHER_PHONE = "9123456780";

const { storedRegistrations } = vi.hoisted(() => ({
  storedRegistrations: { value: [] as Registration[] },
}));

const sampleEvent = {
  id: CURRENT_EVENT_ID,
  title: "Career Uttsav Test",
  slug: "career-uttsav-test",
  description: "Test",
  status: "Published",
  venue: "Venue",
  address: "Address",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
  startDate: "2026-12-19",
  endDate: "2026-12-20",
  startTime: "09:00",
  endTime: "18:00",
  hallCount: 1,
  seminars: [],
  registrationDeadline: "2026-12-10T23:59:59+05:30",
  maxCapacity: 100,
  registrationCount: 0,
  checkInCount: 0,
  isFeatured: false,
  tags: [],
  createdBy: "usr-admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as Event;

vi.mock("@/lib/server/event-service", () => ({
  listEventsForApi: vi.fn(async () => [sampleEvent]),
}));

vi.mock("@/lib/server/registration-persistence-mode", () => ({
  isPrismaRegistrationPersistence: vi.fn(() => false),
}));

vi.mock("@/lib/server/registration-prisma-store", () => ({
  createPrismaRegistration: vi.fn(),
  deletePrismaRegistration: vi.fn(),
  findPrismaStudentByEmail: vi.fn(),
  findPrismaStudentByPhone: vi.fn(),
  findPrismaStudentDuplicate: vi.fn(),
  getPrismaRegistration: vi.fn(),
  isPrismaUniqueConstraintError: vi.fn(() => false),
  listPrismaRegistrations: vi.fn(),
  patchPrismaRegistration: vi.fn(),
}));

vi.mock("@/lib/server/registrations-persistence", () => ({
  loadRawRegistrations: vi.fn(() => storedRegistrations.value),
  loadRegistrations: vi.fn(() => storedRegistrations.value),
  saveRegistrations: vi.fn((regs: Registration[]) => {
    storedRegistrations.value = regs;
    return regs;
  }),
}));

vi.mock("@/lib/server/events-persistence", () => ({
  loadEvents: vi.fn(() => [sampleEvent]),
  saveEvents: vi.fn(),
}));

vi.mock("@/lib/server/whatsapp/whatsapp-conversation-store", () => ({
  resetWhatsAppConversationsForDeletedRegistration: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendStudentWelcomeEmail: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/server/admin-auth", () => ({
  requireAdminUser: vi.fn(async () => ({ id: "admin" })),
  getAuthenticatedAdminUser: vi.fn(async () => null),
}));

import { GET as listAttempts, POST as createAttempt } from "@/app/api/registration-attempts/route";
import { PATCH as updateAttempt } from "@/app/api/registration-attempts/[id]/route";
import { consumePhoneVerification, sendOtp, verifyOtp } from "@/lib/otp";
import { __resetOtpStoreForTests, __setOtpStoreForTests } from "@/lib/otp/persistence";
import { MOCK_OTP_CODE } from "@/lib/otp/types";
import {
  __resetRegistrationAttemptStoreForTests,
  __setRegistrationAttemptStoreForTests,
  abandonWhatsAppRegistrationAttempt,
  ensureWhatsAppRegistrationAttempt,
  listRegistrationAttempts,
} from "@/lib/server/registration-attempt-store";
import {
  checkStudentRegistrationDuplicate,
  createRegistrationForApi,
  createStudentRegistration,
} from "@/lib/server/registration-service";
import {
  REGISTRATION_INTERACTIVE_IDS,
  boardInteractiveId,
  classInteractiveId,
  genderInteractiveId,
  streamInteractiveId,
} from "@/lib/server/whatsapp/registration-interactive-ids";
import { processWhatsAppRegistrationConversationTurnAsync } from "@/lib/server/whatsapp/whatsapp-registration-duplicate-flow";
import {
  buildTestEventArtworkSeminarOptions,
  buildTestSeminarDayCatalog,
} from "@/lib/server/whatsapp/whatsapp-seminar-test-fixtures";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";

const artworkOptions = buildTestEventArtworkSeminarOptions();
const dayCatalog = buildTestSeminarDayCatalog(artworkOptions);

function studentBody(overrides: Record<string, unknown> = {}) {
  return {
    kind: "student" as const,
    eventId: CURRENT_EVENT_ID,
    studentName: "Test Student",
    email: "student@example.com",
    phone: PHONE,
    college: "Test College",
    classLabel: "Class 10",
    interestedStream: "Science",
    board: "CBSE",
    gender: "Male" as const,
    city: "Bengaluru",
    seminarInterests: [artworkOptions[0]!.title],
    ...overrides,
  };
}

async function verificationToken(phone = PHONE): Promise<string> {
  const sent = await sendOtp({ phone, purpose: "student_registration" });
  expect(sent.ok).toBe(true);
  const verified = await verifyOtp({
    phone,
    purpose: "student_registration",
    code: MOCK_OTP_CODE,
  });
  expect(verified.ok).toBe(true);
  if (!verified.ok) throw new Error("otp");
  return verified.verificationToken;
}

async function waTurn(
  conversation: WhatsAppConversationState | null,
  message: { text?: string; interactiveId?: string },
  previousActivityAt?: Date | null
) {
  return processWhatsAppRegistrationConversationTurnAsync({
    conversation,
    message,
    seminarOptions: artworkOptions,
    eventArtworkSeminarOptions: artworkOptions,
    seminarDayCatalog: dayCatalog,
    waId: `91${PHONE}`,
    previousActivityAt,
  });
}

describe("registration source and attempts", () => {
  const originalOtpProvider = process.env.OTP_PROVIDER;

  beforeEach(() => {
    storedRegistrations.value = [];
    process.env.OTP_PROVIDER = "mock";
    __setOtpStoreForTests([]);
    __setRegistrationAttemptStoreForTests([]);
  });

  afterEach(() => {
    if (originalOtpProvider === undefined) {
      delete process.env.OTP_PROVIDER;
    } else {
      process.env.OTP_PROVIDER = originalOtpProvider;
    }
    __resetOtpStoreForTests();
    __resetRegistrationAttemptStoreForTests();
  });

  it("assigns source from the trusted path and ignores a public spoof", async () => {
    const token = await verificationToken();
    const website = await createRegistrationForApi(
      { ...studentBody(), source: "WHATSAPP", phoneVerificationToken: token },
      new Request("http://localhost/api/registrations"),
      { isAdminRequest: false }
    );
    expect(website.ok).toBe(true);
    if (website.ok && website.registration.kind === "student") {
      expect(website.registration.source).toBe("WEBSITE");
    }

    storedRegistrations.value = [];
    const admin = await createStudentRegistration(
      studentBody({ email: "admin-entry@example.com", phone: OTHER_PHONE }),
      { isAdminRequest: true }
    );
    expect(admin.ok).toBe(true);
    if (admin.ok && admin.registration.kind === "student") {
      expect(admin.registration.source).toBe("DIRECT_ENTRY");
    }

    storedRegistrations.value = [];
    const whatsapp = await createStudentRegistration(
      studentBody({ email: "wa-entry@example.com", phone: "9988776655" }),
      { trustedInternalRegistration: true }
    );
    expect(whatsapp.ok).toBe(true);
    if (whatsapp.ok && whatsapp.registration.kind === "student") {
      expect(whatsapp.registration.source).toBe("WHATSAPP");
    }
  });

  it("defaults historical registrations to UNKNOWN", () => {
    const migrated = migrateLegacyRegistration({
      id: "reg-old",
      registrationNumber: "CU-BLR-2026-00007",
      kind: "student",
      eventId: CURRENT_EVENT_ID,
      eventTitle: "Career Uttsav",
      status: "Confirmed",
      paymentStatus: "Waived",
      registeredAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      studentName: "Old Student",
      email: "old@example.com",
      phone: PHONE,
      college: "School",
      city: "Bengaluru",
      state: "Karnataka",
    });
    expect(migrated.kind).toBe("student");
    if (migrated.kind === "student") {
      expect(migrated.source).toBe("UNKNOWN");
    }
  });

  it("keeps source on the student table, search, and CSV without adding a registration kind", () => {
    expect(REGISTRATION_KINDS).toEqual([
      "student",
      "school",
      "partner_registration",
      "student_ambassador",
    ]);
    expect(PARTIAL_REGISTRATIONS_TAB.label).toBe("Partial Registrations");
    const headers = buildRegistrationColumns("student", new Map()).map((column) =>
      typeof column.header === "string" ? column.header : ""
    );
    expect(headers[1]).toBe("Pass ID");
    expect(headers[2]).toBe("Source");
    expect(exportHeadersForKind("student")[2]).toBe("Source");
    expect(exportHeadersForKind("school")).not.toContain("Source");

    const registration = {
      ...studentBody(),
      id: "reg-1",
      registrationNumber: "CU-BLR-2026-00011",
      source: "WHATSAPP",
      status: "Confirmed",
      paymentStatus: "Waived",
      registeredAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      state: "Karnataka",
      eventTitle: sampleEvent.title,
    } as StudentRegistration;
    expect(registrationMatchesSearch(registration, "whatsapp")).toBe(true);
    expect(registrationMatchesSearch(registration, "website")).toBe(false);
    expect(exportRowForKind(registration, new Map())).toContain("WhatsApp");
    const unknown = { ...registration, source: undefined };
    expect(registrationMatchesSearch(unknown, "unknown")).toBe(true);
    expect(exportRowForKind(unknown, new Map())[2]).toBe("Unknown");
  });

  it("creates one WhatsApp attempt on the first Hi and reuses it", async () => {
    const first = await waTurn(null, { text: "Hi" });
    const attempts = await listRegistrationAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.source).toBe("WHATSAPP");
    expect(attempts[0]?.phone).toBe(PHONE);
    expect(attempts[0]?.phoneLast10).toBe(PHONE);
    expect(attempts[0]?.lastStep).toBe("WELCOME");
    expect(first.conversation.registrationAttemptId).toBe(attempts[0]?.id);

    const second = await waTurn(first.conversation, { text: "Hello" });
    expect(await listRegistrationAttempts()).toHaveLength(1);
    expect(second.conversation.registrationAttemptId).toBe(attempts[0]?.id);

    const started = await waTurn(second.conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
    });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("STARTED");
    expect(started.conversation.registrationAttemptId).toBe(attempts[0]?.id);

    const named = await waTurn(started.conversation, { text: "Aarav Sharma" });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("NAME");
    expect((await listRegistrationAttempts())[0]?.name).toBe("Aarav Sharma");

    const emailed = await waTurn(named.conversation, { text: "aarav@example.com" });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("EMAIL");

    const classed = await waTurn(emailed.conversation, {
      interactiveId: classInteractiveId("Class 10"),
    });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("CLASS");

    const gendered = await waTurn(classed.conversation, {
      interactiveId: genderInteractiveId("Male"),
    });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("GENDER");

    const boarded = await waTurn(gendered.conversation, {
      interactiveId: boardInteractiveId("CBSE"),
    });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("BOARD");

    const streamed = await waTurn(boarded.conversation, {
      interactiveId: streamInteractiveId("Science"),
    });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("STREAM");

    const school = await waTurn(streamed.conversation, { text: "National Public School" });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("SCHOOL_COLLEGE");
    expect((await listRegistrationAttempts())[0]?.college).toBe("National Public School");

    const city = await waTurn(school.conversation, { text: "Bengaluru" });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("CITY");

    const seminars = await waTurn(city.conversation, { text: "1" });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("SEMINAR_SELECTION");
    expect((await listRegistrationAttempts())[0]?.seminarInterests.length).toBeGreaterThan(0);

    const finished = await waTurn(seminars.conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.FINISH,
    });
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("FINISH_REGISTRATION");
    expect(finished.conversation.registrationAttemptId).toBe(attempts[0]?.id);
    expect(lastStepForWhatsAppConversation("AWAITING_START")).toBe("WELCOME");
  });

  it("resets the same WhatsApp attempt on Start Over and resumes it", async () => {
    const hi = await waTurn(null, { text: "Hi" });
    const started = await waTurn(hi.conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.START,
    });
    const named = await waTurn(started.conversation, { text: "Aarav Sharma" });
    const original = (await listRegistrationAttempts())[0]!;
    const restarted = await waTurn(named.conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.RESTART,
    });
    const afterRestart = await listRegistrationAttempts();
    expect(afterRestart).toHaveLength(1);
    expect(afterRestart[0]?.id).toBe(original.id);
    expect(afterRestart[0]?.startedAt).toBe(original.startedAt);
    expect(afterRestart[0]?.name).toBeNull();
    expect(afterRestart[0]?.lastStep).toBe("STARTED");
    expect(restarted.conversation.registrationAttemptId).toBe(original.id);

    const stale = new Date(Date.now() - 31 * 60 * 1000);
    const resume = await waTurn(restarted.conversation, { text: "Hi" }, stale);
    const continued = await waTurn(resume.conversation, {
      interactiveId: REGISTRATION_INTERACTIVE_IDS.CONTINUE,
    });
    expect(await listRegistrationAttempts()).toHaveLength(1);
    expect(continued.conversation.registrationAttemptId).toBe(original.id);
  });

  it("abandons an expired WhatsApp attempt and starts a new one later", async () => {
    const created = await ensureWhatsAppRegistrationAttempt({
      eventId: CURRENT_EVENT_ID,
      waId: `91${PHONE}`,
    });
    const abandoned = await abandonWhatsAppRegistrationAttempt({
      attemptId: created.id,
      waId: `91${PHONE}`,
      eventId: CURRENT_EVENT_ID,
    });
    expect(abandoned?.status).toBe("ABANDONED");
    expect(abandoned?.phone).toBe(PHONE);
    expect(abandoned?.lastStep).toBe("WELCOME");
    const fresh = await ensureWhatsAppRegistrationAttempt({
      eventId: CURRENT_EVENT_ID,
      waId: `91${PHONE}`,
    });
    expect(fresh.id).not.toBe(created.id);
    expect(fresh.status).toBe("IN_PROGRESS");
    const all = await listRegistrationAttempts();
    expect(all.filter((row) => row.status === "ABANDONED")).toHaveLength(1);
    expect(all.filter((row) => row.status === "IN_PROGRESS")).toHaveLength(1);
  });

  it("does not create an attempt when the phone is already registered", async () => {
    storedRegistrations.value = [
      {
        ...studentBody(),
        id: "reg-existing",
        registrationNumber: "CU-BLR-2026-00042",
        source: "WEBSITE",
        status: "Confirmed",
        paymentStatus: "Waived",
        registeredAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        state: "Karnataka",
        eventTitle: sampleEvent.title,
      } as StudentRegistration,
    ];
    await waTurn(null, { text: "Hi" });
    expect(await listRegistrationAttempts()).toHaveLength(0);
  });

  it("creates a website attempt only after OTP verification and completes it", async () => {
    const open = await createAttempt(
      new Request("http://localhost/api/registration-attempts", {
        method: "POST",
        body: JSON.stringify({
          eventId: CURRENT_EVENT_ID,
          phone: PHONE,
          name: "Website Student",
          email: "web@example.com",
        }),
      })
    );
    expect(open.status).toBe(400);

    const token = await verificationToken();
    const before = await consumePhoneVerification({
      phone: PHONE,
      purpose: "student_registration",
      verificationToken: token,
      consume: false,
    });
    expect(before.ok).toBe(true);

    const created = await createAttempt(
      new Request("http://localhost/api/registration-attempts", {
        method: "POST",
        body: JSON.stringify({
          eventId: CURRENT_EVENT_ID,
          phone: PHONE,
          name: "Website Student",
          email: "web@example.com",
          phoneVerificationToken: token,
          source: "WHATSAPP",
        }),
      })
    );
    expect(created.status).toBe(200);
    const body = (await created.json()) as { attemptId: string };
    const attempt = (await listRegistrationAttempts())[0]!;
    expect(attempt.id).toBe(body.attemptId);
    expect(attempt.source).toBe("WEBSITE");
    expect(attempt.phone).toBe(PHONE);
    expect(attempt.name).toBe("Website Student");
    expect(attempt.email).toBe("web@example.com");
    expect(attempt.lastStep).toBe("YOU");
    const stillValid = await consumePhoneVerification({
      phone: PHONE,
      purpose: "student_registration",
      verificationToken: token,
      consume: false,
    });
    expect(stillValid.ok).toBe(true);

    const academics = await updateAttempt(
      new Request("http://localhost/api/registration-attempts/" + attempt.id, {
        method: "PATCH",
        body: JSON.stringify({
          phone: PHONE,
          phoneVerificationToken: token,
          college: "Website College",
          classLabel: "Class 10",
          board: "CBSE",
          interestedStream: "Science",
          city: "Bengaluru",
          gender: "Female",
        }),
      }),
      { params: Promise.resolve({ id: attempt.id }) }
    );
    expect(academics.status).toBe(200);
    expect((await listRegistrationAttempts())[0]?.lastStep).toBe("ACADEMICS");
    expect((await listRegistrationAttempts())[0]?.college).toBe("Website College");

    const duplicate = await checkStudentRegistrationDuplicate({
      eventId: CURRENT_EVENT_ID,
      phone: PHONE,
      email: "web@example.com",
    });
    expect(duplicate.duplicate).toBe(false);

    const completed = await createRegistrationForApi(
      { ...studentBody({ email: "web@example.com", gender: "Female", college: "Website College" }), phoneVerificationToken: token, attemptId: attempt.id },
      new Request("http://localhost/api/registrations"),
      { isAdminRequest: false }
    );
    expect(completed.ok).toBe(true);
    if (completed.ok && completed.registration.kind === "student") {
      expect(completed.registration.source).toBe("WEBSITE");
    }
    const finishedAttempt = (await listRegistrationAttempts())[0]!;
    expect(finishedAttempt.status).toBe("COMPLETED");
    expect(finishedAttempt.completedRegistrationId).toBe(
      completed.ok ? completed.registration.id : ""
    );
    expect(finishedAttempt.lastStep).toBe("INTERESTS");
    const tokenAfter = await consumePhoneVerification({
      phone: PHONE,
      purpose: "student_registration",
      verificationToken: token,
      consume: false,
    });
    expect(tokenAfter.ok).toBe(false);
  });

  it("abandons the other channel without blocking or touching unrelated attempts", async () => {
    const website = await (async () => {
      const token = await verificationToken(PHONE);
      const response = await createAttempt(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            eventId: CURRENT_EVENT_ID,
            phone: PHONE,
            name: "Website Lead",
            email: "lead@example.com",
            phoneVerificationToken: token,
          }),
        })
      );
      const json = (await response.json()) as { attemptId: string };
      return { token, attemptId: json.attemptId };
    })();
    const whatsapp = await ensureWhatsAppRegistrationAttempt({
      eventId: CURRENT_EVENT_ID,
      waId: `91${PHONE}`,
    });
    const unrelated = await ensureWhatsAppRegistrationAttempt({
      eventId: CURRENT_EVENT_ID,
      waId: `91${OTHER_PHONE}`,
    });

    const completed = await createStudentRegistration(
      studentBody({ email: "lead@example.com" }),
      { trustedInternalRegistration: true, attemptId: whatsapp.id }
    );
    expect(completed.ok).toBe(true);
    if (completed.ok && completed.registration.kind === "student") {
      expect(completed.registration.source).toBe("WHATSAPP");
    }
    const rows = await listRegistrationAttempts();
    expect(rows.find((row) => row.id === website.attemptId)?.status).toBe("ABANDONED");
    expect(rows.find((row) => row.id === whatsapp.id)?.status).toBe("COMPLETED");
    expect(rows.find((row) => row.id === whatsapp.id)?.completedRegistrationId).toBe(
      completed.ok ? completed.registration.id : ""
    );
    expect(rows.find((row) => row.id === unrelated.id)?.status).toBe("IN_PROGRESS");

    const blocked = await createStudentRegistration(
      studentBody({ email: "another@example.com" }),
      { trustedInternalRegistration: true }
    );
    expect(blocked.ok).toBe(false);
  });

  it("shows partial rows, hides completed attempts, and exports partial CSV", async () => {
    await ensureWhatsAppRegistrationAttempt({
      eventId: CURRENT_EVENT_ID,
      waId: `91${PHONE}`,
    });
    const visible = await listRegistrationAttempts({
      statuses: ["IN_PROGRESS", "ABANDONED"],
    });
    expect(countVisiblePartialAttempts(visible)).toBe(1);
    const view = toPartialRegistrationView(visible[0]!);
    expect(view.passId).toBe("—");
    expect(view.source).toBe("WhatsApp");
    expect(view.name).toBe("—");
    expect(view.phone).toBe(PHONE);
    expect(view.lastStep).toBe("Welcome");
    expect(view.status).toBe("In Progress");
    expect(partialRegistrationMatchesSearch(visible[0]!, "welcome")).toBe(true);
    expect(partialRegistrationMatchesSearch(visible[0]!, "whatsapp")).toBe(true);
    expect(PARTIAL_REGISTRATION_EXPORT_HEADERS[0]).toBe("Started On");
    expect(PARTIAL_REGISTRATION_EXPORT_HEADERS).not.toContain("Student Name");
    expect(partialRegistrationExportRow(view)[2]).toBe("WhatsApp");
    expect(partialRegistrationExportRow(view)[9]).toBe(view.lastActivity);

    const response = await listAttempts();
    const payload = (await response.json()) as Array<{ status: string }>;
    expect(payload.every((row) => row.status !== "COMPLETED")).toBe(true);
    expect(exportHeadersForKind("student")).not.toEqual([
      ...PARTIAL_REGISTRATION_EXPORT_HEADERS,
    ]);
  });
});

afterEach(() => {
  __resetOtpStoreForTests();
  __resetRegistrationAttemptStoreForTests();
});
