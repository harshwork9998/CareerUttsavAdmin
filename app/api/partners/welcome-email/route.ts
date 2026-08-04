import { NextResponse } from "next/server";

import { loadEmailTemplate } from "@/lib/email";
import {
  PARTNER_WELCOME_EMAIL_SUBJECT,
  buildPartnerWelcomeHtmlFromTemplate,
  buildPartnerWelcomePlainText,
  type PartnerWelcomeEmailInput,
} from "@/lib/partner-welcome-email-content";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const template = await loadEmailTemplate("emails/partner-welcome.html");

  return NextResponse.json({
    subject: PARTNER_WELCOME_EMAIL_SUBJECT,
    html: buildPartnerWelcomeHtmlFromTemplate(template, input),
    plainText: buildPartnerWelcomePlainText(input),
  });
}
