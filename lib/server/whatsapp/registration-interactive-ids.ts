import {
  REGISTRATION_BOARD_OPTIONS,
  REGISTRATION_CLASS_OPTIONS,
  REGISTRATION_STREAM_OPTIONS,
  WHATSAPP_GENDER_OPTIONS,
  type WhatsAppGenderOption,
} from "@/lib/server/whatsapp/registration-options";

export const REGISTRATION_INTERACTIVE_IDS = {
  START: "registration:start",
  CONTINUE: "registration:continue",
  RESTART: "registration:restart",
  CANCEL: "registration:cancel",
  FINISH: "seminar:finish",
} as const;

const CLASS_PREFIX = "class:";
const BOARD_PREFIX = "board:";
const GENDER_PREFIX = "gender:";
const STREAM_PREFIX = "stream:";
const SEMINAR_PREFIX = "seminar:";

export function classInteractiveId(classLabel: string): string {
  return `${CLASS_PREFIX}${classLabel}`;
}

export function parseClassInteractiveId(id: string): string | null {
  if (!id.startsWith(CLASS_PREFIX)) return null;
  const value = id.slice(CLASS_PREFIX.length);
  return (REGISTRATION_CLASS_OPTIONS as readonly string[]).includes(value)
    ? value
    : null;
}

export function boardInteractiveId(board: string): string {
  return `${BOARD_PREFIX}${board}`;
}

export function parseBoardInteractiveId(id: string): string | null {
  if (!id.startsWith(BOARD_PREFIX)) return null;
  const value = id.slice(BOARD_PREFIX.length);
  return (REGISTRATION_BOARD_OPTIONS as readonly string[]).includes(value)
    ? value
    : null;
}

export function genderInteractiveId(gender: WhatsAppGenderOption): string {
  return `${GENDER_PREFIX}${gender.toLowerCase()}`;
}

export function parseGenderInteractiveId(id: string): WhatsAppGenderOption | null {
  if (!id.startsWith(GENDER_PREFIX)) return null;
  const value = id.slice(GENDER_PREFIX.length);
  const normalized =
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return (WHATSAPP_GENDER_OPTIONS as readonly string[]).includes(normalized)
    ? (normalized as WhatsAppGenderOption)
    : null;
}

export function streamInteractiveId(
  stream: (typeof REGISTRATION_STREAM_OPTIONS)[number]
): string {
  return `${STREAM_PREFIX}${stream.toLowerCase()}`;
}

export function parseStreamInteractiveId(
  id: string
): (typeof REGISTRATION_STREAM_OPTIONS)[number] | null {
  if (!id.startsWith(STREAM_PREFIX)) return null;
  const value = id.slice(STREAM_PREFIX.length);
  const normalized =
    value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  return (REGISTRATION_STREAM_OPTIONS as readonly string[]).includes(normalized)
    ? (normalized as (typeof REGISTRATION_STREAM_OPTIONS)[number])
    : null;
}

export function seminarInteractiveId(seminarId: string): string {
  return `${SEMINAR_PREFIX}${seminarId}`;
}

export function parseSeminarInteractiveId(id: string): string | null {
  if (!id.startsWith(SEMINAR_PREFIX)) return null;
  const seminarId = id.slice(SEMINAR_PREFIX.length).trim();
  return seminarId.length > 0 ? seminarId : null;
}

export function isRegistrationInteractiveId(id: string): boolean {
  return (
    id === REGISTRATION_INTERACTIVE_IDS.START ||
    id === REGISTRATION_INTERACTIVE_IDS.CONTINUE ||
    id === REGISTRATION_INTERACTIVE_IDS.RESTART ||
    id === REGISTRATION_INTERACTIVE_IDS.CANCEL ||
    id === REGISTRATION_INTERACTIVE_IDS.FINISH ||
    id.startsWith(CLASS_PREFIX) ||
    id.startsWith(BOARD_PREFIX) ||
    id.startsWith(GENDER_PREFIX) ||
    id.startsWith(STREAM_PREFIX) ||
    id.startsWith(SEMINAR_PREFIX)
  );
}
