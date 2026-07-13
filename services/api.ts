import { delay } from "@/lib/utils";
import {
  mockEvents,
  mockRegistrations,
  mockUniversities,
  mockPartners,
  mockBlogs,
  mockGalleryImages,
  mockNotifications,
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
  Blog,
  GalleryImage,
  Notification,
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

export const partnersService = {
  getAll: () => simulate([...mockPartners]),
  getById: (id: string) => simulate(mockPartners.find((p) => p.id === id) ?? null),
  update: (id: string, data: Partial<Partner>) =>
    simulate({ ...mockPartners.find((p) => p.id === id)!, ...data }),
};

export const blogsService = {
  getAll: () => simulate([...mockBlogs]),
  getById: (id: string) => simulate(mockBlogs.find((b) => b.id === id) ?? null),
  create: (blog: Omit<Blog, "id" | "createdAt" | "updatedAt" | "viewCount">) =>
    simulate({
      ...blog,
      id: generateId(),
      viewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Blog),
  update: (id: string, data: Partial<Blog>) =>
    simulate({ ...mockBlogs.find((b) => b.id === id)!, ...data, updatedAt: new Date().toISOString() }),
};

export const galleryService = {
  getAll: () => simulate([...mockGalleryImages]),
  create: (image: Omit<GalleryImage, "id" | "uploadedAt">) =>
    simulate({
      ...image,
      id: generateId(),
      uploadedAt: new Date().toISOString(),
    } as GalleryImage),
  update: (id: string, data: Partial<GalleryImage>) =>
    simulate({ ...mockGalleryImages.find((g) => g.id === id)!, ...data }),
};

export const notificationsService = {
  getAll: () => simulate([...mockNotifications]),
  create: (notification: Omit<Notification, "id" | "createdAt">) =>
    simulate({
      ...notification,
      id: generateId(),
      createdAt: new Date().toISOString(),
    } as Notification),
  update: (id: string, data: Partial<Notification>) =>
    simulate({ ...mockNotifications.find((n) => n.id === id)!, ...data }),
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
