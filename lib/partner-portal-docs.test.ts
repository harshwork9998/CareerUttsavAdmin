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
  const eventPartnerships = overrides.eventPartnerships ?? [
    {
      eventId: "evt-001",
      deliverables: [],
      seminarSlotCount: 0,
      representativeSlotCount: 0,
    },
  ];
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
    eventPartnerships,
    ...overrides,
  };
}

const seminarPartnership = (
  seminarSlotCount = 1
): NonNullable<Partner["eventPartnerships"]>[number] => ({
  eventId: "evt-001",
  deliverables: [],
  seminarSlotCount,
  representativeSlotCount: 0,
});

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
        partner({
          seminarSlotAssignments: [],
          portalSeminarSpeakers: [],
        })
      )
    ).toBe(false);
  });

  it("is incomplete when slots are allotted but no speaker rows exist", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          eventPartnerships: [
            {
              eventId: "evt-001",
              deliverables: [],
              seminarSlotCount: 1,
              representativeSlotCount: 0,
            },
          ],
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
          eventPartnerships: [seminarPartnership()],
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
          eventPartnerships: [seminarPartnership()],
          seminarSlotAssignments: [assignment("evt-001", "sem-a")],
          portalSeminarSpeakers: [speakerItem(patch)],
        })
      )
    ).toBe(false);
  });

  it("is complete when the photograph is Storage-backed without a data URL", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          eventPartnerships: [seminarPartnership()],
          seminarSlotAssignments: [assignment("evt-001", "sem-a")],
          portalSeminarSpeakers: [
            {
              eventId: "evt-001",
              seminarId: "sem-a",
              updatedAt: "2026-11-01T00:00:00.000Z",
              speakers: [
                {
                  ...completeSpeaker,
                  photoUrl: "",
                  photoStorageProvider: "supabase",
                  photoStorageBucket: "partner-portal-assets",
                  photoStoragePath: "partners/p1/speaker_photo/s1/x.png",
                },
              ],
            },
          ],
        })
      )
    ).toBe(true);
  });

  it("is complete when one required slot has a fully valid speaker", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          eventPartnerships: [seminarPartnership()],
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
          eventPartnerships: [seminarPartnership(2)],
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
          eventPartnerships: [seminarPartnership(2)],
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
        eventPartnerships: [
          {
            eventId: "evt-001",
            deliverables: [],
            seminarSlotCount: 1,
            representativeSlotCount: 0,
          },
        ],
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
        eventPartnerships: [
          {
            eventId: "evt-001",
            deliverables: [],
            seminarSlotCount: 1,
            representativeSlotCount: 0,
          },
        ],
        seminarSlotAssignments: [assignment("evt-001", "sem-a")],
        portalSeminarSpeakers: [speakerItem()],
      })
    );
    expect(
      complete.checklist.find((row) => row.key === "speaker_details")?.complete
    ).toBe(true);
  });

  it("omits non-applicable rows and keeps the always-required trio", () => {
    const status = getPartnerPortalUploadStatus(partner());
    expect(status.checklist.map((row) => row.key)).toEqual([
      "logo",
      "fascia_name",
      "website_link",
    ]);
    expect(
      status.checklist.find((row) => row.key === "fascia_name")?.complete
    ).toBe(false);
  });

  it("includes conditional rows when the package entitles them", () => {
    const status = getPartnerPortalUploadStatus(
      partner({
        eventPartnerships: [
          {
            eventId: "evt-001",
            deliverables: [
              {
                id: "writeup",
                key: "fullPageWriteup",
                label: "Write-up",
                included: true,
              },
              {
                id: "ad",
                key: "eventSouvenirAd",
                label: "Souvenir ad",
                included: true,
              },
            ],
            seminarSlotCount: 0,
            representativeSlotCount: 2,
          },
        ],
      })
    );
    expect(status.checklist.map((row) => row.key)).toEqual([
      "logo",
      "fascia_name",
      "website_link",
      "souvenir_writeup",
      "ad_creative",
      "representatives",
    ]);
  });

  it("does not mark speaker details complete from communication history alone", () => {
    expect(
      arePortalSpeakerDetailsComplete(
        partner({
          eventPartnerships: [seminarPartnership()],
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
