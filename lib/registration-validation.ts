import { nextRegistrationNumber } from "@/lib/registration-number";
import type {
  Event,
  PartnerRegistrationEntry,
  Registration,
  RegistrationKind,
  SchoolRegistration,
  StudentAmbassadorRegistration,
  StudentRegistration,
} from "@/types";

export const MAX_SEMINAR_INTERESTS = 3;

export const REGISTRATION_CLASS_OPTIONS = [
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
] as const;

export const REGISTRATION_STREAM_OPTIONS = [
  "Science",
  "Commerce",
  "Arts",
] as const;

export const REGISTRATION_BOARD_OPTIONS = [
  "CBSE",
  "State Board",
  "ICSE",
  "PUC",
  "IB / IGCSE",
] as const;

export const REGISTRATION_GENDER_OPTIONS = [
  "Male",
  "Female",
  "Other",
] as const;

export type CreateStudentRegistrationInput = {
  kind: "student";
  eventId: string;
  studentName: string;
  email: string;
  phone: string;
  parentPhone?: string;
  college: string;
  classLabel: string;
  interestedStream: string;
  board: string;
  gender: (typeof REGISTRATION_GENDER_OPTIONS)[number];
  city: string;
  seminarInterests?: string[];
};

export type CreateSchoolRegistrationInput = {
  kind: "school";
  eventId: string;
  schoolContactName: string;
  schoolName: string;
  schoolCity: string;
  schoolContactNumber: string;
  schoolContactEmail: string;
};

export type CreatePartnerRegistrationInput = {
  kind: "partner_registration";
  eventId: string;
  partnerRegContactName: string;
  partnerRegInstitutionName: string;
  partnerRegCity: string;
  partnerRegContactNumber: string;
  partnerRegContactEmail: string;
};

export type CreateStudentAmbassadorRegistrationInput = {
  kind: "student_ambassador";
  eventId: string;
  ambassadorName: string;
  ambassadorClass: string;
  ambassadorSchoolCollege: string;
  ambassadorAge: number;
  ambassadorPhone: string;
  ambassadorEmail: string;
};

export type CreateRegistrationInput =
  | CreateStudentRegistrationInput
  | CreateSchoolRegistrationInput
  | CreatePartnerRegistrationInput
  | CreateStudentAmbassadorRegistrationInput;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeSeminarInterests(
  interests: string[] | undefined
): string[] {
  const unique: string[] = [];
  for (const title of interests ?? []) {
    const trimmed = title.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
  }
  return unique;
}

function resolveEvent(
  eventId: string,
  events: Event[]
): { ok: true; event: Event } | { ok: false; error: string } {
  const trimmed = eventId.trim();
  if (!trimmed) {
    return { ok: false, error: "Event is required" };
  }
  const event = events.find((item) => item.id === trimmed);
  if (!event) {
    return { ok: false, error: "Selected event was not found" };
  }
  return { ok: true, event };
}

function validateStudentCreate(
  body: Partial<CreateStudentRegistrationInput>,
  _event: Event
):
  | { ok: true; data: CreateStudentRegistrationInput }
  | { ok: false; error: string } {
  const eventId = body.eventId?.trim() ?? "";
  const studentName = body.studentName?.trim() ?? "";
  if (studentName.length < 2) {
    return { ok: false, error: "Student name is required" };
  }

  const email = body.email?.trim() ?? "";
  if (!isValidEmail(email)) {
    return { ok: false, error: "A valid email address is required" };
  }

  const phone = body.phone?.trim() ?? "";
  if (phoneDigits(phone).length < 10) {
    return { ok: false, error: "Student mobile number is required" };
  }

  const college = body.college?.trim() ?? "";
  if (college.length < 2) {
    return { ok: false, error: "School/college is required" };
  }

  const classLabel = body.classLabel?.trim() ?? "";
  if (
    !REGISTRATION_CLASS_OPTIONS.includes(
      classLabel as (typeof REGISTRATION_CLASS_OPTIONS)[number]
    )
  ) {
    return { ok: false, error: "Class is required" };
  }

  const interestedStream = body.interestedStream?.trim() ?? "";
  if (
    !REGISTRATION_STREAM_OPTIONS.includes(
      interestedStream as (typeof REGISTRATION_STREAM_OPTIONS)[number]
    )
  ) {
    return { ok: false, error: "Stream is required" };
  }

  const board = body.board?.trim() ?? "";
  if (
    !REGISTRATION_BOARD_OPTIONS.includes(
      board as (typeof REGISTRATION_BOARD_OPTIONS)[number]
    )
  ) {
    return { ok: false, error: "Board is required" };
  }

  const gender = body.gender;
  if (
    !gender ||
    !REGISTRATION_GENDER_OPTIONS.includes(
      gender as (typeof REGISTRATION_GENDER_OPTIONS)[number]
    )
  ) {
    return { ok: false, error: "Gender is required" };
  }

  const city = body.city?.trim() ?? "";
  if (city.length < 2) {
    return { ok: false, error: "City is required" };
  }

  const parentPhone = body.parentPhone?.trim();
  if (parentPhone && phoneDigits(parentPhone).length < 10) {
    return {
      ok: false,
      error: "Parent mobile number must be at least 10 digits",
    };
  }

  const seminarInterests = normalizeSeminarInterests(body.seminarInterests);
  if (seminarInterests.length > MAX_SEMINAR_INTERESTS) {
    return {
      ok: false,
      error: `Students can choose at most ${MAX_SEMINAR_INTERESTS} seminars`,
    };
  }

  // Public site may offer the full seminar catalogue; accept any titles (max 3).

  return {
    ok: true,
    data: {
      kind: "student",
      eventId,
      studentName,
      email,
      phone,
      parentPhone: parentPhone || undefined,
      college,
      classLabel,
      interestedStream,
      board,
      gender,
      city,
      seminarInterests:
        seminarInterests.length > 0 ? seminarInterests : undefined,
    },
  };
}

function validateSchoolCreate(
  body: Partial<CreateSchoolRegistrationInput>,
  eventId: string
):
  | { ok: true; data: CreateSchoolRegistrationInput }
  | { ok: false; error: string } {
  const schoolContactName = body.schoolContactName?.trim() ?? "";
  if (schoolContactName.length < 2) {
    return { ok: false, error: "Name is required" };
  }

  const schoolName = body.schoolName?.trim() ?? "";
  if (schoolName.length < 2) {
    return { ok: false, error: "School name is required" };
  }

  const schoolCity = body.schoolCity?.trim() ?? "";
  if (schoolCity.length < 2) {
    return { ok: false, error: "City is required" };
  }

  const schoolContactNumber = body.schoolContactNumber?.trim() ?? "";
  if (phoneDigits(schoolContactNumber).length < 10) {
    return { ok: false, error: "Contact number is required" };
  }

  const schoolContactEmail = body.schoolContactEmail?.trim() ?? "";
  if (!isValidEmail(schoolContactEmail)) {
    return { ok: false, error: "A valid email address is required" };
  }

  return {
    ok: true,
    data: {
      kind: "school",
      eventId,
      schoolContactName,
      schoolName,
      schoolCity,
      schoolContactNumber,
      schoolContactEmail,
    },
  };
}

function validatePartnerRegistrationCreate(
  body: Partial<CreatePartnerRegistrationInput>,
  eventId: string
):
  | { ok: true; data: CreatePartnerRegistrationInput }
  | { ok: false; error: string } {
  const partnerRegContactName = body.partnerRegContactName?.trim() ?? "";
  if (partnerRegContactName.length < 2) {
    return { ok: false, error: "Name is required" };
  }

  const partnerRegInstitutionName =
    body.partnerRegInstitutionName?.trim() ?? "";
  if (partnerRegInstitutionName.length < 2) {
    return { ok: false, error: "Institution name is required" };
  }

  const partnerRegCity = body.partnerRegCity?.trim() ?? "";
  if (partnerRegCity.length < 2) {
    return { ok: false, error: "City is required" };
  }

  const partnerRegContactNumber = body.partnerRegContactNumber?.trim() ?? "";
  if (phoneDigits(partnerRegContactNumber).length < 10) {
    return { ok: false, error: "Contact number is required" };
  }

  const partnerRegContactEmail = body.partnerRegContactEmail?.trim() ?? "";
  if (!isValidEmail(partnerRegContactEmail)) {
    return { ok: false, error: "A valid email address is required" };
  }

  return {
    ok: true,
    data: {
      kind: "partner_registration",
      eventId,
      partnerRegContactName,
      partnerRegInstitutionName,
      partnerRegCity,
      partnerRegContactNumber,
      partnerRegContactEmail,
    },
  };
}

function validateAmbassadorCreate(
  body: Partial<CreateStudentAmbassadorRegistrationInput>,
  eventId: string
):
  | { ok: true; data: CreateStudentAmbassadorRegistrationInput }
  | { ok: false; error: string } {
  const ambassadorName = body.ambassadorName?.trim() ?? "";
  if (ambassadorName.length < 2) {
    return { ok: false, error: "Name is required" };
  }

  const ambassadorClass = body.ambassadorClass?.trim() ?? "";
  if (
    !REGISTRATION_CLASS_OPTIONS.includes(
      ambassadorClass as (typeof REGISTRATION_CLASS_OPTIONS)[number]
    )
  ) {
    return { ok: false, error: "Class is required" };
  }

  const ambassadorSchoolCollege = body.ambassadorSchoolCollege?.trim() ?? "";
  if (ambassadorSchoolCollege.length < 2) {
    return { ok: false, error: "School/college name is required" };
  }

  const ambassadorAge = Number(body.ambassadorAge);
  if (!Number.isFinite(ambassadorAge) || ambassadorAge < 10 || ambassadorAge > 25) {
    return { ok: false, error: "Enter a valid age (10–25)" };
  }

  const ambassadorPhone = body.ambassadorPhone?.trim() ?? "";
  if (phoneDigits(ambassadorPhone).length < 10) {
    return { ok: false, error: "Contact number is required" };
  }

  const ambassadorEmail = body.ambassadorEmail?.trim() ?? "";
  if (!isValidEmail(ambassadorEmail)) {
    return { ok: false, error: "A valid email address is required" };
  }

  return {
    ok: true,
    data: {
      kind: "student_ambassador",
      eventId,
      ambassadorName,
      ambassadorClass,
      ambassadorSchoolCollege,
      ambassadorAge,
      ambassadorPhone,
      ambassadorEmail,
    },
  };
}

export function validateRegistrationCreate(
  body: Partial<CreateRegistrationInput> & { kind?: RegistrationKind },
  events: Event[]
): { ok: true; data: CreateRegistrationInput } | { ok: false; error: string } {
  const kind = body.kind ?? "student";
  const eventResolved = resolveEvent(body.eventId ?? "", events);
  if (!eventResolved.ok) {
    return eventResolved;
  }
  const { event } = eventResolved;
  const eventId = event.id;

  switch (kind) {
    case "student":
      return validateStudentCreate(
        { ...body, kind: "student", eventId } as Partial<CreateStudentRegistrationInput>,
        event
      );
    case "school":
      return validateSchoolCreate(
        { ...body, kind: "school", eventId } as Partial<CreateSchoolRegistrationInput>,
        eventId
      );
    case "partner_registration":
      return validatePartnerRegistrationCreate(
        {
          ...body,
          kind: "partner_registration",
          eventId,
        } as Partial<CreatePartnerRegistrationInput>,
        eventId
      );
    case "student_ambassador":
      return validateAmbassadorCreate(
        {
          ...body,
          kind: "student_ambassador",
          eventId,
        } as Partial<CreateStudentAmbassadorRegistrationInput>,
        eventId
      );
    default:
      return { ok: false, error: "Unknown registration type" };
  }
}

function baseRegistrationFields(
  kind: RegistrationKind,
  event: Event,
  existing: Registration[],
  id: string,
  now: string
): Pick<
  Registration,
  | "id"
  | "registrationNumber"
  | "kind"
  | "eventId"
  | "eventTitle"
  | "status"
  | "paymentStatus"
  | "amount"
  | "registeredAt"
  | "updatedAt"
> {
  return {
    id,
    registrationNumber: nextRegistrationNumber(
      kind,
      event.city,
      event.startDate,
      existing
    ),
    kind,
    eventId: event.id,
    eventTitle: event.title,
    status: "Confirmed",
    paymentStatus: "Waived",
    amount: 0,
    registeredAt: now,
    updatedAt: now,
  };
}

export function buildRegistrationFromInput(
  input: CreateRegistrationInput,
  event: Event,
  existing: Registration[],
  id: string,
  now: string
): Registration {
  const base = baseRegistrationFields(input.kind, event, existing, id, now);

  switch (input.kind) {
    case "student": {
      const student: StudentRegistration = {
        ...base,
        kind: "student",
        studentName: input.studentName,
        email: input.email,
        phone: input.phone,
        parentPhone: input.parentPhone,
        college: input.college,
        classLabel: input.classLabel,
        interestedStream: input.interestedStream,
        board: input.board,
        gender: input.gender,
        city: input.city,
        state: event.state?.trim() || "Karnataka",
        seminarInterests: input.seminarInterests,
      };
      return student;
    }
    case "school": {
      const school: SchoolRegistration = {
        ...base,
        kind: "school",
        schoolContactName: input.schoolContactName,
        schoolName: input.schoolName,
        schoolCity: input.schoolCity,
        schoolContactNumber: input.schoolContactNumber,
        schoolContactEmail: input.schoolContactEmail,
      };
      return school;
    }
    case "partner_registration": {
      const partnerReg: PartnerRegistrationEntry = {
        ...base,
        kind: "partner_registration",
        partnerRegContactName: input.partnerRegContactName,
        partnerRegInstitutionName: input.partnerRegInstitutionName,
        partnerRegCity: input.partnerRegCity,
        partnerRegContactNumber: input.partnerRegContactNumber,
        partnerRegContactEmail: input.partnerRegContactEmail,
      };
      return partnerReg;
    }
    case "student_ambassador": {
      const ambassador: StudentAmbassadorRegistration = {
        ...base,
        kind: "student_ambassador",
        ambassadorName: input.ambassadorName,
        ambassadorClass: input.ambassadorClass,
        ambassadorSchoolCollege: input.ambassadorSchoolCollege,
        ambassadorAge: input.ambassadorAge,
        ambassadorPhone: input.ambassadorPhone,
        ambassadorEmail: input.ambassadorEmail,
      };
      return ambassador;
    }
  }
}
