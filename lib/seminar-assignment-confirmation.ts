import type { Partner, PartnerSeminarSlotAssignment } from "@/types";

/** U+2060 WORD JOINER. Phase 2 appended this to seminarTitle. It is not title text. */
export const SEMINAR_TITLE_CONFIRMATION_MARK = "\u2060";

export function seminarTitleWithoutConfirmationMarker(
  title?: string | null
): string | undefined {
  if (typeof title !== "string") return undefined;
  const cleaned = title.split(SEMINAR_TITLE_CONFIRMATION_MARK).join("");
  return cleaned.length > 0 ? cleaned : undefined;
}

function storedConfirmation(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * One-time compatible read of older rows.
 * A partner who already completed confirmation, and whose rows do not yet have
 * confirmedAt, keeps those rows locked. A Phase 2 marker only decides which
 * development rows were the confirmed ones. The marker is always removed.
 */
export function normalizePartnerSeminarConfirmations<
  T extends {
    seminarSlotsConfirmedAt?: string | null;
    seminarSlotAssignments?: readonly PartnerSeminarSlotAssignment[] | null;
  },
>(partner: T): T {
  const rows = partner.seminarSlotAssignments ?? [];
  const stamp = storedConfirmation(partner.seminarSlotsConfirmedAt);
  const hadMarker = rows.map(
    (row) =>
      typeof row.seminarTitle === "string" &&
      row.seminarTitle.includes(SEMINAR_TITLE_CONFIRMATION_MARK)
  );
  const anyMarker = hadMarker.some(Boolean);
  const anyStoredConfirmation = rows.some((row) => storedConfirmation(row.confirmedAt));
  const assignments = rows.map((row, index) => {
    let confirmedAt = storedConfirmation(row.confirmedAt);
    if (!confirmedAt && stamp && !anyStoredConfirmation) {
      if (!anyMarker || hadMarker[index]) confirmedAt = stamp;
    }
    return {
      ...row,
      seminarTitle: seminarTitleWithoutConfirmationMarker(row.seminarTitle),
      confirmedAt,
    };
  });
  return {
    ...partner,
    seminarSlotAssignments: assignments,
  };
}

/**
 * Keep confirmation metadata when a save does not send it.
 * Matching is by event and seminar, not by array position.
 * An explicit confirmedAt on the incoming row is kept.
 */
export function preserveAssignmentConfirmation<
  Existing extends {
    seminarSlotAssignments?: readonly PartnerSeminarSlotAssignment[] | null;
  },
  Next extends {
    seminarSlotAssignments?: PartnerSeminarSlotAssignment[] | null;
  },
>(existing: Existing, next: Next): Next {
  if (!next.seminarSlotAssignments) return next;
  const normalized = normalizePartnerSeminarConfirmations(existing);
  const previous = new Map(
    (normalized.seminarSlotAssignments ?? []).map((row) => [
      `${row.eventId}:${row.seminarId}`,
      row,
    ])
  );
  return {
    ...next,
    seminarSlotAssignments: next.seminarSlotAssignments.map((row) => {
      const prior = previous.get(`${row.eventId}:${row.seminarId}`);
      const explicit = Object.prototype.hasOwnProperty.call(row, "confirmedAt");
    const seminarTitle =
      seminarTitleWithoutConfirmationMarker(row.seminarTitle) ??
      seminarTitleWithoutConfirmationMarker(prior?.seminarTitle);
    const nextRow: PartnerSeminarSlotAssignment = {
      ...row,
      confirmedAt: explicit
        ? storedConfirmation(row.confirmedAt)
        : storedConfirmation(prior?.confirmedAt),
    };
    if (seminarTitle === undefined) delete nextRow.seminarTitle;
    else nextRow.seminarTitle = seminarTitle;
    return nextRow;
    }),
  };
}
