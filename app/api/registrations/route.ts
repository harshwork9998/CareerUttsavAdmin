import { NextResponse } from "next/server";

import {
  createRegistrationForApi,
  listRegistrationsForApi,
} from "@/lib/server/registration-service";
import type { CreateRegistrationInput } from "@/lib/registration-validation";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET() {
  return NextResponse.json(await listRegistrationsForApi(), {
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateRegistrationInput> & {
    kind?: CreateRegistrationInput["kind"];
    client?: string;
  };

  const result = await createRegistrationForApi(body, request);
  if (!result.ok) {
    return NextResponse.json(result.error.body, {
      status: result.error.status,
      headers: NO_STORE_HEADERS,
    });
  }

  return NextResponse.json(result.registration, { headers: NO_STORE_HEADERS });
}
