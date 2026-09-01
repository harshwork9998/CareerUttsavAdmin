import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  PARTNER_WELCOME_EMAIL_SUBJECT,
  buildPartnerWelcomeHtmlFromTemplate,
  buildPartnerWelcomePlainText,
  type PartnerWelcomeEmailInput,
} from "@/lib/partner-welcome-email-content";
import { PARTNER_WELCOME_HTML_TEMPLATE } from "@/lib/partner-welcome-email-template";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Partial<PartnerWelcomeEmailInput>;
  const partnerName = body.partnerName?.trim() ?? "";
  const login = body.login?.trim() ?? "";
  const temporaryPassword = body.temporaryPassword?.trim() ?? "";

  if (!partnerName || !login || !temporaryPassword) {
    return NextResponse.json(
      { error: "partnerName, login, and temporaryPassword are required" },
      { status: 400 }
    );
  }

  const input: PartnerWelcomeEmailInput = {
    partnerName,
    login,
    temporaryPassword,
  };

  return NextResponse.json({
    subject: PARTNER_WELCOME_EMAIL_SUBJECT,
    html: buildPartnerWelcomeHtmlFromTemplate(
      PARTNER_WELCOME_HTML_TEMPLATE,
      input
    ),
    plainText: buildPartnerWelcomePlainText(input),
  });
}
