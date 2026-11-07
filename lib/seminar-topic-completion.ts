import type { PartnerSeminarSlotAssignment } from "@/types";

export type SeminarTopicWorkflowStatus =
  | "not_applicable"
  | "selecting"
  | "confirming"
  | "confirmed";

export type SeminarTopicWorkflow = {
  allocated: number;
  selected: number;
  confirmedCount: number;
  complete: boolean;
  status: SeminarTopicWorkflowStatus;
  confirmedSeminarIds: string[];
};

type TopicAssignment = Pick<
  PartnerSeminarSlotAssignment,
  "eventId" | "seminarId" | "slots" | "confirmedAt"
>;

export function seminarTopicWorkflowForEvent(input: {
  eventId: string;
  seminarSlotCount?: number | null;
  assignments?: readonly TopicAssignment[] | null;
}): SeminarTopicWorkflow {
  const allocated = Math.max(0, Math.floor(input.seminarSlotCount ?? 0));
  const rows = (input.assignments ?? []).filter(
    (row) => row.eventId === input.eventId && row.slots > 0
  );
  const confirmedRows = rows.filter((row) => Boolean(row.confirmedAt?.trim()));
  const selected = rows.length;
  const allConfirmed = selected > 0 && confirmedRows.length === selected;
  const complete = allocated === 0 || (selected === allocated && allConfirmed);
  let status: SeminarTopicWorkflowStatus = "not_applicable";
  if (allocated > 0 && selected < allocated) status = "selecting";
  else if (allocated > 0 && !allConfirmed) status = "confirming";
  else if (allocated > 0) status = "confirmed";

  return {
    allocated,
    selected,
    confirmedCount: confirmedRows.length,
    complete,
    status,
    confirmedSeminarIds: confirmedRows.map((row) => row.seminarId),
  };
}

/** Sorted seminar ids. Empty sets use "none" so a completion cycle stays comparable. */
export function assignmentFingerprint(seminarIds: readonly string[]): string {
  const unique = [...new Set(seminarIds.map((id) => id.trim()).filter(Boolean))].sort();
  return unique.length > 0 ? unique.join("+") : "none";
}
