import {
  followUpUrgency,
  toFollowUpDateOnly,
} from "@/lib/server/partner-follow-up-eligibility";
import { istCalendarDateFromDate } from "@/lib/server/ist-calendar";
import type { PartnerFollowUpItem } from "@/types";

export const RELATIONSHIP_OWNER_DIGEST_MAX_VISIBLE_FOLLOW_UPS = 5;

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

export function sanitizeMetaTemplateParameterText(value: string): string {
  return value
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function formatUniversityFollowUpLine(
  item: PartnerFollowUpItem,
  asOfIstDate: string
): string {
  const { partner, meeting } = item;
  const urgency = followUpUrgency(
    meeting.followUpAt!,
    asOfIstDate,
    meeting.outcome
  );

  const segments: string[] = [partner.name.trim()];

  const contactName = (partner.primaryContact?.name ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const contactPhone = (partner.primaryContact?.phone ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (contactName) {
    segments.push(contactName);
  }
  if (contactPhone) {
    segments.push(contactPhone);
  }

  segments.push(urgencyLabel(urgency));
  segments.push(formatFollowUpDateLabel(meeting.followUpAt!));

  return sanitizeMetaTemplateParameterText(segments.join(" | "));
}

/** @deprecated Use formatUniversityFollowUpLine — numbering lives in Meta templates. */
export function formatUniversityDigestEntry(
  item: PartnerFollowUpItem,
  _index: number,
  asOfIstDate: string
): string {
  return formatUniversityFollowUpLine(item, asOfIstDate);
}

export function buildRelationshipOwnerFollowUpOverflowLine(
  overflowCount: number
): string {
  if (overflowCount <= 0) return "";
  if (overflowCount === 1) {
    return sanitizeMetaTemplateParameterText(
      "+ 1 more follow-up available in the Admin Portal"
    );
  }
  return sanitizeMetaTemplateParameterText(
    `+ ${overflowCount} more follow-ups available in the Admin Portal`
  );
}

export type RelationshipOwnerFollowUpDigestPayload = {
  ownerName: string;
  followUpCount: number;
  visibleFollowUpCount: number;
  overflowCount: number;
  followUpLines: string[];
  overflowLine: string;
};

export function buildRelationshipOwnerFollowUpDigestPayload(input: {
  ownerName: string;
  items: PartnerFollowUpItem[];
  asOf?: Date;
}): RelationshipOwnerFollowUpDigestPayload {
  const asOf = input.asOf ?? new Date();
  const asOfIstDate = istCalendarDateFromDate(asOf);
  const followUpCount = input.items.length;
  const visibleFollowUpCount = Math.min(
    followUpCount,
    RELATIONSHIP_OWNER_DIGEST_MAX_VISIBLE_FOLLOW_UPS
  );
  const overflowCount = Math.max(0, followUpCount - visibleFollowUpCount);

  const followUpLines: string[] = [];
  for (let i = 0; i < visibleFollowUpCount; i += 1) {
    followUpLines.push(
      formatUniversityFollowUpLine(input.items[i]!, asOfIstDate)
    );
  }

  return {
    ownerName: sanitizeMetaTemplateParameterText(input.ownerName),
    followUpCount,
    visibleFollowUpCount,
    overflowCount,
    followUpLines,
    overflowLine: buildRelationshipOwnerFollowUpOverflowLine(overflowCount),
  };
}

/** Backward-compatible shape for older tests/callers. */
export function buildRelationshipOwnerFollowUpDigestText(input: {
  ownerName: string;
  items: PartnerFollowUpItem[];
  asOf?: Date;
}): {
  ownerName: string;
  itemCount: number;
  details: string;
  overflowNote: string;
  visibleFollowUpCount: number;
  overflowCount: number;
  followUpLines: string[];
} {
  const payload = buildRelationshipOwnerFollowUpDigestPayload(input);
  return {
    ownerName: payload.ownerName,
    itemCount: payload.followUpCount,
    details: payload.followUpLines.join(" | "),
    overflowNote: payload.overflowLine,
    visibleFollowUpCount: payload.visibleFollowUpCount,
    overflowCount: payload.overflowCount,
    followUpLines: payload.followUpLines,
  };
}

export function buildRelationshipOwnerFollowUpTemplateBodyParameters(
  payload: RelationshipOwnerFollowUpDigestPayload
): { type: "text"; text: string }[] {
  const parameters: { type: "text"; text: string }[] = [
    {
      type: "text",
      text: sanitizeMetaTemplateParameterText(payload.ownerName),
    },
    {
      type: "text",
      text: sanitizeMetaTemplateParameterText(String(payload.followUpCount)),
    },
    ...payload.followUpLines.map((line) => ({
      type: "text" as const,
      text: sanitizeMetaTemplateParameterText(line),
    })),
  ];
  if (payload.overflowCount > 0) {
    parameters.push({
      type: "text",
      text: sanitizeMetaTemplateParameterText(payload.overflowLine),
    });
  }
  return parameters;
}

export const RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_VARIABLE_DOCS = {
  bodyParameters: [
    "ownerName",
    "totalDueCount",
    "followUpLine1",
    "followUpLineN",
    "overflowLineOptional",
  ],
} as const;
