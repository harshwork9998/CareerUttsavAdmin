import { format, parseISO } from "date-fns";

import type {
  Partner,
  PartnerFollowUpItem,
  PartnerMeetingLog,
  PartnerMeetingOutcome,
} from "@/types";

export const MEETING_OUTCOME_LABELS: Record<PartnerMeetingOutcome, string> = {
  won: "Deal won",
  lost: "Deal lost",
  in_discussion: "In discussion",
};

export function combineDateAndTime(date: string, time: string): string {
  if (!date) return "";
  const t = time?.trim() || "09:00";
  return `${date}T${t}:00`;
}

export function splitDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return { date: iso, time: "09:00" };
  }
  const normalized = iso.includes("T") ? iso : `${iso}T09:00:00`;
  const parsed = parseISO(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return { date: iso.slice(0, 10), time: "09:00" };
  }
  return {
    date: format(parsed, "yyyy-MM-dd"),
    time: format(parsed, "HH:mm"),
  };
}

export function formatMeetingDateTime(iso: string): string {
  const { date, time } = splitDateTime(iso);
  if (!date) return "—";
  const parsed = parseISO(`${date}T${time || "09:00"}:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return format(parsed, "EEE, d MMM yyyy · h:mm a");
}

export function formatFollowUpDateTime(iso: string): string {
  return formatMeetingDateTime(iso);
}

export function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function getPartnerMeetings(partner: Partner): PartnerMeetingLog[] {
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

export function hasLoggedMeeting(partner: Partner): boolean {
  return getPartnerMeetings(partner).length > 0;
}

export function hasWonMeeting(partner: Partner): boolean {
  return getPartnerMeetings(partner).some((m) => m.outcome === "won");
}

export function syncLegacyMeetingFields(
  partner: Partner,
  meetings: PartnerMeetingLog[]
): Pick<Partner, "meetingAt" | "meetingNotes"> {
  if (meetings.length === 0) {
    return { meetingAt: undefined, meetingNotes: undefined };
  }
  const latest = [...meetings].sort(
    (a, b) =>
      new Date(b.meetingAt).getTime() - new Date(a.meetingAt).getTime()
  )[0];
  return {
    meetingAt: toDateOnly(latest.meetingAt),
    meetingNotes: latest.notes,
  };
}

export function getFollowUpsDueOnDate(
  partners: Partner[],
  onDate: Date = new Date()
): PartnerFollowUpItem[] {
  const target = format(onDate, "yyyy-MM-dd");
  return collectFollowUps(partners, (followUpDay) => followUpDay === target);
}

/** Follow-ups due today or overdue (on or before today). */
export function getFollowUpsDue(
  partners: Partner[],
  asOf: Date = new Date()
): PartnerFollowUpItem[] {
  const cutoff = format(asOf, "yyyy-MM-dd");
  return collectFollowUps(
    partners,
    (followUpDay) => followUpDay <= cutoff
  );
}

function collectFollowUps(
  partners: Partner[],
  includeDay: (followUpDay: string) => boolean
): PartnerFollowUpItem[] {
  const items: PartnerFollowUpItem[] = [];

  for (const partner of partners) {
    for (const meeting of getPartnerMeetings(partner)) {
      if (!meeting.followUpAt) continue;
      const day = toDateOnly(meeting.followUpAt);
      if (!includeDay(day)) continue;
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

export function followUpDialogStorageKey(date: Date = new Date()): string {
  return `cu-partner-followups-seen-${format(date, "yyyy-MM-dd")}`;
}

export function hasSeenFollowUpDialogToday(date: Date = new Date()): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(followUpDialogStorageKey(date)) === "1";
}

export function markFollowUpDialogSeen(date: Date = new Date()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(followUpDialogStorageKey(date), "1");
}
