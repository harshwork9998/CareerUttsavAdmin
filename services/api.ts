import { delay } from "@/lib/utils";
import {
  mockEvents,
  mockRegistrations,
  mockUniversities,
  mockPartners,
  mockUsers,
  mockRoles,
  mockActivityLogs,
  mockDashboardData,
  mockReports,
  mockSettings,
} from "@/lib/mock-data";
import { normalizeRegistration } from "@/features/registrations/normalize-registration";
import type {
  Event,
  Registration,
  University,
  Partner,
  User,
  Role,
  ActivityLog,
  DashboardData,
  Report,
  Settings,
} from "@/types";
import { generateId } from "@/lib/utils";

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

let partnersStore: Partner[] = [...mockPartners];

export const partnersService = {
  getAll: () => simulate([...partnersStore]),
  getById: (id: string) =>
    simulate(partnersStore.find((p) => p.id === id) ?? null),
  getByEvent: (eventId: string) =>
    simulate(partnersStore.filter((p) => p.eventIds.includes(eventId))),
  create: (partner: Omit<Partner, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    const created: Partner = {
      ...partner,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    partnersStore = [created, ...partnersStore];
    return simulate(created);
  },
  update: (id: string, data: Partial<Partner>) => {
    const now = new Date().toISOString();
    partnersStore = partnersStore.map((p) =>
      p.id === id ? { ...p, ...data, updatedAt: now } : p
    );
    return simulate(partnersStore.find((p) => p.id === id) ?? null);
  },
  delete: (id: string) => {
    partnersStore = partnersStore.filter((p) => p.id !== id);
    return simulate([...partnersStore]);
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
