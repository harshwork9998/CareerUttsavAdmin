import { isStudentRegistration } from "@/lib/registration-kinds";
import type { Registration, StudentRegistration } from "@/types";

export const DUPLICATE_STUDENT_REGISTRATION_MESSAGE =
  "It looks like you've already registered for this event with this mobile number or email. No need to register again; we've got you covered!";

export function normalizeRegistrationEmail(email: string | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function normalizeRegistrationPhone(phone: string | undefined): string {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.slice(-10);
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
  const eventId = input.eventId?.trim() ?? "";
  const email = normalizeRegistrationEmail(input.email);
  const phone = normalizeRegistrationPhone(input.phone);

  if (!email && phone.length < 10) {
    return null;
  }

  for (const registration of registrations) {
    if (!isStudentRegistration(registration)) continue;
    if (eventId && registration.eventId !== eventId) continue;
    if (input.excludeId && registration.id === input.excludeId) continue;

    const emailMatch =
      email.length > 0 &&
      normalizeRegistrationEmail(registration.email) === email;
    const phoneMatch =
      phone.length >= 10 &&
      normalizeRegistrationPhone(registration.phone) === phone;

    if (emailMatch || phoneMatch) {
      return registration;
    }
  }

  return null;
}
