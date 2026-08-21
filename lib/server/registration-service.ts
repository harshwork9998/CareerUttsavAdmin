import { sendStudentWelcomeEmail } from "@/lib/email";
import { resolveRegistration } from "@/lib/enrich-registration";
import { consumePhoneVerification } from "@/lib/otp";
import { isStudentRegistration } from "@/lib/registration-kinds";
import {
  DUPLICATE_STUDENT_REGISTRATION_MESSAGE,
  findStudentRegistrationDuplicate,
} from "@/lib/registration-duplicates";
import {
  buildRegistrationFromInput,
  validateRegistrationCreate,
  type CreateRegistrationInput,
} from "@/lib/registration-validation";
import { listEventsForApi } from "@/lib/server/event-service";
import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import { isPrismaRegistrationPersistence } from "@/lib/server/registration-persistence-mode";
import {
  createPrismaRegistration,
  deletePrismaRegistration,
  findPrismaStudentDuplicate,
  getPrismaRegistration,
  isPrismaUniqueConstraintError,
  listPrismaRegistrations,
  patchPrismaRegistration,
} from "@/lib/server/registration-prisma-store";
import {
  loadRawRegistrations,
  loadRegistrations,
  saveRegistrations,
} from "@/lib/server/registrations-persistence";
import { generateId } from "@/lib/utils";
import type { Registration, StudentRegistration } from "@/types";

export type RegistrationServiceError = {
  status: number;
  body: Record<string, unknown>;
};

export type RegistrationCreateResult =
  | { ok: true; registration: Registration }
  | { ok: false; error: RegistrationServiceError };

export type RegistrationDuplicateCheckResult = {
  duplicate: boolean;
  message: string | null;
  registration: {
    id: string;
    registrationNumber: string;
    studentName: string;
    email: string;
    phone: string;
  } | null;
};

function duplicatePayload(
  duplicate: StudentRegistration
): RegistrationDuplicateCheckResult["registration"] {
  return {
    id: duplicate.id,
    registrationNumber: duplicate.registrationNumber,
    studentName: duplicate.studentName,
    email: duplicate.email,
    phone: duplicate.phone,
  };
}

function scheduleStudentWelcomeEmail(registration: Registration): void {
  if (!isStudentRegistration(registration)) return;

  void sendStudentWelcomeEmail({
    to: registration.email,
    name: registration.studentName,
    registrationId: registration.registrationNumber,
  })
    .then((result) => {
      if (!result.ok) {
        console.error(
          `[email] Student welcome failed for ${registration.registrationNumber}:`,
          result.error
        );
        return;
      }
      console.info(
        `[email] Student welcome sent for ${registration.registrationNumber} (${result.id})`
      );
    })
    .catch((error) => {
      console.error(
        `[email] Student welcome unexpected error for ${registration.registrationNumber}:`,
        error
      );
    });
}

export async function listRegistrationsForApi(): Promise<Registration[]> {
  if (isPrismaRegistrationPersistence()) {
    return listPrismaRegistrations();
  }
  return loadRegistrations();
}

export async function getRegistrationForApi(
  id: string
): Promise<Registration | null> {
  if (isPrismaRegistrationPersistence()) {
    return getPrismaRegistration(id);
  }

  const registration = loadRawRegistrations().find((entry) => entry.id === id);
  if (!registration) return null;
  return resolveRegistration(registration, await listEventsForApi());
}

export async function checkStudentRegistrationDuplicate(input: {
  eventId?: string;
  email?: string;
  phone?: string;
}): Promise<RegistrationDuplicateCheckResult> {
  if (!input.email?.trim() && !input.phone?.trim()) {
    return {
      duplicate: false,
      message: null,
      registration: null,
    };
  }

  if (isPrismaRegistrationPersistence()) {
    const duplicate = await findPrismaStudentDuplicate(input);
    return {
      duplicate: Boolean(duplicate),
      message: duplicate ? DUPLICATE_STUDENT_REGISTRATION_MESSAGE : null,
      registration:
        duplicate && isStudentRegistration(duplicate)
          ? duplicatePayload(duplicate)
          : null,
    };
  }

  const duplicate = findStudentRegistrationDuplicate(loadRawRegistrations(), {
    ...(input.eventId ? { eventId: input.eventId } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { phone: input.phone } : {}),
  });

  return {
    duplicate: Boolean(duplicate),
    message: duplicate ? DUPLICATE_STUDENT_REGISTRATION_MESSAGE : null,
    registration: duplicate ? duplicatePayload(duplicate) : null,
  };
}

export async function createRegistrationForApi(
  body: Partial<CreateRegistrationInput> & {
    kind?: CreateRegistrationInput["kind"];
    client?: string;
  },
  request: Request
): Promise<RegistrationCreateResult> {
  const events = await listEventsForApi();
  const validated = validateRegistrationCreate(body, events);
  if (!validated.ok) {
    return {
      ok: false,
      error: { status: 400, body: { error: validated.error } },
    };
  }

  const event = events.find((item) => item.id === validated.data.eventId);
  if (!event) {
    return {
      ok: false,
      error: { status: 400, body: { error: "Selected event was not found" } },
    };
  }

  if (validated.data.kind === "student") {
    const token = validated.data.phoneVerificationToken?.trim() ?? "";
    const clientHint = typeof body.client === "string" ? body.client : "";
    const requirePhoneOtp =
      clientHint === "public" ||
      request.headers.get("x-cu-client") === "public" ||
      Boolean(token);

    if (requirePhoneOtp) {
      if (!token) {
        return {
          ok: false,
          error: {
            status: 400,
            body: {
              error:
                "Please verify your mobile number with OTP before registering.",
            },
          },
        };
      }

      const verification = consumePhoneVerification({
        phone: validated.data.phone,
        purpose: "student_registration",
        verificationToken: token,
        consume: true,
      });
      if (!verification.ok) {
        return {
          ok: false,
          error: {
            status: verification.status,
            body: { error: verification.error },
          },
        };
      }
    }

    const duplicateResult = await checkStudentRegistrationDuplicate({
      eventId: validated.data.eventId,
      email: validated.data.email,
      phone: validated.data.phone,
    });
    if (duplicateResult.duplicate) {
      return {
        ok: false,
        error: {
          status: 409,
          body: {
            error: DUPLICATE_STUDENT_REGISTRATION_MESSAGE,
            duplicate: true,
          },
        },
      };
    }
  }

  if (isPrismaRegistrationPersistence()) {
    try {
      const created = await createPrismaRegistration(validated.data, event);
      scheduleStudentWelcomeEmail(created);
      return { ok: true, registration: created };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return {
          ok: false,
          error: {
            status: 409,
            body: {
              error: DUPLICATE_STUDENT_REGISTRATION_MESSAGE,
              duplicate: true,
            },
          },
        };
      }
      throw error;
    }
  }

  const registrations = loadRawRegistrations();
  const now = new Date().toISOString();
  const created = buildRegistrationFromInput(
    validated.data,
    event,
    registrations,
    `reg-${generateId()}`,
    now
  );

  saveRegistrations([created, ...registrations]);

  const nextEvents = events.map((item) =>
    item.id === event.id
      ? {
          ...item,
          registrationCount: (item.registrationCount ?? 0) + 1,
          updatedAt: now,
        }
      : item
  );
  saveEvents(nextEvents);

  const resolved = resolveRegistration(created, nextEvents);
  scheduleStudentWelcomeEmail(resolved);
  return { ok: true, registration: resolved };
}

export async function patchRegistrationForApi(
  id: string,
  patch: Partial<Registration>
): Promise<Registration | null> {
  if (isPrismaRegistrationPersistence()) {
    try {
      return await patchPrismaRegistration(id, patch);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw Object.assign(new Error(DUPLICATE_STUDENT_REGISTRATION_MESSAGE), {
          status: 409,
          duplicate: true,
        });
      }
      throw error;
    }
  }

  const registrations = loadRawRegistrations();
  const idx = registrations.findIndex((entry) => entry.id === id);
  if (idx === -1) return null;

  const existing = registrations[idx];
  const updated = {
    ...existing,
    ...patch,
    id: existing.id,
    kind: existing.kind,
    updatedAt: new Date().toISOString(),
  } as Registration;

  const next = [...registrations];
  next[idx] = updated;
  saveRegistrations(next);
  return resolveRegistration(updated, await listEventsForApi());
}

export async function deleteRegistrationForApi(
  id: string
): Promise<{ success: true; id: string } | null> {
  if (isPrismaRegistrationPersistence()) {
    const result = await deletePrismaRegistration(id);
    return result ? { success: true, id: result.id } : null;
  }

  const registrations = loadRawRegistrations();
  const removed = registrations.find((entry) => entry.id === id);
  if (!removed) return null;

  saveRegistrations(registrations.filter((entry) => entry.id !== id));

  const events = loadEvents();
  const eventId = removed.eventId;
  if (events.some((event) => event.id === eventId)) {
    const now = new Date().toISOString();
    saveEvents(
      events.map((event) =>
        event.id === eventId
          ? {
              ...event,
              registrationCount: Math.max(0, (event.registrationCount ?? 0) - 1),
              updatedAt: now,
            }
          : event
      )
    );
  }

  return { success: true, id };
}
