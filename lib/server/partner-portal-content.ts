import { validateLinkedInProfile } from "@/lib/partner-linkedin";
import { validateSmsContent } from "@/lib/partner-sms-content";
import { validateStoredUpload } from "@/lib/partner-upload-policy";
import type { Partner } from "@/types";

export function validatePartnerPortalContent(
  patch: Partial<Partner>
): string | null {
  if (typeof patch.portalSmsContent === "string") {
    const smsError = validateSmsContent(patch.portalSmsContent);
    if (smsError) return smsError;
  }

  if (Array.isArray(patch.portalDocuments)) {
    for (const document of patch.portalDocuments) {
      const uploadError = validateStoredUpload({
        fileName: document?.fileName ?? "",
        fileSizeBytes: Number(document?.fileSizeBytes) || 0,
        url: document?.url,
      });
      if (uploadError) return uploadError;
    }
  }

  if (Array.isArray(patch.portalSeminarSpeakers)) {
    for (const row of patch.portalSeminarSpeakers) {
      for (const speaker of row?.speakers ?? []) {
        const linkedIn = validateLinkedInProfile(speaker?.linkedinProfile);
        if (!linkedIn.ok) return linkedIn.error;
      }
    }
  }

  return null;
}
