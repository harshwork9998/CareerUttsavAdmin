import { NextResponse } from "next/server";

import { requireSuperuser } from "@/lib/server/admin-auth";
import { assessTemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import { listApprovedMessageTemplates } from "@/lib/server/whatsapp/meta-templates";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSuperuser();
  if (auth instanceof NextResponse) return auth;

  const result = await listApprovedMessageTemplates();
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.errorCode === "WHATSAPP_BUSINESS_ACCOUNT_ID_NOT_CONFIGURED"
            ? result.message
            : "Templates could not be loaded. Ask your technical contact to verify Meta access.",
        errorCode: result.errorCode,
      },
      { status: result.httpStatus ?? 503 }
    );
  }

  const templates = result.templates.map((template) => {
    const capability = assessTemplateCapability(template);
    return {
      name: template.name,
      language: template.language,
      category: template.category ?? null,
      capability,
      template,
    };
  });

  return NextResponse.json({ templates });
}