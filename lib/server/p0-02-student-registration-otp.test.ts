import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { Event, User } from "@/types";

const ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
const PHONE = "9876543210";
const OTHER_PHONE = "9123456780";

const { storedRegistrations } = vi.hoisted(() => ({
  storedRegistrations: { value: [] as unknown[] },
}));

const activeAdmin: User = {
  id: "usr-admin",
  name: "Admin User",
  email: "admin@careeruttsav.in",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
  status: "Active",
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
};

const sampleEvent: Event = {
  id: "evt-001",
  title: "Career Uttsav Test",
  slug: "career-uttsav-test",
  description: "Test",
  status: "Published",
  venue: "Venue",
  address: "Address",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001",
  startDate: "2026-08-15",
  endDate: "2026-08-16",
  startTime: "09:00",
  endTime: "18:00",
  hallCount: 1,
  seminars: [],
  registrationDeadline: "2026-08-10T23:59:59+05:30",
  maxCapacity: 100,
  registrationCount: 0,
  checkInCount: 0,
  isFeatured: false,
  tags: [],
  createdBy: "usr-admin",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function studentBody(overrides: Record<string, unknown> = {}) {
  return {
    kind: "student" as const,
    eventId: "evt-001",
    studentName: "Test Student",
    email: "student@example.com",
    phone: PHONE,
    college: "Test College",
    classLabel: "Class 10",
    interestedStream: "Science",
    board: "CBSE",
    gender: "Male" as const,
    city: "Bangalore",
    ...overrides,
  };
}

vi.mock("@/lib/server/admin-user-service", () => ({
  findAdminUserById: vi.fn(),
  getAdminUserAuthVersion: vi.fn(),
}));

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
  isPrismaUniqueConstraintError: vi.fn(),
  listPrismaRegistrations: vi.fn(),
  patchPrismaRegistration: vi.fn(),
}));

vi.mock("@/lib/server/registrations-persistence", () => ({
  loadRawRegistrations: vi.fn(() => storedRegistrations.value),
  loadRegistrations: vi.fn(() => storedRegistrations.value),
  saveRegistrations: vi.fn((regs: unknown[]) => {
    storedRegistrations.value = regs;
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

import { POST as registrationsPost } from "@/app/api/registrations/route";
import { POST as sendOtpPost } from "@/app/api/send-otp/route";
import { POST as verifyOtpPost } from "@/app/api/verify-otp/route";
import {
  findAdminUserById,
  getAdminUserAuthVersion,
} from "@/lib/server/admin-user-service";
import {
  __resetOtpStoreForTests,
  __setOtpStoreForTests,
} from "@/lib/otp/persistence";
import { sendOtp, verifyOtp } from "@/lib/otp/service";
import { MOCK_OTP_CODE } from "@/lib/otp/types";
import { createRegistrationForApi } from "@/lib/server/registration-service";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

async function issueVerificationToken(phone = PHONE): Promise<string> {
  const sent = await sendOtp({
    phone,
    purpose: "student_registration",
  });
  expect(sent.ok).toBe(true);

  const verified = await verifyOtp({
    phone,
    purpose: "student_registration",
    code: MOCK_OTP_CODE,
  });
  expect(verified.ok).toBe(true);
  if (!verified.ok) throw new Error("expected verification token");
  return verified.verificationToken;
}

function adminCookie(userId = activeAdmin.id) {
  const token = createAdminSessionToken({ userId, authVersion: 0 });
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
  } as Awaited<ReturnType<typeof cookies>>);
}

function noSession() {
  vi.mocked(cookies).mockResolvedValue({
    get: () => undefined,
  } as Awaited<ReturnType<typeof cookies>>);
}

describe("P0-02 student registration OTP enforcement", () => {
  const originalAdminSecret = process.env.ADMIN_SESSION_SECRET;
  const originalOtpProvider = process.env.OTP_PROVIDER;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = ADMIN_SESSION_SECRET;
    process.env.OTP_PROVIDER = "mock";
    process.env.PHONE_VERIFICATION_TOKEN_SECRET = "test-phone-verification-secret";
    storedRegistrations.value = [];
    vi.mocked(getAdminUserAuthVersion).mockResolvedValue(0);
    vi.mocked(findAdminUserById).mockResolvedValue(activeAdmin);
    __setOtpStoreForTests([]);
    noSession();
  });

  afterEach(() => {
    __resetOtpStoreForTests();
    vi.unstubAllEnvs();
    if (originalAdminSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalAdminSecret;
    }
    if (originalOtpProvider === undefined) {
      delete process.env.OTP_PROVIDER;
    } else {
      process.env.OTP_PROVIDER = originalOtpProvider;
    }
  });

  it("rejects unauthenticated student POST with no token", async () => {
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentBody()),
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Please verify your mobile number with OTP before registering.",
    });
  });

  it("rejects unauthenticated student POST with fake token", async () => {
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          studentBody({ phoneVerificationToken: "a".repeat(64) })
        ),
      })
    );
    expect(response.status).toBe(400);
  });

  it("rejects unauthenticated student POST with expired token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await issueVerificationToken();
    vi.setSystemTime(new Date("2026-01-01T01:00:00.000Z"));

    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentBody({ phoneVerificationToken: token })),
      })
    );
    expect(response.status).toBe(400);
    vi.useRealTimers();
  });

  it("rejects valid token when phone does not match", async () => {
    const token = await issueVerificationToken(PHONE);
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          studentBody({
            phone: OTHER_PHONE,
            phoneVerificationToken: token,
          })
        ),
      })
    );
    expect(response.status).toBe(400);
  });

  it("accepts unauthenticated student POST with valid matching token", async () => {
    const token = await issueVerificationToken();
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cu-client": "public",
        },
        body: JSON.stringify(studentBody({ phoneVerificationToken: token })),
      })
    );
    expect(response.status).toBe(200);
  });

  it("rejects reuse of the same verification token", async () => {
    const token = await issueVerificationToken();
    const first = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          studentBody({
            email: "first@example.com",
            phoneVerificationToken: token,
          })
        ),
      })
    );
    expect(first.status).toBe(200);

    const second = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          studentBody({
            email: "second@example.com",
            phoneVerificationToken: token,
          })
        ),
      })
    );
    expect(second.status).toBe(400);
  });

  it("rejects bypass when x-cu-client and token are omitted (original vulnerability)", async () => {
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentBody()),
      })
    );
    expect(response.status).toBe(400);
  });

  it("rejects forged x-cu-client: admin without valid Admin session", async () => {
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cu-client": "admin",
        },
        body: JSON.stringify(
          studentBody({ client: "admin" as unknown as string })
        ),
      })
    );
    expect(response.status).toBe(400);
  });

  it("allows Admin manual create without token when Admin session is valid", async () => {
    adminCookie();
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentBody()),
      })
    );
    expect(response.status).toBe(200);
  });

  it("allows Admin manual create with x-cu-client: public when Admin session is valid", async () => {
    adminCookie();
    const response = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cu-client": "public",
        },
        body: JSON.stringify(
          studentBody({ client: "public" as unknown as string })
        ),
      })
    );
    expect(response.status).toBe(200);
  });

  it("keeps public send-otp reachable without Admin session", async () => {
    const response = await sendOtpPost(
      new Request("http://localhost/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: PHONE,
          purpose: "student_registration",
        }),
      })
    );
    expect(response.status).not.toBe(401);
  });

  it("keeps public verify-otp reachable without Admin session", async () => {
    await sendOtp({ phone: PHONE, purpose: "student_registration" });
    const response = await verifyOtpPost(
      new Request("http://localhost/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: PHONE,
          purpose: "student_registration",
          code: MOCK_OTP_CODE,
        }),
      })
    );
    expect(response.status).not.toBe(401);
  });

  it("rejects client-supplied isAdminRequest in service options", async () => {
    const result = await createRegistrationForApi(
      studentBody({ isAdminRequest: true }),
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
      { isAdminRequest: false }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
  });

  it("keeps duplicate registration protections unchanged", async () => {
    const token = await issueVerificationToken();
    const body = studentBody({ phoneVerificationToken: token });

    const first = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    expect(first.status).toBe(200);

    const duplicate = await registrationsPost(
      new Request("http://localhost/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          phoneVerificationToken: (await issueVerificationToken()).trim(),
        }),
      })
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ duplicate: true });
  });
});
