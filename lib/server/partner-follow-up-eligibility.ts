import type {
  Partner,
  PartnerFollowUpItem,
  PartnerMeetingLog,
} from "@/types";

import { istCalendarDateFromDate } from "@/lib/server/ist-calendar";

export type FollowUpUrgency = "overdue" | "due_today" | "re_engage";

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
  return "due_today";
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
  const cutoff = istCalendarDateFromDate(asOf);
  const items: PartnerFollowUpItem[] = [];

  for (const partner of partners) {
    for (const meeting of getPartnerMeetingsForFollowUp(partner)) {
      if (!meeting.followUpAt) continue;
      const day = toFollowUpDateOnly(meeting.followUpAt);
      if (day > cutoff) continue;
      if (
        meeting.outcome !== "in_discussion" &&
        meeting.outcome !== "lost"
      ) {
        continue;
      }
      items.push({ partner, meeting });
    }
  }

  return items.sort(
    (a, b) =>
      new Date(a.meeting.followUpAt!).getTime() -
      new Date(b.meeting.followUpAt!).getTime()
  );
}
