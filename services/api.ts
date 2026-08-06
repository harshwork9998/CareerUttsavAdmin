import { delay, generateId } from "@/lib/utils";
import {
  createPartnerApi,
  deletePartnerApi,
  fetchAllPartners,
  fetchPartnerById,
  updatePartnerApi,
} from "@/lib/partners-api-client";
import {
  createSpocApi,
  deleteSpocApi,
  fetchAllSpocs,
  updateSpocApi,
} from "@/lib/spocs-api-client";
import {
  createEventApi,
  deleteEventApi,
  fetchAllEvents,
  fetchEventById,
  updateEventApi,
} from "@/lib/events-api-client";
import {
  mockUniversities,
  mockDashboardData,
} from "@/lib/mock-data";
import {
  createRegistrationApi,
  deleteRegistrationApi,
  fetchAllRegistrations,
  fetchRegistrationById,
  updateRegistrationApi,
} from "@/lib/registrations-api-client";
import {
  createUserApi,
  fetchAllUsers,
  reviewUserApi,
  updateUserApi,
} from "@/lib/users-api-client";
import type { CreateRegistrationInput } from "@/lib/registration-validation";
import {
  fetchAllSeminarRosters,
  upsertSeminarRosterApi,
} from "@/lib/seminar-rosters-api-client";
import { buildDashboardData } from "@/lib/build-dashboard-data";
import type {
  Event,
  Registration,
  University,
  Partner,
  Spoc,
  SeminarSessionRoster,
  User,
  DashboardData,
  SeminarBroadcastRequest,
  SeminarBroadcastResult,
} from "@/types";

const SIMULATED_DELAY = 400;

async function simulate<T>(data: T | Promise<T>): Promise<T> {
  await delay(SIMULATED_DELAY);
  return await data;
}

async function getResolvedRegistrations(): Promise<Registration[]> {
  return fetchAllRegistrations();
}

export const eventsService = {
  getAll: () => simulate(fetchAllEvents()),
  getById: (id: string) => simulate(fetchEventById(id)),
  create: (event: Omit<Event, "id" | "createdAt" | "updatedAt">) => {
    const city = event.city?.trim() ?? "";
    if (city.length < 2) {
      return Promise.reject(new Error("Event city is required (at least 2 characters)"));
    }
    return simulate(createEventApi({ ...event, city }));
  },
  update: (id: string, data: Partial<Event>) => {
    if (data.city !== undefined && data.city.trim().length < 2) {
      return Promise.reject(
        new Error("Event city is required (at least 2 characters)")
      );
    }
    return simulate(updateEventApi(id, data));
  },
  delete: (id: string) => simulate(deleteEventApi(id)),
};

export const registrationsService = {
  getAll: () => simulate(fetchAllRegistrations()),
  getById: (id: string) => simulate(fetchRegistrationById(id)),
  getByEvent: async (eventId: string) =>
    simulate(
      (await fetchAllRegistrations()).filter(
        (registration) => registration.eventId === eventId
      )
    ),
  create: (data: CreateRegistrationInput) =>
    simulate(createRegistrationApi(data)),
  update: (id: string, data: Partial<Registration>) =>
    simulate(updateRegistrationApi(id, data)),
  delete: (id: string) => simulate(deleteRegistrationApi(id)),
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

export const spocsService = {
  getAll: async () => simulate(await fetchAllSpocs()),
  create: async (data: Pick<Spoc, "name" | "phone" | "email">) =>
    simulate(await createSpocApi(data)),
  update: async (
    id: string,
    data: Partial<Pick<Spoc, "name" | "phone" | "email">>
  ) => simulate(await updateSpocApi(id, data)),
  delete: async (id: string) => simulate(await deleteSpocApi(id)),
};

export const seminarsService = {
  getRosters: () => simulate(fetchAllSeminarRosters()),
  getRosterBySeminarId: async (seminarId: string, eventId?: string) =>
    simulate(
      (await fetchAllSeminarRosters()).find((roster) =>
        eventId
          ? roster.seminarId === seminarId && roster.eventId === eventId
          : roster.seminarId === seminarId
      ) ?? null
    ),
  upsertRoster: (roster: SeminarSessionRoster) =>
    simulate(upsertSeminarRosterApi(roster)),
};

export const usersService = {
  getAll: () => simulate(fetchAllUsers()),
  getById: async (id: string) =>
    simulate((await fetchAllUsers()).find((u) => u.id === id) ?? null),
  create: (user: Omit<User, "id" | "createdAt" | "updatedAt">) =>
    simulate(createUserApi(user)),
  update: (id: string, data: Partial<User>) =>
    simulate(updateUserApi(id, data)),
  review: (
    id: string,
    payload: { action: "approve" | "reject"; role?: "user" | "superuser" }
  ) => simulate(reviewUserApi(id, payload)),
};

export const dashboardService = {
  getData: async () => {
    const [registrations, events, partners] = await Promise.all([
      getResolvedRegistrations(),
      fetchAllEvents(),
      fetchAllPartners(),
    ]);
    return simulate(
      buildDashboardData(
        mockDashboardData,
        registrations,
        events,
        partners
      )
    );
  },
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
