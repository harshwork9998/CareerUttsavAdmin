import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import {
  applyCampaignTemplate,
  confirmCampaignConsent,
  getCampaignDetail,
} from "@/lib/server/whatsapp/campaign-service";
import type { CampaignVariableMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";
import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";
import { deleteCampaign } from "@/lib/server/whatsapp/campaign-delete";
import { setCampaignStatus } from "@/lib/server/whatsapp/campaign-store";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const detail = await getCampaignDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  let body: {
    action?: string;
    template?: MetaMessageTemplate;
    variableMapping?: CampaignVariableMapping;
    consentConfirmed?: boolean;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "cancel") {
      await setCampaignStatus(id, "CANCELLED");
      return NextResponse.json({ ok: true });
    }

    if (body.template && body.variableMapping) {
      const campaign = await applyCampaignTemplate({
        campaignId: id,
        template: body.template,
        variableMapping: body.variableMapping,
      });
      return NextResponse.json({ campaign });
    }

    if (body.consentConfirmed) {
      await confirmCampaignConsent(id, auth.user.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "This update could not be saved.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  try {
    const result = await deleteCampaign({
      campaignId: id,
      adminUserId: auth.user.id,
    });
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "This campaign could not be deleted.";
    const status = message === "Campaign not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}