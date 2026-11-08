import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertSpeakerPhotoPathOwnedByPartner,
  buildSpeakerPhotoObjectPath,
} from "@/lib/server/partner-portal-storage-paths";
import {
  commitPartnerSpeakerPhotoUpload,
  createPartnerSpeakerPhotoUploadIntent,
  resolveSpeakerPhotoAccessUrl,
  speakerPhotosNoLongerReferenced,
} from "@/lib/server/partner-portal-speaker-photo";
import * as storage from "@/lib/server/partner-portal-storage";
import * as submissionWrite from "@/lib/server/partner-portal-submission-write";
import type { Partner } from "@/types";

const speakerId = "11111111-1111-4111-8111-111111111111";

function basePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-001",
    name: "Test U",
    city: "Bengaluru",
    state: "Karnataka",
    stage: "Confirmed",
    eventIds: ["evt-001"],
    eventPartnerships: [
      { eventId: "evt-001", deliverables: [], seminarSlotCount: 1 },
    ],
    seminarSlotAssignments: [
      { eventId: "evt-001", seminarId: "sem-a", slots: 1 },
    ],
    portalSeminarSpeakers: [],
    portalDocuments: [],
    ...overrides,
  } as Partner;
}

describe("partner portal speaker photo storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = "https://example-ref.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_PORTAL_BUCKET = "partner-portal-assets";
  });

  it("rejects unassigned seminars", async () => {
    const result = await createPartnerSpeakerPhotoUploadIntent({
      partner: basePartner({ seminarSlotAssignments: [] }),
      eventId: "evt-001",
      seminarId: "sem-a",
      fileName: "photo.png",
      mimeType: "image/png",
      fileSizeBytes: 1200,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("builds partner-owned speaker photo paths", () => {
    const path = buildSpeakerPhotoObjectPath("partner-001", speakerId, ".png");
    expect(path).toMatch(
      new RegExp(`^partners/partner-001/speaker_photo/${speakerId}/.+\\.png$`)
    );
    expect(assertSpeakerPhotoPathOwnedByPartner(path, "partner-001", speakerId)).toBe(true);
    expect(assertSpeakerPhotoPathOwnedByPartner(path, "partner-002", speakerId)).toBe(false);
    expect(
      assertSpeakerPhotoPathOwnedByPartner(path, "partner-001", "22222222-2222-4222-8222-222222222222")
    ).toBe(false);
  });

  it("does not persist a draft speaker photo before Save", async () => {
    const path = buildSpeakerPhotoObjectPath("partner-001", speakerId, ".png");
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 2048, mimeType: "image/png" },
    });
    const writeSpy = vi.spyOn(submissionWrite, "writePartnerPortalSubmission");
    const result = await commitPartnerSpeakerPhotoUpload({
      partner: basePartner(),
      eventId: "evt-001",
      seminarId: "sem-a",
      speakerId,
      fileName: "photo.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.persisted).toBe(false);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("persists a replacement photo onto an existing saved speaker", async () => {
    const path = buildSpeakerPhotoObjectPath("partner-001", speakerId, ".png");
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: true,
      info: { size: 3000, mimeType: "image/jpeg" },
    });
    vi.spyOn(submissionWrite, "writePartnerPortalSubmission").mockResolvedValue({
      ok: true,
      partner: basePartner(),
    });
    const removeSpy = vi.spyOn(storage, "removePortalStorageObject").mockResolvedValue();
    const result = await commitPartnerSpeakerPhotoUpload({
      partner: basePartner({
        portalSeminarSpeakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            updatedAt: "t1",
            speakers: [
              {
                id: speakerId,
                name: "Asha",
                designation: "Dean",
                contact: "9876543210",
                introduction: "Bio",
                photoStorageProvider: "supabase",
                photoStorageBucket: "partner-portal-assets",
                photoStoragePath: "partners/partner-001/speaker_photo/" + speakerId + "/old.jpg",
              },
            ],
          },
        ],
      }),
      eventId: "evt-001",
      seminarId: "sem-a",
      speakerId,
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 3000,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.persisted).toBe(true);
    expect(removeSpy).toHaveBeenCalledWith(
      "partner-portal-assets",
      "partners/partner-001/speaker_photo/" + speakerId + "/old.jpg"
    );
  });

  it("returns a controlled error when the object is missing", async () => {
    const path = buildSpeakerPhotoObjectPath("partner-001", speakerId, ".png");
    vi.spyOn(storage, "verifyPortalStorageObject").mockResolvedValue({
      ok: false,
      reason: "missing",
    });
    const result = await commitPartnerSpeakerPhotoUpload({
      partner: basePartner(),
      eventId: "evt-001",
      seminarId: "sem-a",
      speakerId,
      fileName: "photo.png",
      mimeType: "image/png",
      fileSizeBytes: 2048,
      storageBucket: "partner-portal-assets",
      storagePath: path,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("serves legacy photo URLs and storage-backed signed reads", async () => {
    const legacy = await resolveSpeakerPhotoAccessUrl(
      basePartner({
        portalSeminarSpeakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            updatedAt: "t1",
            speakers: [
              { id: speakerId, name: "Asha", photoUrl: "data:image/png;base64,abc" },
            ],
          },
        ],
      }),
      "evt-001",
      "sem-a",
      speakerId
    );
    expect(legacy).toEqual({ url: "data:image/png;base64,abc" });

    vi.spyOn(storage, "createPortalDocumentReadUrl").mockResolvedValue(
      "https://signed.example/photo"
    );
    const stored = await resolveSpeakerPhotoAccessUrl(
      basePartner({
        portalSeminarSpeakers: [
          {
            eventId: "evt-001",
            seminarId: "sem-a",
            updatedAt: "t1",
            speakers: [
              {
                id: speakerId,
                name: "Asha",
                photoUrl: "",
                photoStorageProvider: "supabase",
                photoStorageBucket: "partner-portal-assets",
                photoStoragePath: "partners/partner-001/speaker_photo/" + speakerId + "/x.png",
              },
            ],
          },
        ],
      }),
      "evt-001",
      "sem-a",
      speakerId
    );
    expect(stored).toEqual({ url: "https://signed.example/photo" });
  });

  it("lists speaker photos that are no longer referenced after a seminar save", () => {
    const removed = speakerPhotosNoLongerReferenced(
      [
        {
          eventId: "evt-001",
          seminarId: "sem-a",
          updatedAt: "t1",
          speakers: [
            {
              id: speakerId,
              name: "Asha",
              photoStorageProvider: "supabase",
              photoStorageBucket: "partner-portal-assets",
              photoStoragePath: "partners/partner-001/speaker_photo/" + speakerId + "/old.png",
            },
          ],
        },
      ],
      [
        {
          eventId: "evt-001",
          seminarId: "sem-a",
          updatedAt: "t2",
          speakers: [{ id: speakerId, name: "Asha", photoUrl: "https://example.com/a.png" }],
        },
      ]
    );
    expect(removed).toEqual([
      {
        storageBucket: "partner-portal-assets",
        storagePath: "partners/partner-001/speaker_photo/" + speakerId + "/old.png",
      },
    ]);
  });
});
