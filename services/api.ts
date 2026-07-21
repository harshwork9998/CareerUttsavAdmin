import { delay, generateId } from "@/lib/utils";
import {
  createPartnerApi,
  deletePartnerApi,
  fetchAllPartners,
  fetchPartnerById,
  updatePartnerApi,
} from "@/lib/partners-api-client";
import {
  mockEvents,
  mockRegistrations,
  mockUniversities,
  mockSeminarRosters,
  mockUsers,
  mockRoles,
  mockActivityLogs,
  mockDashboardData,
  mockReports,
  mockSettings,
} from "@/lib/mock-data";
import { normalizeRegistration } from "@/features/registrations/normalize-registration";
import { isOperatingCity } from "@/lib/operating-cities";
import type {
  Event,
  Registration,
  University,
  Partner,
  SeminarSessionRoster,
  User,
  Role,
  ActivityLog,
  DashboardData,
  Report,
  Settings,
  SeminarBroadcastRequest,
  SeminarBroadcastResult,
} from "@/types";

const SIMULATED_DELAY = 400;

async function simulate<T>(data: T): Promise<T> {
  await delay(SIMULATED_DELAY);
  return data;
}

/** In-memory event store so create/update/delete persist for the session. */
let eventsStore: Event[] = [...mockEvents];

export const eventsService = {
  getAll: () => simulate([...eventsStore]),
  getById: (id: string) =>
    simulate(eventsStore.find((e) => e.id === id) ?? null),
  create: (event: Omit<Event, "id" | "createdAt" | "updatedAt">) => {
    if (!isOperatingCity(event.city)) {
      return Promise.reject(
        new Error("Event city must be Bangalore, Mysore, or Hubli")
      );
    }
    const created: Event = {
      ...event,
      id: generateId(),
      seminars: event.seminars ?? [],
      startTime: event.startTime ?? "09:00",
      endTime: event.endTime ?? "18:00",
      hallCount: event.hallCount ?? 1,
      venue: event.venue ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    eventsStore = [created, ...eventsStore];
    return simulate(created);
  },
  update: (id: string, data: Partial<Event>) => {
    if (data.city && !isOperatingCity(data.city)) {
      return Promise.reject(
        new Error("Event city must be Bangalore, Mysore, or Hubli")
      );
    }
    const existing = eventsStore.find((e) => e.id === id);
    if (!existing) {
      return simulate(null as unknown as Event);
    }
    const updated: Event = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    eventsStore = eventsStore.map((e) => (e.id === id ? updated : e));
    return simulate(updated);
  },
  delete: (id: string) => {
    eventsStore = eventsStore.filter((e) => e.id !== id);
    return simulate([...eventsStore]);
  },
};

export const registrationsService = {
  getAll: () => simulate(mockRegistrations.map(normalizeRegistration)),
  getById: (id: string) =>
    simulate(
      (() => {
        const row = mockRegistrations.find((r) => r.id === id);
        return row ? normalizeRegistration(row) : null;
      })()
    ),
  getByEvent: (eventId: string) =>
    simulate(
      mockRegistrations
        .filter((r) => r.eventId === eventId)
        .map(normalizeRegistration)
    ),
  update: (id: string, data: Partial<Registration>) =>
    simulate(
      normalizeRegistration({
        ...mockRegistrations.find((r) => r.id === id)!,
        ...data,
      })
    ),
};

export const universitiesService = {
  getAll: () => simulate([...mockUniversities]),
  getById: (id: string) => simulate(mockUniversities.find((u) => u.id === id) ?? null),
  getByEvent: (eventId: string) =>
    simulate(mockUniversities.filter((u) => u.eventIds.includes(eventId))),
  update: (id: string, data: Partial<University>) =>
    simulate({ ...mockUniversities.find((u) => u.id === id)!, ...data }),
};

export const partnersService = {
  getAll: async () => simulate(await fetchAllPartners()),
  getById: async (id: string) => simulate(await fetchPartnerById(id)),
  getByEvent: async (eventId: string) =>
    simulate((await fetchAllPartners()).filter((p) => p.eventIds.includes(eventId))),
  create: async (partner: Omit<Partner, "id" | "createdAt" | "updatedAt">) =>
    simulate(await createPartnerApi(partner)),
  update: async (id: string, data: Partial<Partner>) =>
    simulate(await updatePartnerApi(id, data)),
  delete: async (id: string) => simulate(await deletePartnerApi(id)),
};

let seminarRostersStore: SeminarSessionRoster[] = [...mockSeminarRosters];

export const seminarsService = {
  getRosters: () => simulate([...seminarRostersStore]),
  getRosterBySeminarId: (seminarId: string) =>
    simulate(
      seminarRostersStore.find((r) => r.seminarId === seminarId) ?? null
    ),
  upsertRoster: (roster: SeminarSessionRoster) => {
    const idx = seminarRostersStore.findIndex(
      (r) => r.seminarId === roster.seminarId
    );
    const next = { ...roster, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      seminarRostersStore = seminarRostersStore.map((r, i) =>
        i === idx ? next : r
      );
    } else {
      seminarRostersStore = [...seminarRostersStore, next];
    }
    return simulate(next);
  },
};

export const usersService = {
  getAll: () => simulate([...mockUsers]),
  getById: (id: string) => simulate(mockUsers.find((u) => u.id === id) ?? null),
  create: (user: Omit<User, "id" | "createdAt" | "updatedAt">) =>
    simulate({
      ...user,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as User),
  update: (id: string, data: Partial<User>) =>
    simulate({ ...mockUsers.find((u) => u.id === id)!, ...data, updatedAt: new Date().toISOString() }),
};

export const rolesService = {
  getAll: () => simulate([...mockRoles]),
};

export const activityLogsService = {
  getAll: () => simulate([...mockActivityLogs]),
};

export const dashboardService = {
  getData: () => simulate({ ...mockDashboardData }),
};

export const reportsService = {
  getAll: () => simulate([...mockReports]),
};

export const settingsService = {
  get: () => simulate({ ...mockSettings }),
  update: (data: Partial<Settings>) =>
    simulate({ ...mockSettings, ...data }),
};

export const messagingService = {
  sendSeminarBroadcast: (payload: SeminarBroadcastRequest) => {
    const sent = payload.recipientIds.length;
    const failed = payload.channel === "whatsapp" ? Math.min(1, sent > 0 ? 0 : 0) : 0;
    const result: SeminarBroadcastResult = {
      channel: payload.channel,
      sent: Math.max(0, sent - failed),
      failed,
      batchId: `batch-${generateId()}`,
    };
    return simulate(result);
  },
};
