import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE_ID_BY_NAME } from "@/constants";
import type { User } from "@/types";

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

vi.mock("@/lib/server/event-service", () => ({
  listEventsForApi: vi.fn(async () => []),
  getEventForApi: vi.fn(async () => null),
}));

vi.mock("@/lib/server/event-write-service", () => ({
  createEventForApi: vi.fn(),
  patchEventForApi: vi.fn(),
  deleteEventForApi: vi.fn(),
}));

vi.mock("@/lib/server/admin-user-service", () => ({
  findAdminUserById: vi.fn(),
  getAdminUserAuthVersion: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { POST } from "@/app/api/events/route";
import {
  DELETE as DELETE_BY_ID,
  PATCH as PATCH_BY_ID,
} from "@/app/api/events/[id]/route";
import { EVENT_ADMIN_UNAVAILABLE_MESSAGE } from "@/lib/server/event-write-guard";
import {
  createEventForApi,
  deleteEventForApi,
  patchEventForApi,
} from "@/lib/server/event-write-service";
import {
  findAdminUserById,
  getAdminUserAuthVersion,
} from "@/lib/server/admin-user-service";
import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
} from "@/lib/server/admin-session";

const sampleEvent = {
  id: "evt-new",
  title: "Test Event",
  slug: "test-event",
  description: "Desc",
  status: "Draft" as const,
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
  createdBy: "usr-001",
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
};

describe("event write freeze routes", () => {
  const originalRegistration = process.env.REGISTRATION_PERSISTENCE;
  const originalEventWrite = process.env.EVENT_WRITE_PERSISTENCE;
  const originalAdminSecret = process.env.ADMIN_SESSION_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-value";
    vi.mocked(getAdminUserAuthVersion).mockResolvedValue(0);
    vi.mocked(findAdminUserById).mockResolvedValue(activeSuperuser);
    const token = createAdminSessionToken({
      userId: activeSuperuser.id,
      authVersion: 0,
    });
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) =>
        name === ADMIN_SESSION_COOKIE ? { name, value: token } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
    vi.mocked(createEventForApi).mockResolvedValue({ ok: true, data: sampleEvent });
    vi.mocked(patchEventForApi).mockResolvedValue({
      ok: true,
      data: { ...sampleEvent, id: "evt-001", title: "Updated" },
    });
    vi.mocked(deleteEventForApi).mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    if (originalRegistration === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = originalRegistration;
    }
    if (originalEventWrite === undefined) {
      delete process.env.EVENT_WRITE_PERSISTENCE;
    } else {
      process.env.EVENT_WRITE_PERSISTENCE = originalEventWrite;
    }
    if (originalAdminSecret === undefined) {
      delete process.env.ADMIN_SESSION_SECRET;
    } else {
      process.env.ADMIN_SESSION_SECRET = originalAdminSecret;
    }
  });

  it("allows POST in json registration mode", async () => {
    delete process.env.REGISTRATION_PERSISTENCE;
    const response = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Event",
          slug: "test-event",
          description: "Desc",
          status: "Draft",
          venue: "Venue",
          address: "Address",
          city: "Bangalore",
          state: "Karnataka",
          pincode: "560001",
          startDate: "2026-08-15",
          endDate: "2026-08-16",
          hallCount: 1,
          seminars: [],
          registrationDeadline: "2026-08-10T23:59:59+05:30",
          maxCapacity: 100,
          registrationCount: 0,
          checkInCount: 0,
          isFeatured: false,
          tags: [],
          createdBy: "usr-001",
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(createEventForApi).toHaveBeenCalledOnce();
  });

  it("blocks POST when registration is prisma and event write is unset", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    delete process.env.EVENT_WRITE_PERSISTENCE;
    const response = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: "Bangalore" }),
      })
    );
    expect(response.status).toBe(503);
    expect(createEventForApi).not.toHaveBeenCalled();
  });

  it("allows POST when event write persistence is prisma", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    process.env.EVENT_WRITE_PERSISTENCE = "prisma";
    const response = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Event",
          slug: "test-event",
          description: "Desc",
          status: "Draft",
          venue: "Venue",
          address: "Address",
          city: "Bangalore",
          state: "Karnataka",
          pincode: "560001",
          startDate: "2026-08-15",
          endDate: "2026-08-16",
          hallCount: 1,
          seminars: [],
          registrationDeadline: "2026-08-10T23:59:59+05:30",
          maxCapacity: 100,
          isFeatured: false,
          tags: [],
          createdBy: "usr-001",
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(createEventForApi).toHaveBeenCalledOnce();
  });

  it("blocks PATCH when registration is prisma and event write is json", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    process.env.EVENT_WRITE_PERSISTENCE = "json";
    const response = await PATCH_BY_ID(
      new Request("http://localhost/api/events/evt-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ id: "evt-001" }) }
    );
    expect(response.status).toBe(503);
    expect(patchEventForApi).not.toHaveBeenCalled();
  });

  it("allows PATCH when event write persistence is prisma", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    process.env.EVENT_WRITE_PERSISTENCE = "prisma";
    const response = await PATCH_BY_ID(
      new Request("http://localhost/api/events/evt-001", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: Promise.resolve({ id: "evt-001" }) }
    );
    expect(response.status).toBe(200);
    expect(patchEventForApi).toHaveBeenCalledOnce();
  });

  it("blocks DELETE when registration is prisma and event write unset", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    const response = await DELETE_BY_ID(
      new Request("http://localhost/api/events/evt-001", { method: "DELETE" }),
      { params: Promise.resolve({ id: "evt-001" }) }
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: EVENT_ADMIN_UNAVAILABLE_MESSAGE,
    });
    expect(deleteEventForApi).not.toHaveBeenCalled();
  });
});
