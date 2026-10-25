import { NextResponse } from "next/server";

import { requireRelationshipOwnerFollowUpCronAuth } from "@/lib/server/relationship-owner-follow-up-cron-auth";
import {
  processRelationshipOwnerFollowUpDigestTest,
  processRelationshipOwnerFollowUpDigests,
} from "@/lib/server/relationship-owner-follow-up-processor";

export const dynamic = "force-dynamic";

type FollowUpCronBody = {
  mode?: string;
  ownerSpocId?: string;
};

async function parseFollowUpCronBody(
  request: Request
): Promise<FollowUpCronBody | NextResponse> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as FollowUpCronBody;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    return parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authError = requireRelationshipOwnerFollowUpCronAuth(request);
  if (authError) return authError;

  const body = await parseFollowUpCronBody(request);
  if (body instanceof NextResponse) return body;

  if (body.mode === "test") {
    const ownerSpocId =
      typeof body.ownerSpocId === "string" ? body.ownerSpocId.trim() : "";
    if (!ownerSpocId) {
      return NextResponse.json(
        { error: "ownerSpocId is required when mode is test" },
        { status: 400 }
      );
    }
    const result = await processRelationshipOwnerFollowUpDigestTest({
      ownerSpocId,
    });
    return NextResponse.json(result);
  }

  if (body.mode !== undefined && body.mode !== "") {
    return NextResponse.json({ error: "Unsupported mode" }, { status: 400 });
  }

  const summary = await processRelationshipOwnerFollowUpDigests();
  return NextResponse.json(summary);
}
