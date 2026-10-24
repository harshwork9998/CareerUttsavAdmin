import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import { toPublicPartner } from "@/lib/partner-credentials";
import {
  notifyAfterAllocationChange,
  notifyReadinessTransition,
} from "@/lib/server/partner-communication-service";
import { stripPartnerOwnedSubmissionFields } from "@/lib/server/partner-portal-patch";
import {
  deletePartnerForApi,
  getPartnerByIdForApi,
  updatePartnerForApi,
} from "@/lib/server/partner-service";
import type { Partner } from "@/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicPartner(partner));
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const before = await getPartnerByIdForApi(id);
  const patch = stripPartnerOwnedSubmissionFields(
    (await request.json()) as Partial<Partner>
  );
  const result = await updatePartnerForApi(id, patch);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (before) {
    try {
      await notifyAfterAllocationChange(before, result.partner);
      await notifyReadinessTransition(before, result.partner);
    } catch (error) {
      console.info("[partner-communication]", {
        partnerId: result.partner.id,
        outcome: "unknown",
        error: error instanceof Error ? error.message : "Partner communication failed",
      });
    }
  }
  return NextResponse.json(toPublicPartner(result.partner));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const result = await deletePartnerForApi(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.partners.map(toPublicPartner));
}
