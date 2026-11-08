import { describe, expect, it } from "vitest";

import {
  patchSeminarSpeakerPhoto,
  removePortalDocumentByKind,
  upsertEventRepresentatives,
  upsertPortalDocumentByKind,
  upsertSeminarSpeakers,
} from "@/lib/partner-portal-submission-merge";
import type { PartnerPortalDocument } from "@/types";

const logo: PartnerPortalDocument = {
  id: "logo",
  kind: "logo",
  label: "Logo",
  fileName: "logo.png",
  mimeType: "image/png",
  url: "data:image/png;base64,abc",
  fileSizeBytes: 12,
  uploadedAt: "2026-01-01T00:00:00.000Z",
};

const writeup: PartnerPortalDocument = {
  ...logo,
  id: "writeup",
  kind: "souvenir_writeup",
  fileName: "writeup.pdf",
  url: "data:application/pdf;base64,abc",
};

describe("portal submission merge", () => {
  it("keeps the other document when one kind is replaced", () => {
    const first = upsertPortalDocumentByKind([logo], writeup).documents;
    const second = upsertPortalDocumentByKind(first, {
      ...logo,
      fileName: "new-logo.png",
    }).documents;
    expect(second.map((doc) => doc.kind).sort()).toEqual(["logo", "souvenir_writeup"]);
    expect(second.find((doc) => doc.kind === "souvenir_writeup")?.fileName).toBe(
      "writeup.pdf"
    );
    expect(second.find((doc) => doc.kind === "logo")?.fileName).toBe("new-logo.png");
  });

  it("keeps a legacy data URL when another document is removed", () => {
    const next = removePortalDocumentByKind([logo, writeup], "logo");
    expect(next.documents).toEqual([writeup]);
    expect(next.removed?.url.startsWith("data:")).toBe(true);
  });

  it("patches one speaker photo without dropping sibling speakers", () => {
    const rows = patchSeminarSpeakerPhoto(
      [
        {
          eventId: "evt-001",
          seminarId: "sem-a",
          updatedAt: "t1",
          speakers: [
            { id: "s1", name: "A", designation: "Dean", contact: "9999999999", introduction: "Bio", photoUrl: "data:image/png;base64,a" },
            { id: "s2", name: "B", designation: "Dean", contact: "9999999998", introduction: "Bio", photoUrl: "data:image/png;base64,b" },
          ],
        },
      ],
      {
        eventId: "evt-001",
        seminarId: "sem-a",
        speaker: {
          id: "s1",
          name: "A",
          designation: "Dean",
          contact: "9999999999",
          introduction: "Bio",
          photoUrl: "",
          photoStorageProvider: "supabase",
          photoStorageBucket: "partner-portal-assets",
          photoStoragePath: "partners/p/speaker_photo/s1/x.png",
        },
      }
    );
    expect(rows[0]?.speakers[1]?.name).toBe("B");
    expect(rows[0]?.speakers[0]?.photoStoragePath).toContain("speaker_photo/s1");
    expect(rows[0]?.speakers[1]?.photoUrl).toContain("data:");
  });

  it("updates one seminar without dropping another", () => {
    const rows = upsertSeminarSpeakers(
      [
        {
          eventId: "evt-001",
          seminarId: "sem-a",
          speakers: [{ name: "A", designation: "Dean", contact: "9999999999", introduction: "Bio", photoUrl: "data:image/png;base64,a" }],
          updatedAt: "t1",
        },
      ],
      {
        eventId: "evt-001",
        seminarId: "sem-b",
        speakers: [{ name: "B", designation: "Dean", contact: "9999999998", introduction: "Bio", photoUrl: "data:image/png;base64,b" }],
        updatedAt: "t2",
      }
    );
    expect(rows.map((row) => row.seminarId).sort()).toEqual(["sem-a", "sem-b"]);
  });

  it("updates one event's representatives without dropping another event", () => {
    const rows = upsertEventRepresentatives(
      [
        {
          eventId: "evt-001",
          count: 1,
          representatives: [{ name: "Ada", designation: "Lead", phone: "9999999999" }],
          updatedAt: "t1",
        },
      ],
      {
        eventId: "evt-002",
        count: 1,
        representatives: [{ name: "Grace", designation: "Lead", phone: "9999999998" }],
        updatedAt: "t2",
      }
    );
    expect(rows.map((row) => row.eventId).sort()).toEqual(["evt-001", "evt-002"]);
  });
});
