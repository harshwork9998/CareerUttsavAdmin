import { getRegistrationDisplayName } from "@/features/registrations/registration-table-config";
import { isStudentRegistration } from "@/lib/registration-kinds";
import { canonicalizeClassLabel } from "@/lib/registration-validation";
import type { RegistrationCheckInView } from "@/lib/server/registration-check-in-types";
import type { Registration } from "@/types";

export function maskPhoneForCheckIn(phone: string | undefined): string | undefined {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  const last4 = digits.slice(-4);
  return `******${last4}`;
}

function classLabelForCheckIn(registration: Registration): string | undefined {
  if (isStudentRegistration(registration)) {
    return canonicalizeClassLabel(registration.classLabel) || undefined;
  }
  if (registration.kind === "student_ambassador") {
    return canonicalizeClassLabel(registration.ambassadorClass) || undefined;
  }
  return undefined;
}

function phoneForCheckIn(registration: Registration): string | undefined {
  if (isStudentRegistration(registration)) return registration.phone;
  if (registration.kind === "student_ambassador") {
    return registration.ambassadorPhone;
  }
  return undefined;
}

export function registrationToCheckInView(
  registration: Registration,
  alreadyCheckedIn: boolean
): RegistrationCheckInView {
  return {
    id: registration.id,
    registrationNumber: registration.registrationNumber,
    studentName: getRegistrationDisplayName(registration),
    classLabel: classLabelForCheckIn(registration),
    phoneMasked: maskPhoneForCheckIn(phoneForCheckIn(registration)),
    status: registration.status,
    checkInTime: registration.checkInTime,
    eventId: registration.eventId,
    eventTitle: registration.eventTitle,
    alreadyCheckedIn,
  };
}
