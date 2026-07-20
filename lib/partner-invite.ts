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

/** Same automation template for every partner — credentials + per-event package summary. */
export function buildPartnerWelcomeEmail(input: {
  partnerName: string;
  login: string;
  temporaryPassword: string;
  hasSeminarSlots?: boolean;
  eventPackages?: Array<{
    title: string;
    city: string;
    tier: string;
    deliverables: Array<{ label: string; option?: string }>;
    seminars: Array<{ title: string; slots: number }>;
    seatsAssigned: number;
    slotBudget: number;
  }>;
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

  const packageBlock =
    input.eventPackages && input.eventPackages.length > 0
      ? `\n📦 Your partnership package\n\n${input.eventPackages
          .map((pkg) => {
            const deliverableLines =
              pkg.deliverables.length > 0
                ? pkg.deliverables
                    .map((d) => {
                      const opt = d.option ? ` (${d.option})` : "";
                      return `      • ${d.label}${opt}`;
                    })
                    .join("\n")
                : "      • No deliverables listed";

            const seminarLines =
              pkg.seminars.length > 0
                ? pkg.seminars
                    .map(
                      (s) =>
                        `      • ${s.title} — ${s.slots} seat${s.slots === 1 ? "" : "s"}`
                    )
                    .join("\n")
                : pkg.slotBudget > 0
                  ? "      • Seminar seats to be confirmed on dashboard"
                  : "      • No seminar panelist slots";

            return `${pkg.city} — ${pkg.title}
    Tier: ${pkg.tier}
    Deliverables:
${deliverableLines}
    Seminar seats (${pkg.seatsAssigned}/${pkg.slotBudget} allotted):
${seminarLines}`;
          })
          .join("\n\n")}\n`
      : "";

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
${packageBlock}
💡 What's waiting for you

${waitingLines}

We look forward to an amazing partnership at Career Uttsav!

Thanks & Regards,
Team Career Uttsav
K2 Learning Resources India Pvt. Ltd.

📧 info@careeruttsav.in | 🌐 www.careeruttsav.in`,
  };
}
