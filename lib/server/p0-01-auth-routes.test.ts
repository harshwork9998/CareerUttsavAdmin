import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { Partner, Registration, User } from "@/types";

const SERVICE_SECRET = "test-partner-portal-service-secret";
const ADMIN_SESSION_SECRET = "test-admin-session-secret-value";

const activeSuperuser: User = {
  id: "usr-super",
  name: "Super Admin",
  email: "super@careeruttsav.in",
  role: "superuser",
  roleId: ROLE_ID_BY_NAME.superuser,
  status: "Active",
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
};

const activeUser: User = {
  ...activeSuperuser,
  id: "usr-normal",
  email: "user@careeruttsav.in",
  role: "user",
  roleId: ROLE_ID_BY_NAME.user,
};

const sampleRegistration = {
  id: "reg-001",
  registrationNumber: "CU-2026-0001",
  kind: "student",
  eventId: "evt-001",
  studentName: "Test Student",
  email: "student@example.com",
  phone: "9876543210",
  status: "Confirmed",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as Registration;

const samplePartner: Partner = {
  id: "partner-001",
  name: "Test University",
  city: "Bangalore",
  state: "Karnataka",
  primaryContact: {
    name: "Admin Contact",
    email: "admin@test.edu",
    phone: "9876500001",
    designation: "Director",
  },
  secondaryContact: {
    name: "Secondary",
    email: "sec@test.edu",
    phone: "9876500002",
    designation: "Coordinator",
  },
  eventIds: ["evt-001"],
  relationshipOwner: {
    organization: "K2",
    managerName: "Owner",
    managerPhone: "9876500003",
    managerEmail: "owner@test.edu",
  },
  stage: "Confirmed",
  stageRemarks: [
    {
      id: "remark-1",
      fromStage: "Meeting Scheduled",
      toStage: "Confirmed",
      remark: "Internal CRM note",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  sponsorshipTier: "University Partner",
  eventPartnerships: [],
  deliverables: [],
  seminarSlotAssignments: [],
  totalAmount: 500000,
  discountAmount: 50000,
  netAmount: 450000,
  sponsorshipNotes: "Internal sponsorship note",
  meetingNotes: "Internal meeting notes",
  portalLogin: "partner@test.edu",
  portalPasswordHash:
    "scrypt$16384$8$1$aaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  portalInviteEmail: "partner@test.edu",
  portalInviteSentAt: "2026-01-01T00:00:00.000Z",
  portalAuthVersion: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("@/lib/server/whatsapp/whatsapp-webhook-processor", () => ({
  processVerifiedWhatsAppWebhook: vi.fn(async () => undefined),
}));

vi.mock("@/lib/server/admin-user-service", () => ({
  authenticateAdminUser: vi.fn(),
  listAdminUsers: vi.fn(async () => []),
  findAdminUserById: vi.fn(),
  getAdminUserAuthVersion: vi.fn(),
  updateAdminUser: vi.fn(),
}));

vi.mock("@/lib/server/registration-service", () => ({
  listRegistrationsForApi: vi.fn(async () => []),
  createRegistrationForApi: vi.fn(),
  getRegistrationForApi: vi.fn(),
  patchRegistrationForApi: vi.fn(),
  deleteRegistrationForApi: vi.fn(),
  checkStudentRegistrationDuplicate: vi.fn(async () => ({
    duplicate: false,
    message: null,
    registration: null,
  })),
}));

vi.mock("@/lib/server/partner-service", () => ({
  listPartnersForApi: vi.fn(async () => []),
  createPartnerForApi: vi.fn(),
  getPartnerByIdForApi: vi.fn(),
  updatePartnerForApi: vi.fn(),
  deletePartnerForApi: vi.fn(),
  findPartnersByPortalLoginForApi: vi.fn(async () => []),
}));

vi.mock("@/lib/server/event-service", () => ({
  listEventsForApi: vi.fn(async () => []),
  getEventForApi: vi.fn(async () => null),
}));

vi.mock("@/lib/server/event-write-service", () => ({
  createEventForApi: vi.fn(),
  patchEventForApi: vi.fn(),
  deleteEventForApi: vi.fn(),
}));

vi.mock("@/lib/server/spoc-service", () => ({
  listSpocsForApi: vi.fn(async () => []),
  createSpocForApi: vi.fn(),
  getSpocByIdForApi: vi.fn(),
  updateSpocForApi: vi.fn(),
  deleteSpocForApi: vi.fn(),
}));

vi.mock("@/lib/server/seminar-roster-service", () => ({
  listSeminarRostersForApi: vi.fn(async () => []),
  upsertSeminarRosterForApi: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { GET as registrationsGet, POST as registrationsPost } from "@/app/api/registrations/route";
import { GET as registrationCheckGet } from "@/app/api/registrations/check/route";
import {
  DELETE as registrationDelete,
  GET as registrationByIdGet,
  PATCH as registrationPatch,
} from "@/app/api/registrations/[id]/route";
import { GET as partnersGet, POST as partnersPost } from "@/app/api/partners/route";
import {
  DELETE as partnerDelete,
  PATCH as partnerPatch,
} from "@/app/api/partners/[id]/route";
import { GET as partnerPortalPartnersGet } from "@/app/api/partner-portal/partners/route";
import { PATCH as partnerPortalPartnerPatch } from "@/app/api/partner-portal/partners/[id]/route";
import { GET as partnerPortalEventsGet } from "@/app/api/partner-portal/events/route";
import { POST as partnerPortalLoginPost } from "@/app/api/partner-portal/login/route";
import { POST as eventsPost } from "@/app/api/events/route";
import { POST as spocsPost } from "@/app/api/spocs/route";
import { POST as seminarRostersPost } from "@/app/api/seminar-rosters/route";
import { GET as dashboardTrendGet } from "@/app/api/dashboard/registration-trend/route";
import { POST as sendOtpPost } from "@/app/api/send-otp/route";
import { POST as verifyOtpPost } from "@/app/api/verify-otp/route";
import { GET as usersGet } from "@/app/api/users/route";
import {
  GET as whatsappWebhookGet,
  POST as whatsappWebhookPost,
} from "@/app/api/integrations/whatsapp/webhook/route";
import {
  findAdminUserById,
  getAdminUserAuthVersion,
  listAdminUsers,
} from "@/lib/server/admin-user-service";
import {
  checkStudentRegistrationDuplicate,
  createRegistrationForApi,
  listRegistrationsForApi,
  patchRegistrationForApi,
} from "@/lib/server/registration-service";
import {
  deletePartnerForApi,
  listPartnersForApi,
  updatePartnerForApi,
} from "@/lib/server/partner-service";
import { listEventsForApi } from "@/lib/server/event-service";
import { createEventForApi } from "@/lib/server/event-write-service";
import { createSpocForApi } from "@/lib/server/spoc-service";
import { upsertSeminarRosterForApi } from "@/lib/server/seminar-roster-service";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
} from "@/lib/server/admin-session";
import { PARTNER_PORTAL_SERVICE_KEY_HEADER } from "@/lib/server/partner-portal-service-auth";

function serviceHeaders(secret = SERVICE_SECRET): HeadersInit {
  return { [PARTNER_PORTAL_SERVICE_KEY_HEADER]: secret };
}

function adminCookie(userId: string) {
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

describe("P0-01 API authorization", () => {
  const originalAdminSecret = process.env.ADMIN_SESSION_SECRET;
  const originalServiceSecret = process.env.PARTNER_PORTAL_SERVICE_SECRET;
  const originalOtpProvider = process.env.OTP_PROVIDER;

  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = ADMIN_SESSION_SECRET;
    process.env.PARTNER_PORTAL_SERVICE_SECRET = SERVICE_SECRET;
    process.env.OTP_PROVIDER = "mock";
    process.env.PHONE_VERIFICATION_TOKEN_SECRET = "test-phone-verification-secret";

    vi.mocked(getAdminUserAuthVersion).mockResolvedValue(0);
    vi.mocked(findAdminUserById).mockImplementation(async (id) => {
      if (id === activeSuperuser.id) return activeSuperuser;
      if (id === activeUser.id) return activeUser;
      return null;
    });
    vi.mocked(listRegistrationsForApi).mockResolvedValue([sampleRegistration]);
    vi.mocked(listPartnersForApi).mockResolvedValue([samplePartner]);
    vi.mocked(listEventsForApi).mockResolvedValue([]);
    vi.mocked(createRegistrationForApi).mockResolvedValue({
      ok: true,
      registration: sampleRegistration,
    });
    vi.mocked(patchRegistrationForApi).mockResolvedValue(sampleRegistration);
    vi.mocked(updatePartnerForApi).mockResolvedValue({
      ok: true,
      partner: { ...samplePartner, portalFasciaName: "Updated Fascia" },
    });
    vi.mocked(deletePartnerForApi).mockResolvedValue({
      ok: true,
      partners: [],
    });
    vi.mocked(createEventForApi).mockResolvedValue({
      ok: true,
      data: { id: "evt-new" } as never,
    });
    vi.mocked(createSpocForApi).mockResolvedValue({
      ok: true,
      spoc: { id: "spoc-1" } as never,
      status: 200,
    });
    vi.mocked(upsertSeminarRosterForApi).mockResolvedValue({
      ok: true,
      roster: { eventId: "evt-001", seminarId: "sem-001" } as never,
    });
    vi.mocked(listAdminUsers).mockResolvedValue([activeSuperuser]);
  });

  afterEach(() => {
    if (originalAdminSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalAdminSecret;
    }
    if (originalServiceSecret === undefined) {
      delete process.env.PARTNER_PORTAL_SERVICE_SECRET;
    } else {
      process.env.PARTNER_PORTAL_SERVICE_SECRET = originalServiceSecret;
    }
    if (originalOtpProvider === undefined) {
      delete process.env.OTP_PROVIDER;
    } else {
      process.env.OTP_PROVIDER = originalOtpProvider;
    }
  });

  describe("registrations", () => {
    it("GET /api/registrations without session returns 401", async () => {
      noSession();
      const response = await registrationsGet();
      expect(response.status).toBe(401);
      expect(listRegistrationsForApi).not.toHaveBeenCalled();
    });

    it("GET /api/registrations with Admin session returns 200", async () => {
      adminCookie(activeSuperuser.id);
      const response = await registrationsGet();
      expect(response.status).toBe(200);
      expect(listRegistrationsForApi).toHaveBeenCalledOnce();
    });

    it("PATCH /api/registrations/:id without session returns 401", async () => {
      noSession();
      const response = await registrationPatch(
        new Request("http://localhost/api/registrations/reg-001", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Checked In" }),
        }),
        { params: Promise.resolve({ id: "reg-001" }) }
      );
      expect(response.status).toBe(401);
      expect(patchRegistrationForApi).not.toHaveBeenCalled();
    });

    it("POST /api/registrations remains reachable without session", async () => {
      noSession();
      const response = await registrationsPost(
        new Request("http://localhost/api/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "student",
            eventId: "evt-001",
            studentName: "Public Student",
            email: "public@example.com",
            phone: "9876543210",
          }),
        })
      );
      expect(response.status).not.toBe(401);
      expect(createRegistrationForApi).toHaveBeenCalled();
    });

    it("GET /api/registrations/check remains reachable without session", async () => {
      noSession();
      const response = await registrationCheckGet(
        new Request(
          "http://localhost/api/registrations/check?email=public@example.com"
        )
      );
      expect(response.status).not.toBe(401);
      expect(checkStudentRegistrationDuplicate).toHaveBeenCalled();
    });
  });

  describe("admin partners", () => {
    it("GET /api/partners without Admin session returns 401", async () => {
      noSession();
      const response = await partnersGet();
      expect(response.status).toBe(401);
    });

    it("GET /api/partners with Admin session returns 200", async () => {
      adminCookie(activeSuperuser.id);
      const response = await partnersGet();
      expect(response.status).toBe(200);
    });

    it("PATCH /api/partners/:id without Admin session returns 401", async () => {
      noSession();
      const response = await partnerPatch(
        new Request("http://localhost/api/partners/partner-001", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Hijacked" }),
        }),
        { params: Promise.resolve({ id: "partner-001" }) }
      );
      expect(response.status).toBe(401);
    });

    it("POST /api/partners without Admin session returns 401", async () => {
      noSession();
      const response = await partnersPost(
        new Request("http://localhost/api/partners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "New Partner" }),
        })
      );
      expect(response.status).toBe(401);
    });

    it("DELETE /api/partners/:id without Admin session returns 401", async () => {
      noSession();
      const response = await partnerDelete(
        new Request("http://localhost/api/partners/partner-001", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "partner-001" }) }
      );
      expect(response.status).toBe(401);
      expect(deletePartnerForApi).not.toHaveBeenCalled();
    });
  });

  describe("partner portal service routes", () => {
    it("GET /api/partner-portal/partners without secret returns 401", async () => {
      const response = await partnerPortalPartnersGet(
        new Request("http://localhost/api/partner-portal/partners")
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/partner-portal/partners with wrong secret returns 401", async () => {
      const response = await partnerPortalPartnersGet(
        new Request("http://localhost/api/partner-portal/partners", {
          headers: serviceHeaders("wrong-secret"),
        })
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/partner-portal/partners fails closed when service secret is unset", async () => {
      delete process.env.PARTNER_PORTAL_SERVICE_SECRET;
      const response = await partnerPortalPartnersGet(
        new Request("http://localhost/api/partner-portal/partners", {
          headers: serviceHeaders(),
        })
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/partner-portal/partners with correct secret returns 200", async () => {
      const response = await partnerPortalPartnersGet(
        new Request("http://localhost/api/partner-portal/partners", {
          headers: serviceHeaders(),
        })
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>[];
      expect(Array.isArray(body)).toBe(true);
      expect(body[0]?.id).toBe("partner-001");
    });

    it("GET /api/partner-portal/partners omits Admin-only sensitive fields", async () => {
      const response = await partnerPortalPartnersGet(
        new Request("http://localhost/api/partner-portal/partners", {
          headers: serviceHeaders(),
        })
      );
      const body = (await response.json()) as Record<string, unknown>[];
      const partner = body[0] ?? {};
      expect(partner).not.toHaveProperty("portalPasswordHash");
      expect(partner).not.toHaveProperty("primaryContact");
      expect(partner).not.toHaveProperty("secondaryContact");
      expect(partner).not.toHaveProperty("relationshipOwner");
      expect(partner).not.toHaveProperty("stageRemarks");
      expect(partner).not.toHaveProperty("totalAmount");
      expect(partner).not.toHaveProperty("discountAmount");
      expect(partner).not.toHaveProperty("netAmount");
      expect(partner).not.toHaveProperty("sponsorshipNotes");
      expect(partner).not.toHaveProperty("meetingNotes");
      expect(partner).toHaveProperty("portalLogin");
      expect(partner).toHaveProperty("eventPartnerships");
    });

    it("PATCH portal partner with allowed fields succeeds", async () => {
      const response = await partnerPortalPartnerPatch(
        new Request("http://localhost/api/partner-portal/partners/partner-001", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...serviceHeaders(),
          },
          body: JSON.stringify({ portalFasciaName: "Updated Fascia" }),
        }),
        { params: Promise.resolve({ id: "partner-001" }) }
      );
      expect(response.status).toBe(200);
      expect(updatePartnerForApi).toHaveBeenCalledWith(
        "partner-001",
        expect.objectContaining({ portalFasciaName: "Updated Fascia" })
      );
    });

    it("PATCH portal partner with forbidden field returns 403", async () => {
      const response = await partnerPortalPartnerPatch(
        new Request("http://localhost/api/partner-portal/partners/partner-001", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...serviceHeaders(),
          },
          body: JSON.stringify({ discountAmount: 99999 }),
        }),
        { params: Promise.resolve({ id: "partner-001" }) }
      );
      expect(response.status).toBe(403);
      expect(updatePartnerForApi).not.toHaveBeenCalled();
    });

    it("PATCH portal partner with portalTempPassword delegates to credential handler", async () => {
      const response = await partnerPortalPartnerPatch(
        new Request("http://localhost/api/partner-portal/partners/partner-001", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...serviceHeaders(),
          },
          body: JSON.stringify({
            portalTempPassword: "NewPortalPass1",
            portalAuthVersion: 2,
          }),
        }),
        { params: Promise.resolve({ id: "partner-001" }) }
      );
      expect(response.status).toBe(200);
      expect(updatePartnerForApi).toHaveBeenCalledWith(
        "partner-001",
        expect.objectContaining({
          portalTempPassword: "NewPortalPass1",
          portalAuthVersion: 2,
        })
      );
    });

    it("GET /api/partner-portal/events without secret returns 401", async () => {
      const response = await partnerPortalEventsGet(
        new Request("http://localhost/api/partner-portal/events")
      );
      expect(response.status).toBe(401);
    });

    it("GET /api/partner-portal/events with correct secret returns 200", async () => {
      const response = await partnerPortalEventsGet(
        new Request("http://localhost/api/partner-portal/events", {
          headers: serviceHeaders(),
        })
      );
      expect(response.status).toBe(200);
    });
  });

  describe("other admin routes", () => {
    it("POST /api/events without session returns 401", async () => {
      noSession();
      const response = await eventsPost(
        new Request("http://localhost/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: "Bangalore", title: "Event" }),
        })
      );
      expect(response.status).toBe(401);
      expect(createEventForApi).not.toHaveBeenCalled();
    });

    it("POST /api/spocs without session returns 401", async () => {
      noSession();
      const response = await spocsPost(
        new Request("http://localhost/api/spocs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "SPOC" }),
        })
      );
      expect(response.status).toBe(401);
      expect(createSpocForApi).not.toHaveBeenCalled();
    });

    it("POST /api/seminar-rosters without session returns 401", async () => {
      noSession();
      const response = await seminarRostersPost(
        new Request("http://localhost/api/seminar-rosters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: "evt-001", seminarId: "sem-001" }),
        })
      );
      expect(response.status).toBe(401);
      expect(upsertSeminarRosterForApi).not.toHaveBeenCalled();
    });

    it("GET /api/dashboard/registration-trend without session returns 401", async () => {
      noSession();
      const response = await dashboardTrendGet(
        new Request(
          "http://localhost/api/dashboard/registration-trend?from=2026-01-01&to=2026-01-31"
        )
      );
      expect(response.status).toBe(401);
    });
  });

  describe("preserved behavior", () => {
    it("GET /api/users with normal Admin session returns 403", async () => {
      adminCookie(activeUser.id);
      const response = await usersGet();
      expect(response.status).toBe(403);
    });

    it("GET /api/users with superuser session returns 200", async () => {
      adminCookie(activeSuperuser.id);
      const response = await usersGet();
      expect(response.status).toBe(200);
    });

    it("POST /api/send-otp remains reachable without session", async () => {
      noSession();
      const response = await sendOtpPost(
        new Request("http://localhost/api/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "9876543210",
            purpose: "student_registration",
          }),
        })
      );
      expect(response.status).not.toBe(401);
    });

    it("POST /api/verify-otp remains reachable without session", async () => {
      noSession();
      const response = await verifyOtpPost(
        new Request("http://localhost/api/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: "9876543210",
            purpose: "student_registration",
            code: "1234",
          }),
        })
      );
      expect(response.status).not.toBe(401);
    });

    it("POST /api/partner-portal/login remains reachable without service header", async () => {
      const response = await partnerPortalLoginPost(
        new Request("http://localhost/api/partner-portal/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: "partner@test.edu", password: "short" }),
        })
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe("Invalid login or password");
    });

    it("WhatsApp webhook GET rejects invalid verify token with 403", async () => {
      process.env.WHATSAPP_VERIFY_TOKEN = "expected-token";
      const response = await whatsappWebhookGet(
        new Request(
          "http://localhost/api/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123"
        )
      );
      expect(response.status).toBe(403);
    });

    it("WhatsApp webhook POST rejects invalid signature with 403", async () => {
      process.env.META_APP_SECRET = "meta-secret";
      const response = await whatsappWebhookPost(
        new Request("http://localhost/api/integrations/whatsapp/webhook", {
          method: "POST",
          headers: { "x-hub-signature-256": "sha256=invalid" },
          body: "{}",
        })
      );
      expect(response.status).toBe(403);
    });
  });
});
