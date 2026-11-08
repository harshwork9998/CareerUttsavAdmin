import type { PartnerPortalDocument } from "@/types";

export type PortalStorageProvider = "supabase";

export const PORTAL_STORAGE_PROVIDER_SUPABASE: PortalStorageProvider = "supabase";

export function isStorageBackedPortalDocument(
  doc: Pick<
    PartnerPortalDocument,
    "storagePath" | "storageProvider" | "storageBucket"
  >
): boolean {
  return (
    doc.storageProvider === PORTAL_STORAGE_PROVIDER_SUPABASE &&
    Boolean(doc.storageBucket?.trim()) &&
    Boolean(doc.storagePath?.trim())
  );
}

/** Whether a portal document row represents a real submission (legacy URL or storage). */
export function isSubmittedPortalDocument(
  doc: Partial<
    Pick<PartnerPortalDocument, "url" | "storagePath" | "storageProvider" | "storageBucket" | "fileName">
  >
): boolean {
  if (isStorageBackedPortalDocument(doc)) return true;
  const url = doc.url?.trim() ?? "";
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return true;
  }
  return false;
}

export function findSubmittedPortalDocument(
  docs: PartnerPortalDocument[] | null | undefined,
  kind: PartnerPortalDocument["kind"]
): PartnerPortalDocument | undefined {
  return (docs ?? []).find((doc) => {
    if (doc.kind !== kind && !(kind === "souvenir_writeup" && doc.kind === "writeup")) {
      return false;
    }
    return isSubmittedPortalDocument(doc);
  });
}
