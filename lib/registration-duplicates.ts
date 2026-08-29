import { isStudentRegistration } from "@/lib/registration-kinds";
import type { Registration, StudentRegistration } from "@/types";

export const DUPLICATE_STUDENT_REGISTRATION_MESSAGE =
  "It looks like you've already registered for this event with this mobile number or email. No need to register again; we've got you covered!";

export const STUDENT_REGISTRATION_CONFLICT_MESSAGE =
  "We couldn't complete this registration because your WhatsApp number and email are linked to different existing registrations. Please contact support for help.";

export type StudentRegistrationDuplicateResolution =
  | { outcome: "none" }
  | { outcome: "phone"; registration: StudentRegistration }
  | { outcome: "email"; registration: StudentRegistration }
  | { outcome: "both"; registration: StudentRegistration }
  | { outcome: "conflict" };

export function normalizeRegistrationEmail(email: string | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function normalizeRegistrationPhone(phone: string | undefined): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.slice(-10);
}

function matchesEvent(
  registration: StudentRegistration,
  eventId: string
): boolean {
  return !eventId || registration.eventId === eventId;
}

function matchesExclude(
  registration: StudentRegistration,
  excludeId?: string
): boolean {
  return !excludeId || registration.id !== excludeId;
}

export function findStudentRegistrationByPhone(
  registrations: Registration[],
  input: {
    eventId?: string;
    phone?: string;
    excludeId?: string;
  }
): StudentRegistration | null {
  const eventId = input.eventId?.trim() ?? "";
  const phone = normalizeRegistrationPhone(input.phone);
  if (phone.length < 10) {
    return null;
  }

  for (const registration of registrations) {
    if (!isStudentRegistration(registration)) continue;
    if (!matchesEvent(registration, eventId)) continue;
    if (!matchesExclude(registration, input.excludeId)) continue;
    if (normalizeRegistrationPhone(registration.phone) === phone) {
      return registration;
    }
  }

  return null;
}

export function findStudentRegistrationByEmail(
  registrations: Registration[],
  input: {
    eventId?: string;
    email?: string;
    excludeId?: string;
  }
): StudentRegistration | null {
  const eventId = input.eventId?.trim() ?? "";
  const email = normalizeRegistrationEmail(input.email);
  if (!email) {
    return null;
  }

  for (const registration of registrations) {
    if (!isStudentRegistration(registration)) continue;
    if (!matchesEvent(registration, eventId)) continue;
    if (!matchesExclude(registration, input.excludeId)) continue;
    if (normalizeRegistrationEmail(registration.email) === email) {
      return registration;
    }
  }

  return null;
}

export function resolveStudentRegistrationDuplicateResolution(
  phoneMatch: StudentRegistration | null,
  emailMatch: StudentRegistration | null
): StudentRegistrationDuplicateResolution {
  if (!phoneMatch && !emailMatch) {
    return { outcome: "none" };
  }

  if (phoneMatch && emailMatch) {
    if (phoneMatch.id === emailMatch.id) {
      return { outcome: "both", registration: phoneMatch };
    }
    return { outcome: "conflict" };
  }

  if (phoneMatch) {
    return { outcome: "phone", registration: phoneMatch };
  }

  return { outcome: "email", registration: emailMatch! };
}

export function duplicateResolutionToRegistration(
  resolution: StudentRegistrationDuplicateResolution
): StudentRegistration | null {
  switch (resolution.outcome) {
    case "phone":
    case "email":
    case "both":
      return resolution.registration;
    default:
      return null;
  }
}

export function findStudentRegistrationDuplicate(
  registrations: Registration[],
  input: {
    eventId?: string;
    email?: string;
    phone?: string;
    excludeId?: string;
  }
): StudentRegistration | null {
  const email = normalizeRegistrationEmail(input.email);
  const phone = normalizeRegistrationPhone(input.phone);

  if (!email && phone.length < 10) {
    return null;
  }

  const phoneMatch = findStudentRegistrationByPhone(registrations, input);
  const emailMatch = email
    ? findStudentRegistrationByEmail(registrations, input)
    : null;

  const resolution = resolveStudentRegistrationDuplicateResolution(
    phoneMatch,
    emailMatch
  );

  if (resolution.outcome === "conflict" && phoneMatch) {
    return phoneMatch;
  }

  return duplicateResolutionToRegistration(resolution);
}
