import { resolveRelationshipOwnerDigestTemplate } from "@/lib/server/relationship-owner-follow-up-template";

const LEGACY_SINGLE_TEMPLATE = "relationship_owner_followup_digest";

export function readRelationshipOwnerFollowUpTemplateLanguage(): string {
  return (
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_LANGUAGE?.trim() || "en"
  );
}

/** @deprecated Prefer RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_BASE + resolver. */
export function readRelationshipOwnerFollowUpTemplateName(): string | null {
  const value = process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME?.trim();
  return value ? value : null;
}

export function readRelationshipOwnerFollowUpTemplateBase(): string | null {
  const fromBase = process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_BASE?.trim();
  if (fromBase) return fromBase;
  const legacy = readRelationshipOwnerFollowUpTemplateName();
  if (legacy === LEGACY_SINGLE_TEMPLATE) {
    return LEGACY_SINGLE_TEMPLATE;
  }
  return null;
}

export function resolveRelationshipOwnerFollowUpTemplateName(
  totalDue: number
): string | null {
  const base = readRelationshipOwnerFollowUpTemplateBase();
  if (base) {
    return resolveRelationshipOwnerDigestTemplate(base, totalDue);
  }
  const legacy = readRelationshipOwnerFollowUpTemplateName();
  if (legacy && totalDue <= 1) {
    return legacy;
  }
  return null;
}

export function isRelationshipOwnerFollowUpTemplateConfigured(): boolean {
  return Boolean(readRelationshipOwnerFollowUpTemplateBase() || readRelationshipOwnerFollowUpTemplateName());
}
