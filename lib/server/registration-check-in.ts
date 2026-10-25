import { resolveRegistration } from "@/lib/enrich-registration";
import { listEventsForApi } from "@/lib/server/event-service";
import { registrationToCheckInView } from "@/lib/server/registration-check-in-map";
import type {
  RegistrationCheckInPayload,
  RegistrationCheckInServiceResult,
} from "@/lib/server/registration-check-in-types";
import { isPrismaRegistrationPersistence } from "@/lib/server/registration-persistence-mode";
import { checkInPrismaRegistration } from "@/lib/server/registration-prisma-store";
import {
  loadRawRegistrations,
  saveRegistrations,
} from "@/lib/server/registrations-persistence";

export function resolveCheckInIdentifiers(
  input: RegistrationCheckInPayload
): { eventId: string; registrationNumber?: string; registrationId?: string } | null {
  const eventId = input.eventId?.trim() ?? "";
  if (!eventId) return null;

  const qr = input.qrPayload?.trim();
  if (qr) {
    return { eventId, registrationNumber: qr };
  }

  const registrationNumber = input.registrationNumber?.trim();
  if (registrationNumber) {
    return { eventId, registrationNumber };
  }

  const registrationId = input.registrationId?.trim();
  if (registrationId) {
    return { eventId, registrationId };
  }

  return null;
}

async function jsonCheckInRegistration(input: {
  eventId: string;
  registrationNumber?: string;
  registrationId?: string;
}): Promise<RegistrationCheckInServiceResult> {
  const events = await listEventsForApi();
  const registrations = loadRawRegistrations();
  const idx = registrations.findIndex((entry) => {
    if (input.registrationNumber) {
      return entry.registrationNumber === input.registrationNumber;
    }
    if (input.registrationId) {
      return entry.id === input.registrationId;
    }
    return false;
  });

  if (idx === -1) {
    return {
      ok: false,
      code: "invalid_registration",
      message: "Registration not found",
      status: 404,
    };
  }

  const existing = registrations[idx];
  const resolvedExisting = resolveRegistration(existing, events);

  if (existing.eventId !== input.eventId) {
    return {
      ok: false,
      code: "event_mismatch",
      message: "This registration belongs to a different event",
      status: 409,
    };
  }

  if (existing.status === "Checked In") {
    return {
      ok: true,
      data: registrationToCheckInView(resolvedExisting, true),
    };
  }

  if (existing.status !== "Confirmed") {
    return {
      ok: true,
      data: registrationToCheckInView(resolvedExisting, true),
    };
  }

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    status: "Checked In" as const,
    checkInTime: now,
    updatedAt: now,
  };

  const next = [...registrations];
  next[idx] = updated;
  saveRegistrations(next);

  return {
    ok: true,
    data: registrationToCheckInView(
      resolveRegistration(updated, events),
      false
    ),
  };
}

export async function checkInRegistrationForApi(
  input: RegistrationCheckInPayload
): Promise<RegistrationCheckInServiceResult> {
  const resolved = resolveCheckInIdentifiers(input);
  if (!resolved) {
    return {
      ok: false,
      code: "invalid_request",
      message: "eventId and a registration identifier are required",
      status: 400,
    };
  }

  if (isPrismaRegistrationPersistence()) {
    const result = await checkInPrismaRegistration(resolved);
    if (result.outcome === "not_found") {
      return {
        ok: false,
        code: "invalid_registration",
        message: "Registration not found",
        status: 404,
      };
    }
    if (result.outcome === "event_mismatch") {
      return {
        ok: false,
        code: "event_mismatch",
        message: "This registration belongs to a different event",
        status: 409,
      };
    }
    const alreadyCheckedIn = result.outcome === "already_checked_in";
    return {
      ok: true,
      data: registrationToCheckInView(result.registration, alreadyCheckedIn),
    };
  }

  return jsonCheckInRegistration(resolved);
}
