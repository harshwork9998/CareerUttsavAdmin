import type { Registration } from "@/types";

export function isCheckedInRegistration(registration: Registration): boolean {
  if (registration.status === "Checked In") return true;
  return Boolean(registration.checkInTime);
}

export function studentRegistrationsForEvent(
  registrations: Registration[]
): Registration[] {
  return registrations.filter((registration) => registration.kind === "student");
}

export function studentCheckInCount(registrations: Registration[]): number {
  return studentRegistrationsForEvent(registrations).filter(
    isCheckedInRegistration
  ).length;
}
