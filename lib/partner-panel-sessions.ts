import { seminarTimeLabel, SEMINAR_SCHEDULE_UNSET_LABEL } from "@/lib/seminar-schedule";
import type { PanelSessionView } from "@/lib/partner-pending-state";
import type { Event, Partner } from "@/types";

function sessionDateLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function clockLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.toUpperCase() === SEMINAR_SCHEDULE_UNSET_LABEL) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return null;
  const label = seminarTimeLabel(trimmed);
  return label === SEMINAR_SCHEDULE_UNSET_LABEL ? null : label;
}

function sessionTimeLabel(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const startLabel = clockLabel(start);
  const endLabel = clockLabel(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel;
}

function sessionHallLabel(hall: number | null | undefined): string | null {
  if (hall == null || !Number.isInteger(hall) || hall < 1) return null;
  return `Hall ${hall}`;
}

export function panelSessionsForPartner(
  partner: Pick<Partner, "seminarSlotAssignments">,
  events: Event[]
): PanelSessionView[] {
  const seminars = new Map(
    events.flatMap((event) =>
      (event.seminars ?? []).map((seminar) => [seminar.id, seminar] as const)
    )
  );
  return (partner.seminarSlotAssignments ?? [])
    .filter((assignment) => assignment.slots > 0)
    .map((assignment) => {
      const seminar = seminars.get(assignment.seminarId);
      return {
        eventId: assignment.eventId,
        seminarId: assignment.seminarId,
        topic:
          assignment.seminarTitle?.trim() ||
          seminar?.title?.trim() ||
          "Panel Discussion",
        dateLabel: sessionDateLabel(seminar?.date),
        timeLabel: sessionTimeLabel(seminar?.startTime, seminar?.endTime),
        hallLabel: sessionHallLabel(seminar?.hall),
      };
    });
}
