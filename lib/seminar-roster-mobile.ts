import { validateIndianMobileOnWrite } from "@/lib/indian-mobile";
import type { SeminarSessionRoster, SeminarSpeaker } from "@/types";

function findPreviousSpeaker(
  existing: SeminarSessionRoster | undefined,
  speaker: SeminarSpeaker
): SeminarSpeaker | null {
  if (!existing) return null;
  if (existing.moderator?.id === speaker.id) return existing.moderator;
  return existing.panelists.find((p) => p.id === speaker.id) ?? null;
}

/**
 * Enforce Indian mobile on speaker.contact only when newly set or edited.
 * Unchanged historical email/landline values are preserved as-is.
 * Empty contact remains allowed.
 */
export function applySeminarSpeakerMobileValidation(
  incoming: SeminarSessionRoster,
  existing: SeminarSessionRoster | undefined
): { ok: true; roster: SeminarSessionRoster } | { ok: false; error: string } {
  const validateOne = (
    speaker: SeminarSpeaker | null
  ): { ok: true; speaker: SeminarSpeaker | null } | { ok: false; error: string } => {
    if (!speaker) return { ok: true, speaker: null };
    const previous = findPreviousSpeaker(existing, speaker);
    const nextContact = speaker.contact ?? "";
    const prevContact = previous?.contact ?? "";

    if (!nextContact.trim()) {
      return { ok: true, speaker: { ...speaker, contact: nextContact.trim() } };
    }

    const checked = validateIndianMobileOnWrite(nextContact, prevContact, {
      required: false,
      label: `Mobile number for ${speaker.name?.trim() || "speaker"}`,
    });
    if (!checked.ok) return checked;
    return { ok: true, speaker: { ...speaker, contact: checked.value } };
  };

  const moderator = validateOne(incoming.moderator ?? null);
  if (!moderator.ok) return moderator;

  const panelists: SeminarSpeaker[] = [];
  for (const speaker of incoming.panelists ?? []) {
    const result = validateOne(speaker);
    if (!result.ok) return result;
    if (result.speaker) panelists.push(result.speaker);
  }

  return {
    ok: true,
    roster: {
      ...incoming,
      moderator: moderator.speaker,
      panelists,
    },
  };
}
