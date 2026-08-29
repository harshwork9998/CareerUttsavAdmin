import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";
import { isStudentRegistration } from "@/lib/registration-kinds";
import {
  duplicateResolutionToRegistration,
  normalizeRegistrationEmail,
  normalizeRegistrationPhone,
  resolveStudentRegistrationDuplicateResolution,
} from "@/lib/registration-duplicates";
import { normalizeSeminarInterests } from "@/lib/registration-validation";
import type { CreateRegistrationInput } from "@/lib/registration-validation";
import {
  formatRegistrationNumber,
  registrationCounterPrefix,
} from "@/lib/server/registration-number-counter";
import {
  isPrismaUniqueConstraintError,
  mapApiStatusToPrisma,
  mapPrismaRegistrationToApi,
  mapPrismaRegistrationsToApi,
  studentNormalizedFields,
  type PrismaRegistrationRecord,
} from "@/lib/server/registration-prisma-map";
import { generateId } from "@/lib/utils";
import { resetWhatsAppConversationsForDeletedRegistration } from "@/lib/server/whatsapp/whatsapp-conversation-store";
import type {
  Event,
  PartnerRegistrationEntry,
  Registration,
  SchoolRegistration,
  StudentAmbassadorRegistration,
  StudentRegistration,
} from "@/types";

const registrationInclude = {
  registrationSeminars: { orderBy: { id: "asc" as const } },
} satisfies Prisma.RegistrationInclude;

async function allocateRegistrationNumber(
  tx: Prisma.TransactionClient,
  prefix: string
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ allocated_value: number }>>`
    UPDATE "registration_number_counters"
    SET "nextValue" = "nextValue" + 1, "updatedAt" = NOW()
    WHERE "prefix" = ${prefix}
    RETURNING ("nextValue" - 1) AS allocated_value
  `;

  const sequence = rows[0]?.allocated_value;
  if (sequence === undefined) {
    throw new Error(`Missing registration counter for prefix ${prefix}`);
  }

  return formatRegistrationNumber(prefix, sequence);
}

function buildSeminarRows(
  registrationId: string,
  seminarInterests: string[] | undefined,
  seminarTitleToId: Map<string, string>
): Prisma.RegistrationSeminarCreateManyInput[] {
  if (!seminarInterests || seminarInterests.length === 0) {
    return [];
  }

  const canonicalTitles = normalizeSeminarInterests(seminarInterests);
  return canonicalTitles.map((canonicalTitle, index) => {
    const originalTitle =
      seminarInterests
        .map((title) => title.trim())
        .find(
          (title) =>
            title.length > 0 &&
            normalizeSeminarInterests([title])[0] === canonicalTitle
        ) ?? canonicalTitle;

    return {
      id: `rsem-${registrationId}-${index + 1}`,
      registrationId,
      seminarId: seminarTitleToId.get(originalTitle) ?? null,
      seminarTitle: originalTitle,
    };
  });
}

function buildCreateData(
  input: CreateRegistrationInput,
  event: Event,
  id: string,
  registrationNumber: string,
  now: Date
): Prisma.RegistrationUncheckedCreateInput {
  const base = {
    id,
    registrationNumber,
    kind: input.kind,
    eventId: event.id,
    eventTitle: event.title,
    status: mapApiStatusToPrisma("Confirmed"),
    paymentStatus: "Waived" as const,
    amount: new Prisma.Decimal(0),
    registeredAt: now,
    updatedAt: now,
  };

  switch (input.kind) {
    case "student": {
      const normalized = studentNormalizedFields({
        email: input.email,
        phone: input.phone,
      });
      return {
        ...base,
        studentName: input.studentName,
        email: input.email,
        phone: input.phone,
        parentPhone: input.parentPhone ?? null,
        college: input.college,
        classLabel: input.classLabel,
        interestedStream: input.interestedStream,
        board: input.board,
        gender: input.gender,
        city: input.city,
        state: event.state?.trim() || "Karnataka",
        emailNormalized: normalized.emailNormalized,
        phoneLast10: normalized.phoneLast10,
      };
    }
    case "school":
      return {
        ...base,
        schoolContactName: input.schoolContactName,
        schoolName: input.schoolName,
        schoolCity: input.schoolCity,
        schoolContactNumber: input.schoolContactNumber,
        schoolContactEmail: input.schoolContactEmail,
      };
    case "partner_registration":
      return {
        ...base,
        partnerRegContactName: input.partnerRegContactName,
        partnerRegInstitutionName: input.partnerRegInstitutionName,
        partnerRegCity: input.partnerRegCity,
        partnerRegContactNumber: input.partnerRegContactNumber,
        partnerRegContactEmail: input.partnerRegContactEmail,
      };
    case "student_ambassador":
      return {
        ...base,
        ambassadorName: input.ambassadorName,
        ambassadorClass: input.ambassadorClass,
        ambassadorSchoolCollege: input.ambassadorSchoolCollege,
        ambassadorAge: input.ambassadorAge,
        ambassadorPhone: input.ambassadorPhone,
        ambassadorEmail: input.ambassadorEmail,
      };
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}

export async function listPrismaRegistrations(): Promise<Registration[]> {
  const records = await prisma.registration.findMany({
    include: registrationInclude,
    orderBy: [{ registeredAt: "desc" }, { id: "desc" }],
  });
  return mapPrismaRegistrationsToApi(records);
}

export async function getPrismaRegistration(
  id: string
): Promise<Registration | null> {
  const record = await prisma.registration.findUnique({
    where: { id },
    include: registrationInclude,
  });
  return record ? mapPrismaRegistrationToApi(record) : null;
}

function prismaStudentBaseWhere(input: {
  eventId?: string;
  excludeId?: string;
}): Prisma.RegistrationWhereInput {
  const eventId = input.eventId?.trim() ?? "";
  return {
    kind: "student",
    ...(eventId ? { eventId } : {}),
    ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
  };
}

export async function findPrismaStudentByPhone(input: {
  eventId?: string;
  phone?: string;
  excludeId?: string;
}): Promise<Registration | null> {
  const phone = normalizeRegistrationPhone(input.phone);
  if (phone.length < 10) {
    return null;
  }

  const record = await prisma.registration.findFirst({
    where: {
      ...prismaStudentBaseWhere(input),
      phoneLast10: phone,
    },
    include: registrationInclude,
  });

  return record ? mapPrismaRegistrationToApi(record) : null;
}

export async function findPrismaStudentByEmail(input: {
  eventId?: string;
  email?: string;
  excludeId?: string;
}): Promise<Registration | null> {
  const email = normalizeRegistrationEmail(input.email);
  if (!email) {
    return null;
  }

  const record = await prisma.registration.findFirst({
    where: {
      ...prismaStudentBaseWhere(input),
      emailNormalized: email,
    },
    include: registrationInclude,
  });

  return record ? mapPrismaRegistrationToApi(record) : null;
}

export async function findPrismaStudentDuplicate(input: {
  eventId?: string;
  email?: string;
  phone?: string;
  excludeId?: string;
}): Promise<Registration | null> {
  const email = normalizeRegistrationEmail(input.email);
  const phone = normalizeRegistrationPhone(input.phone);

  if (!email && phone.length < 10) {
    return null;
  }

  const phoneMatch =
    phone.length >= 10 ? await findPrismaStudentByPhone(input) : null;
  const emailMatch = email ? await findPrismaStudentByEmail(input) : null;

  const phoneStudent =
    phoneMatch && isStudentRegistration(phoneMatch) ? phoneMatch : null;
  const emailStudent =
    emailMatch && isStudentRegistration(emailMatch) ? emailMatch : null;

  const resolution = resolveStudentRegistrationDuplicateResolution(
    phoneStudent,
    emailStudent
  );

  if (resolution.outcome === "conflict" && phoneStudent) {
    return phoneStudent;
  }

  return duplicateResolutionToRegistration(resolution);
}

export async function createPrismaRegistration(
  input: CreateRegistrationInput,
  event: Event
): Promise<Registration> {
  const now = new Date();
  const id = `reg-${generateId()}`;
  const prefix = registrationCounterPrefix(input.kind);

  const seminars = await prisma.seminar.findMany({
    where: { eventId: event.id },
    select: { id: true, title: true },
  });
  const seminarTitleToId = new Map(
    seminars.map((seminar) => [seminar.title, seminar.id])
  );

  const created = await prisma.$transaction(async (tx) => {
    const registrationNumber = await allocateRegistrationNumber(tx, prefix);
    const seminarRows =
      input.kind === "student"
        ? buildSeminarRows(id, input.seminarInterests, seminarTitleToId)
        : [];

    const record = await tx.registration.create({
      data: buildCreateData(input, event, id, registrationNumber, now),
      include: registrationInclude,
    });

    if (seminarRows.length > 0) {
      await tx.registrationSeminar.createMany({ data: seminarRows });
    }

    await tx.event.update({
      where: { id: event.id },
      data: {
        registrationCount: { increment: 1 },
        updatedAt: now,
      },
    });

    if (seminarRows.length > 0) {
      return tx.registration.findUniqueOrThrow({
        where: { id },
        include: registrationInclude,
      });
    }

    return record;
  });

  return mapPrismaRegistrationToApi(created);
}

export async function patchPrismaRegistration(
  id: string,
  patch: Partial<Registration>
): Promise<Registration | null> {
  const existing = await prisma.registration.findUnique({
    where: { id },
    include: registrationInclude,
  });
  if (!existing) return null;

  const now = new Date();
  const data: Prisma.RegistrationUpdateInput = {
    updatedAt: now,
  };

  if (patch.status) {
    data.status = mapApiStatusToPrisma(patch.status);
  }
  if (patch.paymentStatus) {
    data.paymentStatus = patch.paymentStatus;
  }
  if (patch.eventTitle !== undefined) {
    data.eventTitle = patch.eventTitle;
  }
  if (patch.amount !== undefined) {
    data.amount =
      patch.amount === null || patch.amount === undefined
        ? null
        : new Prisma.Decimal(patch.amount);
  }
  if (patch.checkInTime !== undefined) {
    data.checkInTime = patch.checkInTime ? new Date(patch.checkInTime) : null;
  }

  if (existing.kind === "student") {
    const studentPatch = patch as Partial<StudentRegistration>;
    const assignString = (
      field:
        | "studentName"
        | "email"
        | "phone"
        | "parentPhone"
        | "college"
        | "classLabel"
        | "interestedStream"
        | "board"
        | "city"
        | "state"
        | "course"
        | "year",
      value: string | undefined
    ) => {
      if (value !== undefined) {
        data[field] = value;
      }
    };

    assignString("studentName", studentPatch.studentName);
    assignString("email", studentPatch.email);
    assignString("phone", studentPatch.phone);
    assignString("parentPhone", studentPatch.parentPhone);
    assignString("college", studentPatch.college);
    assignString("classLabel", studentPatch.classLabel);
    assignString("interestedStream", studentPatch.interestedStream);
    assignString("board", studentPatch.board);
    assignString("city", studentPatch.city);
    assignString("state", studentPatch.state);
    assignString("course", studentPatch.course);
    assignString("year", studentPatch.year);

    if (studentPatch.gender !== undefined) {
      data.gender = studentPatch.gender;
    }

    if (
      studentPatch.email !== undefined ||
      studentPatch.phone !== undefined
    ) {
      const normalized = studentNormalizedFields({
        email: studentPatch.email ?? existing.email ?? undefined,
        phone: studentPatch.phone ?? existing.phone ?? undefined,
      });
      data.emailNormalized = normalized.emailNormalized;
      data.phoneLast10 = normalized.phoneLast10;
    }

    if (studentPatch.seminarInterests !== undefined) {
      const seminars = await prisma.seminar.findMany({
        where: { eventId: existing.eventId },
        select: { id: true, title: true },
      });
      const seminarTitleToId = new Map(
        seminars.map((seminar) => [seminar.title, seminar.id])
      );
      const seminarRows = buildSeminarRows(
        id,
        studentPatch.seminarInterests,
        seminarTitleToId
      );

      const updated = await prisma.$transaction(async (tx) => {
        await tx.registrationSeminar.deleteMany({ where: { registrationId: id } });
        if (seminarRows.length > 0) {
          await tx.registrationSeminar.createMany({ data: seminarRows });
        }
        return tx.registration.update({
          where: { id },
          data,
          include: registrationInclude,
        });
      });
      return mapPrismaRegistrationToApi(updated);
    }
  }

  if (existing.kind === "school") {
    const schoolPatch = patch as Partial<SchoolRegistration>;
    if (schoolPatch.schoolContactName !== undefined) {
      data.schoolContactName = schoolPatch.schoolContactName;
    }
    if (schoolPatch.schoolName !== undefined) {
      data.schoolName = schoolPatch.schoolName;
    }
    if (schoolPatch.schoolCity !== undefined) {
      data.schoolCity = schoolPatch.schoolCity;
    }
    if (schoolPatch.schoolContactNumber !== undefined) {
      data.schoolContactNumber = schoolPatch.schoolContactNumber;
    }
    if (schoolPatch.schoolContactEmail !== undefined) {
      data.schoolContactEmail = schoolPatch.schoolContactEmail;
    }
  }

  if (existing.kind === "partner_registration") {
    const partnerPatch = patch as Partial<PartnerRegistrationEntry>;
    if (partnerPatch.partnerRegContactName !== undefined) {
      data.partnerRegContactName = partnerPatch.partnerRegContactName;
    }
    if (partnerPatch.partnerRegInstitutionName !== undefined) {
      data.partnerRegInstitutionName = partnerPatch.partnerRegInstitutionName;
    }
    if (partnerPatch.partnerRegCity !== undefined) {
      data.partnerRegCity = partnerPatch.partnerRegCity;
    }
    if (partnerPatch.partnerRegContactNumber !== undefined) {
      data.partnerRegContactNumber = partnerPatch.partnerRegContactNumber;
    }
    if (partnerPatch.partnerRegContactEmail !== undefined) {
      data.partnerRegContactEmail = partnerPatch.partnerRegContactEmail;
    }
  }

  if (existing.kind === "student_ambassador") {
    const ambassadorPatch = patch as Partial<StudentAmbassadorRegistration>;
    if (ambassadorPatch.ambassadorName !== undefined) {
      data.ambassadorName = ambassadorPatch.ambassadorName;
    }
    if (ambassadorPatch.ambassadorClass !== undefined) {
      data.ambassadorClass = ambassadorPatch.ambassadorClass;
    }
    if (ambassadorPatch.ambassadorSchoolCollege !== undefined) {
      data.ambassadorSchoolCollege = ambassadorPatch.ambassadorSchoolCollege;
    }
    if (ambassadorPatch.ambassadorAge !== undefined) {
      data.ambassadorAge = ambassadorPatch.ambassadorAge;
    }
    if (ambassadorPatch.ambassadorPhone !== undefined) {
      data.ambassadorPhone = ambassadorPatch.ambassadorPhone;
    }
    if (ambassadorPatch.ambassadorEmail !== undefined) {
      data.ambassadorEmail = ambassadorPatch.ambassadorEmail;
    }
  }

  try {
    const updated = await prisma.registration.update({
      where: { id },
      data,
      include: registrationInclude,
    });
    return mapPrismaRegistrationToApi(updated);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      throw error;
    }
    throw error;
  }
}

export async function deletePrismaRegistration(
  id: string
): Promise<{ success: true; id: string; eventId: string } | null> {
  const existing = await prisma.registration.findUnique({
    where: { id },
    select: { id: true, eventId: true },
  });
  if (!existing) return null;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await resetWhatsAppConversationsForDeletedRegistration(id, tx);
    await tx.registration.delete({ where: { id } });
    const event = await tx.event.findUnique({
      where: { id: existing.eventId },
      select: { registrationCount: true },
    });
    if (event) {
      await tx.event.update({
        where: { id: existing.eventId },
        data: {
          registrationCount: Math.max(0, event.registrationCount - 1),
          updatedAt: now,
        },
      });
    }
  });

  return { success: true, id, eventId: existing.eventId };
}

export { isPrismaUniqueConstraintError };
