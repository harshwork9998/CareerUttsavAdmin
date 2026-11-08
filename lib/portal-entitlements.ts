import { isValidIndianMobile } from "@/lib/indian-mobile";
import { seminarTopicWorkflowForEvent } from "@/lib/seminar-topic-completion";
import type { PanelSessionView } from "@/lib/partner-pending-state";
import { isSubmittedPortalDocument } from "@/lib/partner-portal-document";
import { speakerHasPersistedPhoto } from "@/lib/partner-portal-speaker";
import type {
  PartnerDeliverable,
  PartnerPortalDocument,
  PartnerRepresentativesSubmission,
  PartnerSeminarSpeakerDetail,
  PartnerSeminarSpeakerSubmission,
  PartnerSeminarSlotAssignment,
} from "@/types";

export type PartnershipEntitlementDocument = Pick<PartnerPortalDocument, "kind"> &
  Partial<
    Pick<
      PartnerPortalDocument,
      "url" | "fileName" | "storageProvider" | "storageBucket" | "storagePath"
    >
  >;

export type PortalSubmissionKey =
  | "logo"
  | "fascia_name"
  | "website_link"
  | "souvenir_writeup"
  | "ad_creative"
  | "sms_content"
  | "speaker_details"
  | "representatives";

export const PORTAL_SUBMISSION_KEY_ORDER: PortalSubmissionKey[] = [
  "logo",
  "fascia_name",
  "website_link",
  "souvenir_writeup",
  "ad_creative",
  "sms_content",
  "speaker_details",
  "representatives",
];

export type PartnershipEntitlementInput = {
  eventId: string;
  deliverables: PartnerDeliverable[];
  representativeSlotCount: number;
  seminarSlotCount?: number | null;
  assignments?: readonly Pick<
    PartnerSeminarSlotAssignment,
    "eventId" | "seminarId" | "slots" | "confirmedAt"
  >[] | null;
  sessions: PanelSessionView[];
  portalFasciaName?: string | null;
  portalWebsiteUrl?: string | null;
  portalSmsContent?: string | null;
  documents?: PartnershipEntitlementDocument[] | null;
  speakers?: PartnerSeminarSpeakerSubmission[] | null;
  representatives?: PartnerRepresentativesSubmission[] | null;
};

export type SubmissionEntitlement = {
  applicable: boolean;
  complete: boolean;
};

function included(
  deliverables: PartnerDeliverable[],
  key: string
): PartnerDeliverable | undefined {
  return deliverables.find(
    (item) => item.included && !item.isCustom && item.key === key
  );
}

function includedAcross(
  deliverablesList: PartnerDeliverable[][],
  key: string
): boolean {
  return deliverablesList.some((deliverables) => Boolean(included(deliverables, key)));
}

function hasDoc(
  documents: PartnershipEntitlementInput["documents"],
  kind: PartnerPortalDocument["kind"]
): boolean {
  return (documents ?? []).some((doc) => {
    if (
      doc.kind !== kind &&
      !(kind === "souvenir_writeup" && doc.kind === "writeup")
    ) {
      return false;
    }
    const hasPayloadFields =
      doc.url !== undefined ||
      doc.fileName !== undefined ||
      doc.storagePath !== undefined;
    if (!hasPayloadFields) return true;
    return isSubmittedPortalDocument(doc);
  });
}

export function isPartnerSpeakerComplete(
  speaker: Partial<PartnerSeminarSpeakerDetail> | null | undefined
): boolean {
  if (!speaker) return false;
  const contact = speaker.contact ?? speaker.phone ?? "";
  return Boolean(
    speaker.name?.trim() &&
      speaker.designation?.trim() &&
      speaker.introduction?.trim() &&
      speakerHasPersistedPhoto(speaker) &&
      isValidIndianMobile(contact)
  );
}

export function isValidRepresentative(person: {
  name?: string;
  designation?: string;
  phone?: string;
}): boolean {
  return Boolean(
    person.name?.trim() &&
      person.designation?.trim() &&
      isValidIndianMobile(person.phone ?? "")
  );
}

export function isAdCreativeApplicable(deliverables: PartnerDeliverable[]): boolean {
  if (included(deliverables, "eventSouvenirAd")) return true;
  if (included(deliverables, "bookAdPremiumSpot")) return true;
  const plus2 = included(deliverables, "bookAdCareersAfterPlus2");
  if (!plus2) return false;
  const option = plus2.option?.trim().toLowerCase() ?? "";
  if (!option) return true;
  return option === "full page" || option === "half page";
}

function sessionComplete(
  input: PartnershipEntitlementInput,
  session: PanelSessionView
): boolean {
  return (input.speakers ?? []).some(
    (row) =>
      row.eventId === session.eventId &&
      row.seminarId === session.seminarId &&
      row.speakers.some((speaker) => isPartnerSpeakerComplete(speaker))
  );
}

export function representativesCompleteForEvent(
  input: Pick<
    PartnershipEntitlementInput,
    "eventId" | "representativeSlotCount" | "representatives"
  >
): boolean {
  const required = Math.max(0, Math.floor(input.representativeSlotCount ?? 0));
  if (required < 1) return true;
  const row = (input.representatives ?? []).find(
    (item) => item.eventId === input.eventId
  );
  const valid = (row?.representatives ?? []).filter((person) =>
    isValidRepresentative(person)
  );
  return valid.length >= required;
}

export function partnershipSubmissionEntitlements(
  input: PartnershipEntitlementInput
): Record<PortalSubmissionKey, SubmissionEntitlement> {
  const deliverables = input.deliverables ?? [];
  const representativeSlots = Math.max(
    0,
    Math.floor(input.representativeSlotCount ?? 0)
  );
  const sessions = input.sessions ?? [];

  const logo = {
    applicable: true,
    complete: hasDoc(input.documents, "logo"),
  };
  const fascia = {
    applicable: true,
    complete: Boolean(input.portalFasciaName?.trim()),
  };
  const website = {
    applicable: true,
    complete: Boolean(input.portalWebsiteUrl?.trim()),
  };
  const writeup = {
    applicable: Boolean(included(deliverables, "fullPageWriteup")),
    complete: hasDoc(input.documents, "souvenir_writeup"),
  };
  const adCreative = {
    applicable: isAdCreativeApplicable(deliverables),
    complete: hasDoc(input.documents, "ad_creative"),
  };
  const sms = {
    applicable: Boolean(included(deliverables, "smsMailerCampaign")),
    complete: Boolean(input.portalSmsContent?.trim()),
  };
  const speakers = {
    applicable: sessions.length > 0,
    complete:
      sessions.length > 0
        ? sessions.every((session) => sessionComplete(input, session))
        : true,
  };
  const representatives = {
    applicable: representativeSlots > 0,
    complete: representativesCompleteForEvent(input),
  };

  return {
    logo,
    fascia_name: fascia,
    website_link: website,
    souvenir_writeup: writeup,
    ad_creative: adCreative,
    sms_content: sms,
    speaker_details: speakers,
    representatives,
  };
}

export type PartnerPortalEntitlementInput = {
  partnerships: Array<{
    eventId: string;
    deliverables: PartnerDeliverable[];
    representativeSlotCount?: number | null;
    seminarSlotCount?: number | null;
  }>;
  seminarSlotAssignments?: PartnerSeminarSlotAssignment[] | null;
  sessions: PanelSessionView[];
  portalFasciaName?: string | null;
  portalWebsiteUrl?: string | null;
  portalSmsContent?: string | null;
  documents?: PartnershipEntitlementDocument[] | null;
  speakers?: PartnerSeminarSpeakerSubmission[] | null;
  representatives?: PartnerRepresentativesSubmission[] | null;
};

export function partnerPortalSubmissionEntitlements(
  input: PartnerPortalEntitlementInput
): Record<PortalSubmissionKey, SubmissionEntitlement> {
  const deliverablesList = input.partnerships.map((p) => p.deliverables ?? []);
  const repSlots = input.partnerships.map((p) => ({
    eventId: p.eventId,
    slots: Math.max(0, Math.floor(p.representativeSlotCount ?? 0)),
  }));

  const perEvent = input.partnerships.map((partnership) =>
    partnershipSubmissionEntitlements({
      eventId: partnership.eventId,
      deliverables: partnership.deliverables ?? [],
      representativeSlotCount: partnership.representativeSlotCount ?? 0,
      seminarSlotCount: partnership.seminarSlotCount,
      assignments: input.seminarSlotAssignments,
      sessions: input.sessions.filter((s) => s.eventId === partnership.eventId),
      portalFasciaName: input.portalFasciaName,
      portalWebsiteUrl: input.portalWebsiteUrl,
      portalSmsContent: input.portalSmsContent,
      documents: input.documents,
      speakers: input.speakers,
      representatives: input.representatives,
    })
  );

  const mergeApplicable = (key: PortalSubmissionKey): boolean => {
    if (key === "logo" || key === "fascia_name" || key === "website_link") {
      return true;
    }
    if (key === "souvenir_writeup") {
      return includedAcross(deliverablesList, "fullPageWriteup");
    }
    if (key === "ad_creative") {
      return deliverablesList.some((d) => isAdCreativeApplicable(d));
    }
    if (key === "sms_content") {
      return includedAcross(deliverablesList, "smsMailerCampaign");
    }
    if (key === "speaker_details") {
      return (input.sessions ?? []).length > 0;
    }
    if (key === "representatives") {
      return repSlots.some((row) => row.slots > 0);
    }
    return false;
  };

  const mergeComplete = (key: PortalSubmissionKey): boolean => {
    if (key === "representatives") {
      const eventsRequiringReps = repSlots.filter((row) => row.slots > 0);
      if (eventsRequiringReps.length === 0) return true;
      return eventsRequiringReps.every((row) =>
        representativesCompleteForEvent({
          eventId: row.eventId,
          representativeSlotCount: row.slots,
          representatives: input.representatives,
        })
      );
    }
    if (perEvent.length === 0) {
      const empty = partnershipSubmissionEntitlements({
        eventId: "",
        deliverables: [],
        representativeSlotCount: 0,
        sessions: input.sessions,
        portalFasciaName: input.portalFasciaName,
        portalWebsiteUrl: input.portalWebsiteUrl,
        portalSmsContent: input.portalSmsContent,
        documents: input.documents,
        speakers: input.speakers,
        representatives: input.representatives,
      });
      return empty[key].complete;
    }
    if (key === "logo" || key === "fascia_name" || key === "website_link") {
      return perEvent[0]?.[key]?.complete ?? false;
    }
    if (
      key === "souvenir_writeup" ||
      key === "ad_creative" ||
      key === "sms_content"
    ) {
      return perEvent.every((row) => !row[key].applicable || row[key].complete);
    }
    if (key === "speaker_details") {
      return perEvent.every((row) => !row.speaker_details.applicable || row.speaker_details.complete);
    }
    return perEvent.every(
      (row) => !row.representatives.applicable || row.representatives.complete
    );
  };

  return PORTAL_SUBMISSION_KEY_ORDER.reduce(
    (acc, key) => {
      acc[key] = {
        applicable: mergeApplicable(key),
        complete: mergeComplete(key),
      };
      return acc;
    },
    {} as Record<PortalSubmissionKey, SubmissionEntitlement>
  );
}

export function seminarPanelApplicable(input: {
  seminarSlotCount?: number | null;
  assignments?: readonly Pick<
    PartnerSeminarSlotAssignment,
    "eventId" | "seminarId" | "slots" | "confirmedAt"
  >[] | null;
  eventId: string;
}): boolean {
  const workflow = seminarTopicWorkflowForEvent({
    eventId: input.eventId,
    seminarSlotCount: input.seminarSlotCount,
    assignments: input.assignments,
  });
  return workflow.status !== "not_applicable";
}
