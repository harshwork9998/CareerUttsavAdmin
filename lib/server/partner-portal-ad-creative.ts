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
import { updatePartnerForApi } from "@/lib/server/partner-service";
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
}): Promise<
  | { ok: true; partner: Partner }
  | { ok: false; error: string; status: number }
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

  const objectInfo = await verifyPortalStorageObject(
    input.storageBucket,
    input.storagePath
  );
  if (!objectInfo) {
    return { ok: false, error: "Uploaded file could not be verified. Please try again.", status: 400 };
  }

  const docs = [...(input.partner.portalDocuments ?? [])];
  const prior = findSubmittedPortalDocument(docs, "ad_creative");
  const priorStorage =
    prior && isStorageBackedPortalDocument(prior)
      ? { bucket: prior.storageBucket!, path: prior.storagePath! }
      : null;

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

  const withoutKind = docs.filter((doc) => doc.kind !== "ad_creative");
  const saved = await updatePartnerForApi(input.partner.id, {
    portalDocuments: [...withoutKind, nextDoc],
  });
  if (!saved.ok) {
    await removePortalStorageObject(input.storageBucket, input.storagePath);
    return { ok: false, error: saved.error, status: saved.status };
  }

  if (priorStorage) {
    await removePortalStorageObject(priorStorage.bucket, priorStorage.path);
  }

  return { ok: true, partner: saved.partner };
}

export async function removePartnerAdCreativeStorageIfPresent(partner: Partner): Promise<void> {
  const doc = findSubmittedPortalDocument(partner.portalDocuments, "ad_creative");
  if (!doc || !isStorageBackedPortalDocument(doc)) return;
  await removePortalStorageObject(doc.storageBucket!, doc.storagePath!);
}
