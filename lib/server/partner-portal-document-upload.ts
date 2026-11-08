import { randomUUID } from "node:crypto";

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
  assertPortalDocumentPathOwnedByPartner,
  assertPortalPathUsesBucket,
  buildPortalDocumentObjectPath,
  type PortalStorageDocumentKind,
} from "@/lib/server/partner-portal-storage-paths";
import {
  createSignedUploadIntent,
  removePortalStorageObject,
  verifyPortalStorageObject,
} from "@/lib/server/partner-portal-storage";
import { writePartnerPortalSubmission } from "@/lib/server/partner-portal-submission-write";
import type { Partner, PartnerDeliverable, PartnerPortalDocument } from "@/types";

const DOCUMENT_LABEL: Record<PortalStorageDocumentKind, string> = {
  logo: "University logo",
  souvenir_writeup: "Full page write up in event souvenir",
};

function deliverableIncluded(deliverables: PartnerDeliverable[], key: string): boolean {
  return deliverables.some(
    (item) => item.included && !item.isCustom && item.key === key
  );
}

export function isPartnerEntitledToPortalDocument(
  partner: Partner,
  kind: PortalStorageDocumentKind
): boolean {
  if (kind === "logo") return true;
  const lists = (partner.eventPartnerships ?? []).map((row) => row.deliverables ?? []);
  if (lists.length === 0 && partner.deliverables?.length) {
    return deliverableIncluded(partner.deliverables, "fullPageWriteup");
  }
  return lists.some((deliverables) => deliverableIncluded(deliverables, "fullPageWriteup"));
}

export function isPortalStorageDocumentKind(
  value: string
): value is PortalStorageDocumentKind {
  return value === "logo" || value === "souvenir_writeup";
}

export async function createPartnerPortalDocumentUploadIntent(input: {
  partner: Partner;
  kind: PortalStorageDocumentKind;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<
  | { ok: true; intent: { bucket: string; path: string; token: string; tusEndpoint: string } }
  | { ok: false; error: string; status: number }
> {
  if (!isPartnerEntitledToPortalDocument(input.partner, input.kind)) {
    return {
      ok: false,
      error:
        input.kind === "souvenir_writeup"
          ? "Full-page write-up is not required for your package."
          : "You cannot upload this file.",
      status: 403,
    };
  }
  const validationError = validateUploadFile({
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    mimeType: input.mimeType,
  });
  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }
  const path = buildPortalDocumentObjectPath(
    input.partner.id,
    input.kind,
    fileExtension(input.fileName)
  );
  const signed = await createSignedUploadIntent(path);
  if (!signed.ok) {
    return { ok: false, error: signed.error, status: signed.status };
  }
  return { ok: true, intent: signed.intent };
}

export async function commitPartnerPortalDocumentUpload(input: {
  partner: Partner;
  kind: PortalStorageDocumentKind;
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
  if (!isPartnerEntitledToPortalDocument(input.partner, input.kind)) {
    return {
      ok: false,
      error:
        input.kind === "souvenir_writeup"
          ? "Full-page write-up is not required for your package."
          : "You cannot upload this file.",
      status: 403,
    };
  }
  if (
    !assertPortalDocumentPathOwnedByPartner(
      input.storagePath,
      input.partner.id,
      input.kind
    ) ||
    !assertPortalPathUsesBucket(input.storageBucket)
  ) {
    return { ok: false, error: "Invalid upload path.", status: 403 };
  }
  const validationError = validateUploadFile({
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
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

  const prior = findSubmittedPortalDocument(input.partner.portalDocuments, input.kind);
  const nextDoc: PartnerPortalDocument = {
    id: prior?.id ?? randomUUID(),
    kind: input.kind,
    label: input.label.trim() || DOCUMENT_LABEL[input.kind],
    fileName: input.fileName,
    mimeType: input.mimeType.trim() || verified.info.mimeType,
    url: "",
    fileSizeBytes: verified.info.size,
    uploadedAt: new Date().toISOString(),
    storageProvider: PORTAL_STORAGE_PROVIDER_SUPABASE,
    storageBucket: input.storageBucket,
    storagePath: input.storagePath,
  };

  const saved = await writePartnerPortalSubmission(input.partner.id, {
    op: "upsert_document",
    document: nextDoc,
  });
  if (!saved.ok) {
    await removePortalStorageObject(input.storageBucket, input.storagePath);
    return { ok: false, error: saved.error, status: saved.status };
  }

  const replaced = saved.replacedDocument;
  if (
    replaced &&
    isStorageBackedPortalDocument(replaced) &&
    replaced.storagePath !== nextDoc.storagePath
  ) {
    await removePortalStorageObject(replaced.storageBucket!, replaced.storagePath!);
  }

  return { ok: true, partner: saved.partner };
}
