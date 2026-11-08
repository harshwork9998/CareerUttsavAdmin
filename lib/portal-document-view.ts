import {
  isStorageBackedPortalDocument,
} from "@/lib/partner-portal-document";
import type { PartnerPortalDocument } from "@/types";

export async function resolvePortalDocumentHref(
  partnerId: string,
  doc: PartnerPortalDocument
): Promise<string | null> {
  if (isStorageBackedPortalDocument(doc)) {
    const res = await fetch(
      `/api/partners/${encodeURIComponent(partnerId)}/portal-documents/${encodeURIComponent(doc.kind)}/access-url`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as { url?: string } | null;
    return typeof payload?.url === "string" ? payload.url : null;
  }
  const legacy = doc.url?.trim() ?? "";
  return legacy || null;
}
