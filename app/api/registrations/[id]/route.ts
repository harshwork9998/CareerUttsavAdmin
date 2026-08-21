import { NextResponse } from "next/server";

import { DUPLICATE_STUDENT_REGISTRATION_MESSAGE } from "@/lib/registration-duplicates";
import {
  deleteRegistrationForApi,
  getRegistrationForApi,
  patchRegistrationForApi,
} from "@/lib/server/registration-service";
import type { Registration } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const registration = await getRegistrationForApi(id);
  if (!registration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(registration);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const patch = (await request.json()) as Partial<Registration>;

  try {
    const updated = await patchRegistrationForApi(id, patch);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === DUPLICATE_STUDENT_REGISTRATION_MESSAGE
    ) {
      return NextResponse.json(
        { error: DUPLICATE_STUDENT_REGISTRATION_MESSAGE, duplicate: true },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const result = await deleteRegistrationForApi(id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
