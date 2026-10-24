import {
  followUpUrgency,
  toFollowUpDateOnly,
} from "@/lib/server/partner-follow-up-eligibility";
import { istCalendarDateFromDate } from "@/lib/server/ist-calendar";
import type { PartnerFollowUpItem } from "@/types";

export const RELATIONSHIP_OWNER_DIGEST_MAX_BODY_CHARS = 2800;

function urgencyLabel(
  urgency: ReturnType<typeof followUpUrgency>
): string {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "re_engage") return "Re-engage";
  return "Due today";
}

function formatFollowUpDateLabel(followUpAt: string): string {
  const day = toFollowUpDateOnly(followUpAt);
  const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return day;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const calendar = new Date(Date.UTC(year, month - 1, date, 12));
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(calendar);
}

export function formatDigestContactLine(
  name: string | undefined,
  phone: string | undefined
): string | null {
  const contactName = (name ?? "").replace(/\s+/g, " ").trim();
  const contactPhone = (phone ?? "").replace(/\s+/g, " ").trim();
  if (contactName && contactPhone) {
    return `${contactName} | ${contactPhone}`;
  }
  if (contactName) return contactName;
  if (contactPhone) return contactPhone;
  return null;
}

export function formatUniversityDigestEntry(
  item: PartnerFollowUpItem,
  index: number,
  asOfIstDate: string
): string {
  const { partner, meeting } = item;
  const urgency = followUpUrgency(
    meeting.followUpAt!,
    asOfIstDate,
    meeting.outcome
  );
  const lines = [`${index}. ${partner.name.trim()}`];
  const contactLine = formatDigestContactLine(
    partner.primaryContact?.name,
    partner.primaryContact?.phone
  );
  if (contactLine) {
    lines.push(contactLine);
  }
  lines.push(
    `${urgencyLabel(urgency)} | ${formatFollowUpDateLabel(meeting.followUpAt!)}`
  );
  return lines.join("\n");
}

export function buildRelationshipOwnerFollowUpDigestText(input: {
  ownerName: string;
  items: PartnerFollowUpItem[];
  asOf?: Date;
}): { ownerName: string; itemCount: number; details: string; overflowNote: string } {
  const asOf = input.asOf ?? new Date();
  const asOfIstDate = istCalendarDateFromDate(asOf);
  const count = input.items.length;

  const entries: string[] = [];
  for (let i = 0; i < input.items.length; i += 1) {
    const entry = formatUniversityDigestEntry(input.items[i]!, i + 1, asOfIstDate);
    const candidate = entries.length === 0
      ? entry
      : `${entries.join("\n\n")}\n\n${entry}`;
    if (candidate.length > RELATIONSHIP_OWNER_DIGEST_MAX_BODY_CHARS) {
      break;
    }
    entries.push(entry);
  }

  let overflowNote = "";
  let details = entries.join("\n\n");
  const overflowCount = count - entries.length;
  if (overflowCount > 0) {
    overflowNote = `+ ${overflowCount} more follow-up(s) in the Admin Portal.`;
    while (entries.length > 0) {
      const candidate = `${entries.join("\n\n")}\n\n${overflowNote}`;
      if (candidate.length <= RELATIONSHIP_OWNER_DIGEST_MAX_BODY_CHARS) {
        details = candidate;
        break;
      }
      entries.pop();
      const remaining = count - entries.length;
      overflowNote = `+ ${remaining} more follow-up(s) in the Admin Portal.`;
    }
    if (entries.length === 0) {
      details = overflowNote;
    }
  }

  return {
    ownerName: input.ownerName,
    itemCount: count,
    details: details.trim(),
    overflowNote,
  };
}

/**
 * Approved Meta template body variables:
 * {{1}} Relationship Owner name only
 * {{2}} Total due follow-up count only
 * {{3}} Compact university list only (optional overflow line at end)
 */
export const RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_VARIABLE_DOCS = {
  bodyParameters: ["ownerName", "itemCount", "universityListBlock"],
} as const;
