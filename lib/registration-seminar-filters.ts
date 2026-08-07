import { seminarMatchKey } from "@/features/dashboard/seminars";
import { isStudentRegistration } from "@/lib/registration-kinds";
import { getPrimarySeminar } from "@/lib/enrich-registration";
import type { Registration } from "@/types";

/** Seminar titles stored on a registration (explicit picks or inferred primary). */
export function getRegistrationSeminarInterests(
  registration: Registration
): string[] {
  if (!isStudentRegistration(registration)) return [];
  const fromInterests = (registration.seminarInterests ?? [])
    .map((title) => title.trim())
    .filter(Boolean);
  if (fromInterests.length > 0) return fromInterests;

  const primary = getPrimarySeminar(registration);
  return primary !== "—" ? [primary] : [];
}

/** True when the student is registered for every seminar in `requiredSeminars`. */
export function registrationMatchesAllSeminars(
  registration: Registration,
  requiredSeminars: string[]
): boolean {
  if (requiredSeminars.length === 0) return true;

  const interests = new Set(
    getRegistrationSeminarInterests(registration).map(seminarMatchKey)
  );

  return requiredSeminars.every((seminar) =>
    interests.has(seminarMatchKey(seminar))
  );
}

export function slugifySeminarFilters(seminars: string[]): string {
  const slug = seminars
    .map((title) =>
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24)
    )
    .filter(Boolean)
    .join("-and-");
  return slug || "filtered";
}
