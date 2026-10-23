import { normalizeIndianMobileInput } from "@/lib/indian-mobile";
import {
  normalizeRegistrationEmail,
  normalizeRegistrationPhone,
} from "@/lib/registration-duplicates";
import type { RegistrationSource } from "@/lib/registration-source";
import { formatDateTime } from "@/lib/utils";

export const REGISTRATION_ATTEMPT_SOURCES = ["WHATSAPP", "WEBSITE"] as const;
export type RegistrationAttemptSource =
  (typeof REGISTRATION_ATTEMPT_SOURCES)[number];

export const REGISTRATION_ATTEMPT_STATUSES = [
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
] as const;
export type RegistrationAttemptStatus =
  (typeof REGISTRATION_ATTEMPT_STATUSES)[number];

export const REGISTRATION_ATTEMPT_STEPS = [
  "WELCOME",
  "STARTED",
  "NAME",
  "EMAIL",
  "CLASS",
  "GENDER",
  "BOARD",
  "STREAM",
  "SCHOOL_COLLEGE",
  "CITY",
  "SEMINAR_SELECTION",
  "FINISH_REGISTRATION",
  "YOU",
  "ACADEMICS",
  "INTERESTS",
] as const;
export type RegistrationAttemptStep =
  (typeof REGISTRATION_ATTEMPT_STEPS)[number];

export const REGISTRATION_ATTEMPT_STEP_LABELS: Record<
  RegistrationAttemptStep,
  string
> = {
  WELCOME: "Welcome",
  STARTED: "Started",
  NAME: "Name",
  EMAIL: "Email",
  CLASS: "Class",
  GENDER: "Gender",
  BOARD: "Board",
  STREAM: "Stream",
  SCHOOL_COLLEGE: "School / College",
  CITY: "City",
  SEMINAR_SELECTION: "Seminar Selection",
  FINISH_REGISTRATION: "Finish Registration",
  YOU: "You",
  ACADEMICS: "Academics",
  INTERESTS: "Interests",
};

export const REGISTRATION_ATTEMPT_STATUS_LABELS: Record<
  RegistrationAttemptStatus,
  string
> = {
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

export const ATTEMPT_SOURCE_LABELS: Record<RegistrationAttemptSource, string> = {
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website",
};

export const PARTIAL_REGISTRATION_EXPORT_HEADERS = [
  "Started On",
  "Pass ID",
  "Source",
  "Name",
  "Contact Number",
  "Email",
  "Class",
  "City",
  "Last Step",
  "Last Activity",
  "Status",
] as const;

export const DEFAULT_PARTIAL_ATTEMPT_STATUSES: RegistrationAttemptStatus[] = [
  "IN_PROGRESS",
  "ABANDONED",
];

export type RegistrationAttemptRecord = {
  id: string;
  eventId: string;
  source: RegistrationAttemptSource;
  status: RegistrationAttemptStatus;
  phone: string;
  phoneLast10: string | null;
  email: string | null;
  emailNormalized: string | null;
  name: string | null;
  classLabel: string | null;
  gender: "Male" | "Female" | "Other" | null;
  board: string | null;
  interestedStream: string | null;
  college: string | null;
  city: string | null;
  seminarInterests: string[];
  lastStep: RegistrationAttemptStep;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  completedRegistrationId: string | null;
  whatsappWaId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PartialRegistrationView = {
  id: string;
  startedOn: string;
  passId: string;
  source: string;
  name: string;
  phone: string;
  email: string;
  classLabel: string;
  city: string;
  lastStep: string;
  lastActivity: string;
  status: string;
};

const WHATSAPP_STEP_BY_CONVERSATION: Record<string, RegistrationAttemptStep> = {
  AWAITING_START: "WELCOME",
  AWAITING_NAME: "STARTED",
  AWAITING_EMAIL: "NAME",
  AWAITING_CLASS: "EMAIL",
  AWAITING_GENDER: "CLASS",
  AWAITING_BOARD: "GENDER",
  AWAITING_STREAM: "BOARD",
  AWAITING_COLLEGE: "STREAM",
  AWAITING_CITY: "SCHOOL_COLLEGE",
  AWAITING_SEMINARS: "CITY",
  AWAITING_SEMINAR_FINISH: "SEMINAR_SELECTION",
  READY_TO_REGISTER: "FINISH_REGISTRATION",
  COMPLETED: "FINISH_REGISTRATION",
};

export function lastStepForWhatsAppConversation(
  currentStep: string
): RegistrationAttemptStep | null {
  return WHATSAPP_STEP_BY_CONVERSATION[currentStep] ?? null;
}

export function phoneIdentityFromWaId(waId: string): {
  phone: string;
  phoneLast10: string | null;
} {
  const normalized = normalizeIndianMobileInput(waId);
  if (normalized) {
    return { phone: normalized, phoneLast10: normalized };
  }
  const digits = waId.replace(/\D/g, "");
  const phoneLast10 = digits.length >= 10 ? digits.slice(-10) : null;
  return { phone: digits || waId, phoneLast10 };
}

export function normalizeAttemptPhone(phone: string | null | undefined): {
  phone: string;
  phoneLast10: string | null;
} {
  const normalized = normalizeIndianMobileInput(phone ?? "");
  if (normalized) {
    return { phone: normalized, phoneLast10: normalized };
  }
  const last10 = normalizeRegistrationPhone(phone ?? "");
  return {
    phone: (phone ?? "").trim(),
    phoneLast10: last10.length >= 10 ? last10 : null,
  };
}

export function normalizeAttemptEmail(
  email: string | null | undefined
): string | null {
  const normalized = normalizeRegistrationEmail(email ?? "");
  return normalized.length > 0 ? normalized : null;
}

export function isVisiblePartialStatus(
  status: RegistrationAttemptStatus
): boolean {
  return status === "IN_PROGRESS" || status === "ABANDONED";
}

export function countVisiblePartialAttempts(
  attempts: Pick<RegistrationAttemptRecord, "status">[]
): number {
  return attempts.filter((attempt) => isVisiblePartialStatus(attempt.status))
    .length;
}

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "—";
}

export function toPartialRegistrationView(
  attempt: RegistrationAttemptRecord,
  registrationNumber?: string | null
): PartialRegistrationView {
  const passId =
    attempt.status === "COMPLETED" && registrationNumber?.trim()
      ? registrationNumber.trim()
      : "—";
  return {
    id: attempt.id,
    startedOn: formatDateTime(attempt.startedAt),
    passId,
    source: ATTEMPT_SOURCE_LABELS[attempt.source],
    name: displayOrDash(attempt.name),
    phone: displayOrDash(attempt.phone),
    email: displayOrDash(attempt.email),
    classLabel: displayOrDash(attempt.classLabel),
    city: displayOrDash(attempt.city),
    lastStep: REGISTRATION_ATTEMPT_STEP_LABELS[attempt.lastStep],
    lastActivity: formatDateTime(attempt.lastActivityAt),
    status: REGISTRATION_ATTEMPT_STATUS_LABELS[attempt.status],
  };
}

export function partialRegistrationExportRow(
  view: PartialRegistrationView
): string[] {
  return [
    view.startedOn,
    view.passId,
    view.source,
    view.name,
    view.phone,
    view.email,
    view.classLabel,
    view.city,
    view.lastStep,
    view.lastActivity,
    view.status,
  ];
}

export function partialRegistrationMatchesSearch(
  attempt: RegistrationAttemptRecord,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const view = toPartialRegistrationView(attempt);
  const haystack = [
    attempt.name,
    attempt.phone,
    attempt.phoneLast10,
    attempt.email,
    attempt.classLabel,
    attempt.city,
    view.source,
    view.lastStep,
    view.status,
    attempt.source,
    attempt.lastStep,
    attempt.status,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function registrationSourceSearchText(
  source: RegistrationSource | null | undefined
): string {
  if (source === "WHATSAPP") return "WhatsApp";
  if (source === "WEBSITE") return "Website";
  if (source === "DIRECT_ENTRY") return "Direct Entry";
  return "Unknown";
}

export function attemptsMatchForAbandon(input: {
  attempt: RegistrationAttemptRecord;
  eventId: string;
  phoneLast10: string | null;
  emailNormalized: string | null;
  excludeAttemptId?: string | null;
}): boolean {
  const { attempt } = input;
  if (attempt.status !== "IN_PROGRESS") return false;
  if (attempt.eventId !== input.eventId) return false;
  if (input.excludeAttemptId && attempt.id === input.excludeAttemptId) {
    return false;
  }
  const phoneMatches =
    Boolean(input.phoneLast10) &&
    attempt.phoneLast10 === input.phoneLast10;
  const emailMatches =
    Boolean(input.emailNormalized) &&
    attempt.emailNormalized === input.emailNormalized;
  return phoneMatches || emailMatches;
}
