import {
  findSubmittedPortalDocument,
  isStorageBackedPortalDocument,
} from "@/lib/partner-portal-document";
import { createPortalDocumentReadUrl } from "@/lib/server/partner-portal-storage";
import type { Partner, PartnerPortalDocumentKind } from "@/types";

export async function resolvePortalDocumentAccessUrl(
  partner: Partner,
  kind: PartnerPortalDocumentKind
): Promise<{ url: string } | { error: string; status: number }> {
  const doc = findSubmittedPortalDocument(partner.portalDocuments, kind);
  if (!doc) {
    return { error: "Document not found.", status: 404 };
  }
  if (isStorageBackedPortalDocument(doc)) {
    const signed = await createPortalDocumentReadUrl(
      doc.storageBucket!,
      doc.storagePath!
    );
    if (!signed) {
      return { error: "Could not open this file.", status: 502 };
    }
    return { url: signed };
  }
  const legacy = doc.url?.trim() ?? "";
  if (!legacy) {
    return { error: "Document not found.", status: 404 };
  }
  return { url: legacy };
}
