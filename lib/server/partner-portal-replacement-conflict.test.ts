import { describe, expect, it } from "vitest";

import { applyPortalSubmissionMutation } from "@/lib/server/partner-portal-submission-write";
import type { PartnerPortalDocument } from "@/types";

const logo = (path: string): PartnerPortalDocument => ({
  id: "logo-1",
  kind: "logo",
  label: "University logo",
  fileName: "logo.png",
  mimeType: "image/png",
  url: "",
  fileSizeBytes: 12,
  uploadedAt: "2026-11-08T12:00:00.000Z",
  storageProvider: "supabase",
  storageBucket: "partner-portal-assets",
  storagePath: path,
});

function columns(docs: PartnerPortalDocument[] = []) {
  return {
    portalDocuments: docs,
    portalFasciaName: "",
    portalWebsiteUrl: "",
    portalSmsContent: "",
    portalSeminarSpeakers: [] as never[],
    portalRepresentatives: [] as never[],
  };
}

describe("same-document replacement conflict", () => {
  it("rejects an older logo commit after a newer path is already stored", () => {
    const current = columns([logo("partners/p/logo/new.png")]);
    const result = applyPortalSubmissionMutation(current, {
      op: "upsert_document",
      ifMatchToken: "partners/p/logo/old.png",
      document: logo("partners/p/logo/stale.png"),
    });
    expect(result.conflict).toBe(true);
    expect(result.columns.portalDocuments[0]?.storagePath).toBe(
      "partners/p/logo/new.png"
    );
  });

  it("treats a first upload with an empty match token as uncontested", () => {
    const result = applyPortalSubmissionMutation(columns(), {
      op: "upsert_document",
      ifMatchToken: "",
      document: logo("partners/p/logo/first.png"),
    });
    expect(result.conflict).toBeUndefined();
    expect(result.columns.portalDocuments[0]?.storagePath).toBe(
      "partners/p/logo/first.png"
    );
  });

  it("commits when the expected path still matches", () => {
    const current = columns([logo("partners/p/logo/old.png")]);
    const next = logo("partners/p/logo/replacement.png");
    const result = applyPortalSubmissionMutation(current, {
      op: "upsert_document",
      ifMatchToken: "partners/p/logo/old.png",
      document: next,
    });
    expect(result.conflict).toBeUndefined();
    expect(result.columns.portalDocuments[0]?.storagePath).toBe(
      "partners/p/logo/replacement.png"
    );
  });

  it("rejects a speaker photo commit that no longer matches the live path", () => {
    const current = {
      ...columns(),
      portalSeminarSpeakers: [
        {
          eventId: "evt",
          seminarId: "sem",
          updatedAt: "t1",
          speakers: [
            {
              id: "s1",
              name: "Ada",
              photoStorageProvider: "supabase" as const,
              photoStorageBucket: "partner-portal-assets",
              photoStoragePath: "partners/p/speaker_photo/s1/new.jpg",
              photoUrl: "",
            },
          ],
        },
      ],
    };
    const result = applyPortalSubmissionMutation(current, {
      op: "patch_speaker_photo",
      eventId: "evt",
      seminarId: "sem",
      ifMatchToken: "partners/p/speaker_photo/s1/old.jpg",
      speaker: {
        id: "s1",
        name: "Ada",
        photoStorageProvider: "supabase",
        photoStorageBucket: "partner-portal-assets",
        photoStoragePath: "partners/p/speaker_photo/s1/stale.jpg",
        photoUrl: "",
      },
    });
    expect(result.conflict).toBe(true);
    expect(result.columns.portalSeminarSpeakers[0]?.speakers[0]?.photoStoragePath).toBe(
      "partners/p/speaker_photo/s1/new.jpg"
    );
  });
});
