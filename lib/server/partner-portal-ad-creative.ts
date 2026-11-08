import { randomUUID } from "node:crypto";

import { isAdCreativeApplicable } from "@/lib/portal-entitlements";
import {
  findSubmittedPortalDocument,
  isStorageBackedPortalDocument,
  PORTAL_STORAGE_PROVIDER_SUPABASE,
} from "@/lib/partner-portal-document";
import {
  fileExtension,
  validateUploadFile,
} from "@/lib/partner-upload-policy";
import {
  createSignedUploadIntent,
  readPortalStorageBucket,
  removePortalStorageObject,
  verifyPortalStorageObject,
} from "@/lib/server/partner-portal-storage";
import { writePartnerPortalSubmission } from "@/lib/server/partner-portal-submission-write";
import type { Partner, PartnerPortalDocument } from "@/types";

export const AD_CREATIVE_PATH_SEGMENT = "ad_creative";

export function isPartnerEntitledToAdCreative(partner: Partner): boolean {
  const lists = (partner.eventPartnerships ?? []).map((row) => row.deliverables ?? []);
  if (lists.length === 0 && partner.deliverables?.length) {
    return isAdCreativeApplicable(partner.deliverables);
  }
  return lists.some((deliverables) => isAdCreativeApplicable(deliverables));
}

export function buildAdCreativeObjectPath(partnerId: string, extension: string): string {
  const safePartner = partnerId.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `partners/${safePartner}/${AD_CREATIVE_PATH_SEGMENT}/${randomUUID()}.${safeExt}`;
}

export function assertAdCreativePathOwnedByPartner(
  storagePath: string,
  partnerId: string
): boolean {
  const normalized = storagePath.trim().replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) return false;
  const expectedPrefix = `partners/${partnerId.trim()}/${AD_CREATIVE_PATH_SEGMENT}/`;
  return normalized.startsWith(expectedPrefix);
}

export function assertAdCreativePathUsesBucket(bucket: string): boolean {
  return bucket.trim() === readPortalStorageBucket();
}

export async function createPartnerAdCreativeUploadIntent(input: {
  partner: Partner;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<
  | { ok: true; intent: { bucket: string; path: string; token: string; tusEndpoint: string } }
  | { ok: false; error: string; status: number }
> {
  if (!isPartnerEntitledToAdCreative(input.partner)) {
    return { ok: false, error: "Advertisement creative is not required for your package.", status: 403 };
  }
  const extension = fileExtension(input.fileName);
  const validationError = validateUploadFile({
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    kind: "ad_creative",
    mimeType: input.mimeType,
  });
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }
  const path = buildAdCreativeObjectPath(input.partner.id, extension);
  const signed = await createSignedUploadIntent(path);
  if (!signed.ok) {
    return { ok: false, error: signed.error, status: signed.status };
  }
  return { ok: true, intent: signed.intent };
}

export async function commitPartnerAdCreativeUpload(input: {
  partner: Partner;
  label: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storageBucket: string;
  storagePath: string;
  ifMatchToken?: string;
}): Promise<
  | { ok: true; partner: Partner }
  | { ok: false; error: string; status: number; partner?: Partner }
> {
  if (!isPartnerEntitledToAdCreative(input.partner)) {
    return { ok: false, error: "Advertisement creative is not required for your package.", status: 403 };
  }
  if (
    !assertAdCreativePathOwnedByPartner(input.storagePath, input.partner.id) ||
    !assertAdCreativePathUsesBucket(input.storageBucket)
  ) {
    return { ok: false, error: "Invalid upload path.", status: 403 };
  }
  const validationError = validateUploadFile({
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    kind: "ad_creative",
    mimeType: input.mimeType,
  });
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const verified = await verifyPortalStorageObject(
    input.storageBucket,
    input.storagePath
  );
  if (!verified.ok) {
    const status =
      verified.reason === "missing" ? 400 : verified.reason === "unconfigured" ? 503 : 502;
    return {
      ok: false,
      error: "Uploaded file could not be verified. Please try again.",
      status,
    };
  }
  const objectInfo = verified.info;

  const prior = findSubmittedPortalDocument(input.partner.portalDocuments, "ad_creative");

  const nextDoc: PartnerPortalDocument = {
    id: prior?.id ?? randomUUID(),
    kind: "ad_creative",
    label: input.label.trim() || "Advertisement creative",
    fileName: input.fileName,
    mimeType: input.mimeType.trim() || objectInfo.mimeType,
    url: "",
    fileSizeBytes: objectInfo.size,
    uploadedAt: new Date().toISOString(),
    storageProvider: PORTAL_STORAGE_PROVIDER_SUPABASE,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
  };

  const saved = await writePartnerPortalSubmission(input.partner.id, {
    op: "upsert_document",
    document: nextDoc,
    ifMatchToken: input.ifMatchToken,
  });
  if (!saved.ok) {
    await removePortalStorageObject(input.storageBucket, input.storagePath).catch(
      () => undefined
    );
    return {
      ok: false,
      error: saved.error,
      status: saved.status,
      partner: saved.partner,
    };
  }

  const replaced = saved.replacedDocument;
  if (
    replaced &&
    isStorageBackedPortalDocument(replaced) &&
    replaced.storagePath !== nextDoc.storagePath
  ) {
    await removePortalStorageObject(replaced.storageBucket!, replaced.storagePath!).catch(
      () => undefined
    );
  }

  return { ok: true, partner: saved.partner };
}

export async function removePartnerAdCreativeStorageIfPresent(partner: Partner): Promise<void> {
  const doc = findSubmittedPortalDocument(partner.portalDocuments, "ad_creative");
  if (!doc || !isStorageBackedPortalDocument(doc)) return;
  await removePortalStorageObject(doc.storageBucket!, doc.storagePath!);
}
