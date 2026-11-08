import type {
  Partner,
  PartnerSeminarSpeakerDetail,
  SeminarSessionRoster,
  SeminarSpeaker,
} from "@/types";

export type PartnerSeatBlock = {
  seatIndex: number;
  partner: Partner;
  /** Index within this partner's allotted speakers for the seminar */
  speakerSlotIndex: number;
  portalSpeaker?: PartnerSeminarSpeakerDetail;
  confirmed: boolean;
};

export function speakerIdForPartnerSeat(
  partnerId: string,
  seatIndex: number
): string {
  return `partner-seat-${partnerId}-${seatIndex}`;
}

/** Partners who hold at least one saved seminar topic, confirmed or still pending. */
export function partnersWithSeminarSeats(partners: Partner[]): Partner[] {
  return partners.filter((partner) =>
    (partner.seminarSlotAssignments ?? []).some((row) => row.slots > 0)
  );
}

/** Map panelist seat indices to partner blocks for a seminar session. */
export function buildPartnerSeatBlocks(
  partners: Partner[],
  eventId: string,
  seminarId: string,
  totalSlots: number
): PartnerSeatBlock[] {
  const blocks: PartnerSeatBlock[] = [];
  let nextSeat = 0;
  const seated = partnersWithSeminarSeats(partners)
    .map((partner) => ({
      partner,
      assignment: partner.seminarSlotAssignments?.find(
        (row) => row.eventId === eventId && row.seminarId === seminarId && row.slots > 0
      ),
    }))
    .filter((row): row is { partner: Partner; assignment: NonNullable<typeof row.assignment> } =>
      Boolean(row.assignment)
    )
    .sort((left, right) => {
      const leftTime = left.assignment.confirmedAt
        ? Date.parse(left.assignment.confirmedAt)
        : Number.POSITIVE_INFINITY;
      const rightTime = right.assignment.confirmedAt
        ? Date.parse(right.assignment.confirmedAt)
        : Number.POSITIVE_INFINITY;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.partner.name.localeCompare(right.partner.name);
    });

  for (const { partner, assignment } of seated) {
    const portalRow = partner.portalSeminarSpeakers?.find(
      (row) => row.eventId === eventId && row.seminarId === seminarId
    );

    for (
      let speakerSlotIndex = 0;
      speakerSlotIndex < assignment.slots && nextSeat < totalSlots;
      speakerSlotIndex += 1, nextSeat += 1
    ) {
      blocks.push({
        seatIndex: nextSeat,
        partner,
        speakerSlotIndex,
        portalSpeaker: portalRow?.speakers[speakerSlotIndex],
        confirmed: Boolean(assignment.confirmedAt?.trim()),
      });
    }
  }

  return blocks;
}

export function blockedPartnerForSeat(
  blocks: PartnerSeatBlock[],
  seatIndex: number
): PartnerSeatBlock | undefined {
  return blocks.find((block) => block.seatIndex === seatIndex);
}

export function createSpeakerFromPartnerBlock(
  block: PartnerSeatBlock
): SeminarSpeaker {
  return speakerFromPartnerBlock(block);
}

function portalContact(
  portal?: PartnerSeminarSpeakerDetail
): string | undefined {
  return (
    portal?.contact?.trim() ||
    portal?.email?.trim() ||
    portal?.phone?.trim() ||
    undefined
  );
}

function speakerFromPartnerBlock(block: PartnerSeatBlock): SeminarSpeaker {
  const portal = block.portalSpeaker;
  const partnerName = block.partner.name;
  const name = portal?.name?.trim() ?? "";

  return {
    id: speakerIdForPartnerSeat(block.partner.id, block.seatIndex),
    name,
    designation: portal?.designation,
    contact: portalContact(portal),
    introduction: portal?.introduction,
    photoUrl: portal?.photoUrl?.trim() || undefined,
    photoStorageProvider: portal?.photoStorageProvider,
    photoStorageBucket: portal?.photoStorageBucket,
    photoStoragePath: portal?.photoStoragePath,
    portalSpeakerId: portal?.id,
    organization: partnerName,
    partnerId: block.partner.id,
    seatIndex: block.seatIndex,
    status: name ? "Invited" : "Invited",
  };
}

function blockedPlaceholderSpeaker(block: PartnerSeatBlock): SeminarSpeaker {
  return speakerFromPartnerBlock(block);
}

/** Merge saved roster panelists with partner-blocked seats and portal speaker details. */
export function mergeRosterWithPartnerSeats(
  savedRoster: SeminarSessionRoster | null,
  eventId: string,
  seminarId: string,
  totalSlots: number,
  partners: Partner[]
): SeminarSessionRoster {
  const blocks = buildPartnerSeatBlocks(
    partners,
    eventId,
    seminarId,
    totalSlots
  );
  const blockBySeat = new Map(blocks.map((block) => [block.seatIndex, block]));
  const seats: (SeminarSpeaker | null)[] = Array.from(
    { length: totalSlots },
    () => null
  );

  for (const speaker of savedRoster?.panelists ?? []) {
    const seatIndex =
      speaker.seatIndex ??
      savedRoster?.panelists.indexOf(speaker) ??
      -1;
    if (seatIndex < 0 || seatIndex >= totalSlots) continue;
    const block = blockBySeat.get(seatIndex);
    seats[seatIndex] = {
      ...speaker,
      seatIndex,
      partnerId: speaker.partnerId ?? block?.partner.id,
      organization: speaker.organization || block?.partner.name || "",
    };
  }

  for (const block of blocks) {
    const existing = seats[block.seatIndex];
    const portal = block.portalSpeaker;
    const portalName = portal?.name?.trim();
    const portalFields = {
      name: portalName || existing?.name?.trim() || "",
      designation: portal?.designation || existing?.designation,
      contact: portalContact(portal) || existing?.contact,
      introduction: portal?.introduction || existing?.introduction,
      photoUrl: portal?.photoUrl?.trim() || existing?.photoUrl,
      photoStorageProvider: portal?.photoStorageProvider || existing?.photoStorageProvider,
      photoStorageBucket: portal?.photoStorageBucket || existing?.photoStorageBucket,
      photoStoragePath: portal?.photoStoragePath || existing?.photoStoragePath,
      portalSpeakerId: portal?.id || existing?.portalSpeakerId,
      organization: existing?.organization || block.partner.name,
      partnerId: existing?.partnerId ?? block.partner.id,
      seatIndex: block.seatIndex,
    };

    if (existing) {
      seats[block.seatIndex] = {
        ...existing,
        ...portalFields,
      };
      continue;
    }
    seats[block.seatIndex] = speakerFromPartnerBlock(block);
  }

  const panelists = seats.filter(
    (speaker): speaker is SeminarSpeaker => speaker !== null
  );

  return {
    seminarId,
    eventId,
    moderator: savedRoster?.moderator ?? null,
    panelists,
    topicBrief: savedRoster?.topicBrief ?? "",
    notes: savedRoster?.notes ?? "",
    updatedAt: savedRoster?.updatedAt ?? new Date().toISOString(),
  };
}

export function panelistSeatsFromRoster(
  roster: SeminarSessionRoster,
  totalSlots: number
): (SeminarSpeaker | null)[] {
  const seats: (SeminarSpeaker | null)[] = Array.from(
    { length: totalSlots },
    () => null
  );
  for (const speaker of roster.panelists) {
    const seatIndex = speaker.seatIndex ?? roster.panelists.indexOf(speaker);
    if (seatIndex >= 0 && seatIndex < totalSlots) {
      seats[seatIndex] = { ...speaker, seatIndex };
    }
  }
  return seats;
}

export function rosterFromPanelistSeats(
  base: SeminarSessionRoster,
  panelistSeats: (SeminarSpeaker | null)[]
): SeminarSessionRoster {
  const panelists: SeminarSpeaker[] = [];
  panelistSeats.forEach((speaker, seatIndex) => {
    if (!speaker) return;
    panelists.push({ ...speaker, seatIndex });
  });

  return {
    ...base,
    panelists,
    updatedAt: new Date().toISOString(),
  };
}

export function resetBlockedSeat(
  blocks: PartnerSeatBlock[],
  seatIndex: number
): SeminarSpeaker | null {
  const block = blockedPartnerForSeat(blocks, seatIndex);
  if (!block) return null;
  return blockedPlaceholderSpeaker(block);
}

export type SeatDisplayMeta = {
  seatIndex: number;
  blocked: boolean;
  partnerName?: string;
  awaitingSpeaker: boolean;
  confirmation?: "Confirmed" | "Pending Confirmation";
};

export function seatDisplayMetaForSeminar(
  panelistSeats: (SeminarSpeaker | null)[],
  blocks: PartnerSeatBlock[]
): SeatDisplayMeta[] {
  return panelistSeats.map((speaker, seatIndex) => {
    const block = blockedPartnerForSeat(blocks, seatIndex);
    const blocked = Boolean(block);
    const awaitingSpeaker = blocked && !speaker?.name?.trim();
    return {
      seatIndex,
      blocked,
      partnerName: block?.partner.name,
      awaitingSpeaker,
      confirmation: block
        ? block.confirmed
          ? "Confirmed"
          : "Pending Confirmation"
        : undefined,
    };
  });
}
