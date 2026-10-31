import { describe, expect, it } from "vitest";

import {
  arePortalSpeakerDetailsComplete,
  getPartnerPortalUploadStatus,
  PORTAL_SUBMISSION_ITEMS,
} from "@/lib/partner-portal-docs";
import type { Partner, PartnerSeminarSlotAssignment } from "@/types";

const completeSpeaker = {
  name: "Asha Rao",
  designation: "Dean",
  contact: "9876543210",
  introduction: "Leads student outreach.",
  photoUrl: "https://example.com/asha.png",
};

function assignment(
  eventId: string,
  seminarId: string,
  slots = 1
): PartnerSeminarSlotAssignment {
  return { eventId, seminarId, slots, seminarTitle: "Topic" };
}

function partner(
  overrides: Partial<Partner> & {
    seminarSlotAssignments?: PartnerSeminarSlotAssignment[];
    portalSeminarSpeakers?: Partner["portalSeminarSpeakers"];
  } = {}
): Partner {
  return {
    id: "p1",
    name: "Example University",
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: {
      name: "Primary",
      designation: "",
      phone: "9876543210",
      email: "p@example.edu",
    },
    secondaryContact: {
      name: "",
      designation: "",
      phone: "",
      email: "",
    },
    eventIds: ["evt-001"],
    relationshipOwner: {
      organization: "K2",
      managerName: "Owner",
      managerPhone: "9876543210",
      managerEmail: "owner@example.com",
    },
    stage: "Confirmed",
    stageRemarks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    seminarSlotAssignments: [],
    portalSeminarSpeakers: [],
    portalDocuments: [],
    ...overrides,
  };
}

function speakerItem(
  overrides: Partial<typeof completeSpeaker> = {},
  ids?: { eventId: string; seminarId: string }
) {
  return {
    eventId: ids?.eventId ?? "evt-001",
    seminarId: ids?.seminarId ?? "sem-a",
    updatedAt: "2026-11-01T00:00:00.000Z",
    speakers: [{ ...completeSpeaker, ...overrides }],
  };
}

describe("arePortalSpeakerDetailsComplete", () => {
  it("is incomplete when there are zero allotted seminar slots", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({ seminarSlotAssignments: [], portalSeminarSpeakers: [] })
      )
    ).toBe(false);
  });

  it("is incomplete when slots are allotted but no speaker rows exist", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          seminarSlotAssignments: [assignment("evt-001", "sem-a")],
          portalSeminarSpeakers: [],
        })
      )
    ).toBe(false);
  });

  it("is incomplete for name-only speaker data", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          seminarSlotAssignments: [assignment("evt-001", "sem-a")],
          portalSeminarSpeakers: [
            speakerItem({
              name: "Rahul",
              designation: "",
              contact: "",
              introduction: "",
              photoUrl: "",
            }),
          ],
        })
      )
    ).toBe(false);
  });

  it.each([
    ["designation", { designation: "" }],
    ["mobile", { contact: "12345" }],
    ["introduction", { introduction: "" }],
    ["photo", { photoUrl: "" }],
  ] as const)("is incomplete when %s is missing", (_label, patch) => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          seminarSlotAssignments: [assignment("evt-001", "sem-a")],
          portalSeminarSpeakers: [speakerItem(patch)],
        })
      )
    ).toBe(false);
  });

  it("is complete when one required slot has a fully valid speaker", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          seminarSlotAssignments: [assignment("evt-001", "sem-a")],
          portalSeminarSpeakers: [speakerItem()],
        })
      )
    ).toBe(true);
  });

  it("is incomplete when multiple allotted slots and one lacks complete speakers", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          seminarSlotAssignments: [
            assignment("evt-001", "sem-a"),
            assignment("evt-001", "sem-b"),
          ],
          portalSeminarSpeakers: [speakerItem({}, { eventId: "evt-001", seminarId: "sem-a" })],
        })
      )
    ).toBe(false);
  });

  it("is complete when every allotted slot has complete speaker details", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          seminarSlotAssignments: [
            assignment("evt-001", "sem-a"),
            assignment("evt-001", "sem-b"),
          ],
          portalSeminarSpeakers: [
            speakerItem({}, { eventId: "evt-001", seminarId: "sem-a" }),
            speakerItem({}, { eventId: "evt-001", seminarId: "sem-b" }),
          ],
        })
      )
    ).toBe(true);
  });
});

describe("getPartnerPortalUploadStatus speaker_details segment", () => {
  it("maps speaker_details completion to arePortalSpeakerDetailsComplete", () => {
    const incomplete = getPartnerPortalUploadStatus(
      partner({
        seminarSlotAssignments: [assignment("evt-001", "sem-a")],
        portalSeminarSpeakers: [],
      })
    );
    const speakerItemChecklist = incomplete.checklist.find(
      (row) => row.key === "speaker_details"
    );
    expect(speakerItemChecklist?.complete).toBe(false);
    expect(speakerItemChecklist?.label).toBe(
      "Speaker details for each panel discussion"
    );

    const complete = getPartnerPortalUploadStatus(
      partner({
        seminarSlotAssignments: [assignment("evt-001", "sem-a")],
        portalSeminarSpeakers: [speakerItem()],
      })
    );
    expect(
      complete.checklist.find((row) => row.key === "speaker_details")?.complete
    ).toBe(true);
  });

  it("does not change unrelated checklist ordering or keys", () => {
    const status = getPartnerPortalUploadStatus(partner());
    expect(status.checklist.map((row) => row.key)).toEqual([
      "logo",
      "fascia_name",
      "website_link",
      "souvenir_writeup",
      "ad_creative",
      "sms_content",
      "speaker_details",
      "representatives",
    ]);
    expect(status.checklist.findIndex((row) => row.key === "speaker_details")).toBe(
      6
    );
    expect(
      status.checklist.find((row) => row.key === "fascia_name")?.complete
    ).toBe(false);
  });

  it("does not mark speaker details complete from communication history alone", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          seminarSlotAssignments: [assignment("evt-001", "sem-a")],
          portalSeminarSpeakers: [],
        })
      )
    ).toBe(false);
  });
});

describe("PORTAL_SUBMISSION_ITEMS copy", () => {
  it("uses panel discussion terminology for speaker details", () => {
    expect(
      PORTAL_SUBMISSION_ITEMS.find((item) => item.key === "speaker_details")?.label
    ).toBe("Speaker details for each panel discussion");
  });
});
