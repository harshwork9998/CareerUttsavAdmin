import type {
  Partner,
  PartnerFollowUpItem,
  PartnerMeetingLog,
} from "@/types";

import { istCalendarDateFromDate } from "@/lib/server/ist-calendar";

export type FollowUpUrgency =
  | "overdue"
  | "due_today"
  | "scheduled"
  | "re_engage";

export function toFollowUpDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function followUpUrgency(
  followUpAt: string,
  asOfIstDate: string,
  outcome: PartnerMeetingLog["outcome"]
): FollowUpUrgency {
  const day = toFollowUpDateOnly(followUpAt);
  if (day < asOfIstDate) return "overdue";
  if (outcome === "lost") return "re_engage";
  if (day === asOfIstDate) return "due_today";
  return "scheduled";
}

export function followUpUrgencyDisplayLabel(urgency: FollowUpUrgency): string {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "re_engage") return "Re-engage";
  if (urgency === "scheduled") return "Scheduled";
  return "Due today";
}

export function followUpSortRank(urgency: FollowUpUrgency): number {
  switch (urgency) {
    case "overdue":
      return 0;
    case "due_today":
      return 1;
    case "scheduled":
      return 2;
    case "re_engage":
      return 3;
    default:
      return 4;
  }
}

export function comparePartnerFollowUpItems(
  a: PartnerFollowUpItem,
  b: PartnerFollowUpItem,
  asOfIstDate: string
): number {
  const urgencyA = followUpUrgency(
    a.meeting.followUpAt!,
    asOfIstDate,
    a.meeting.outcome
  );
  const urgencyB = followUpUrgency(
    b.meeting.followUpAt!,
    asOfIstDate,
    b.meeting.outcome
  );

  const rankDiff = followUpSortRank(urgencyA) - followUpSortRank(urgencyB);
  if (rankDiff !== 0) return rankDiff;

  const dayA = toFollowUpDateOnly(a.meeting.followUpAt!);
  const dayB = toFollowUpDateOnly(b.meeting.followUpAt!);
  if (dayA !== dayB) {
    return dayA < dayB ? -1 : 1;
  }

  if (a.partner.id !== b.partner.id) {
    return a.partner.id < b.partner.id ? -1 : 1;
  }
  if (a.meeting.id === b.meeting.id) return 0;
  return a.meeting.id < b.meeting.id ? -1 : 1;
}

export function sortPartnerFollowUpItems(
  items: PartnerFollowUpItem[],
  asOf: Date = new Date()
): PartnerFollowUpItem[] {
  const asOfIstDate = istCalendarDateFromDate(asOf);
  return [...items].sort((a, b) =>
    comparePartnerFollowUpItems(a, b, asOfIstDate)
  );
}

export function isActionableFollowUpMeeting(
  meeting: PartnerMeetingLog
): boolean {
  if (!meeting.followUpAt) return false;
  return meeting.outcome === "in_discussion" || meeting.outcome === "lost";
}

export function getPartnerMeetingsForFollowUp(partner: Partner): PartnerMeetingLog[] {
  if (partner.meetings?.length) {
    return [...partner.meetings].sort(
      (a, b) =>
        new Date(b.meetingAt).getTime() - new Date(a.meetingAt).getTime()
    );
  }
  if (partner.meetingAt) {
    const meetingAt = partner.meetingAt.includes("T")
      ? partner.meetingAt
      : `${partner.meetingAt}T10:00:00`;
    return [
      {
        id: `legacy-${partner.id}`,
        meetingAt,
        notes: partner.meetingNotes,
        createdAt: partner.updatedAt,
        updatedAt: partner.updatedAt,
      },
    ];
  }
  return [];
}

export function collectDueFollowUpsFromPartners(
  partners: Partner[],
  asOf: Date = new Date()
): PartnerFollowUpItem[] {
  const items: PartnerFollowUpItem[] = [];

  for (const partner of partners) {
    for (const meeting of getPartnerMeetingsForFollowUp(partner)) {
      if (!isActionableFollowUpMeeting(meeting)) continue;
      items.push({ partner, meeting });
    }
  }

  return sortPartnerFollowUpItems(items, asOf);
}
