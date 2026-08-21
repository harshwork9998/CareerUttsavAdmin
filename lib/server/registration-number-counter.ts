import type { RegistrationKind } from "@/types";

/** Counter prefixes for new Bangalore (evt-001) registrations. */
export function registrationCounterPrefix(kind: RegistrationKind): string {
  switch (kind) {
    case "student":
      return "CU-BLR-2026-";
    case "school":
      return "CU-SCH-BLR-2026-";
    case "partner_registration":
      return "CU-PTR-BLR-2026-";
    case "student_ambassador":
      return "CU-AMB-BLR-2026-";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function formatRegistrationNumber(
  prefix: string,
  sequence: number
): string {
  return `${prefix}${String(sequence).padStart(5, "0")}`;
}
