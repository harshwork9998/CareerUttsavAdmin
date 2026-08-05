import { NextResponse } from "next/server";

import { sendStudentWelcomeEmail } from "@/lib/email";
import { consumePhoneVerification } from "@/lib/otp";
import { resolveRegistration } from "@/lib/enrich-registration";
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
import { loadEvents, saveEvents } from "@/lib/server/events-persistence";
import {
  loadRawRegistrations,
  loadRegistrations,
  saveRegistrations,
} from "@/lib/server/registrations-persistence";
import { generateId } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET() {
  return NextResponse.json(loadRegistrations(), { headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateRegistrationInput> & {
    kind?: CreateRegistrationInput["kind"];
  };
  const events = loadEvents();
  const validated = validateRegistrationCreate(body, events);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const event = events.find((item) => item.id === validated.data.eventId);
  if (!event) {
    return NextResponse.json({ error: "Selected event was not found" }, { status: 400 });
  }

  const registrations = loadRawRegistrations();

  if (validated.data.kind === "student") {
    const token = validated.data.phoneVerificationToken?.trim() ?? "";
    const clientHint =
      typeof (body as { client?: string }).client === "string"
        ? (body as { client?: string }).client
        : "";
    const requirePhoneOtp =
      clientHint === "public" ||
      request.headers.get("x-cu-client") === "public" ||
      Boolean(token);

    if (requirePhoneOtp) {
      if (!token) {
        return NextResponse.json(
          {
            error:
              "Please verify your mobile number with OTP before registering.",
          },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const verification = consumePhoneVerification({
        phone: validated.data.phone,
        purpose: "student_registration",
        verificationToken: token,
        consume: true,
      });
      if (!verification.ok) {
        return NextResponse.json(
          { error: verification.error },
          { status: verification.status, headers: NO_STORE_HEADERS }
        );
      }
    }

    const duplicate = findStudentRegistrationDuplicate(registrations, {
      eventId: validated.data.eventId,
      email: validated.data.email,
      phone: validated.data.phone,
    });

    if (duplicate) {
      return NextResponse.json(
        { error: DUPLICATE_STUDENT_REGISTRATION_MESSAGE, duplicate: true },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }
  }

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

  // Email must not block or fail the registration response.
  if (isStudentRegistration(resolved)) {
    void sendStudentWelcomeEmail({
      to: resolved.email,
      name: resolved.studentName,
      registrationId: resolved.registrationNumber,
    })
      .then((result) => {
        if (!result.ok) {
          console.error(
            `[email] Student welcome failed for ${resolved.registrationNumber}:`,
            result.error
          );
          return;
        }
        console.info(
          `[email] Student welcome sent for ${resolved.registrationNumber} (${result.id})`
        );
      })
      .catch((error) => {
        console.error(
          `[email] Student welcome unexpected error for ${resolved.registrationNumber}:`,
          error
        );
      });
  }

  return NextResponse.json(resolved, { headers: NO_STORE_HEADERS });
}
