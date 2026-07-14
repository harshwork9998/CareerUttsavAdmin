import type { Partner } from "@/types";

export function generatePartnerLogin(partner: Pick<Partner, "name" | "primaryContact">) {
  const email = partner.primaryContact.email.trim().toLowerCase();
  if (email) return email;

  const slug = partner.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
  return `${slug || "partner"}@partners.careeruttsav.in`;
}

export function generateTempPassword(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Same automation template for every partner — only university name + credentials change. */
export function buildPartnerWelcomeEmail(input: {
  partnerName: string;
  login: string;
  temporaryPassword: string;
  hasSeminarSlots?: boolean;
}) {
  const dashboardLine = input.hasSeminarSlots
    ? "We're excited to have you on board. Your partner dashboard is ready — review your package, check seminar slots, and upload the brand assets we need (logo, banner, and more)."
    : "We're excited to have you on board. Your partner dashboard is ready — review your package and upload the brand assets we need (logo, banner, and more).";

  const waitingLines = [
    "    Discussed deliverables in your package",
    ...(input.hasSeminarSlots ? ["    Seminar slots allotted"] : []),
    "    Partner dashboard with your benefits at a glance",
    "    Secure upload for logos, banners & required documents",
    "    Exclusive Career Uttsav partnership updates",
  ].join("\n");

  return {
    subject: `Congratulations !! You're In 🎉`,
    body: `Congratulations !! You're In 🎉

Hey ${input.partnerName} 👋

Congratulations! 🎉 You've successfully partnered with Career Uttsav.

${dashboardLine}

🔐 Your partner login
Login: ${input.login}
Temporary password: ${input.temporaryPassword}

Please sign in from the Partner Login tab on our website and change your password after the first login.

💡 What's waiting for you

${waitingLines}

We look forward to an amazing partnership at Career Uttsav!

Thanks & Regards,
Team Career Uttsav
K2 Learning Resources India Pvt. Ltd.

📧 info@careeruttsav.in | 🌐 www.careeruttsav.in`,
  };
}
