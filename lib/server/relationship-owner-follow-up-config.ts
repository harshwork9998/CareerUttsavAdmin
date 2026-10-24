export function readRelationshipOwnerFollowUpTemplateName(): string | null {
  const value = process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME?.trim();
  return value ? value : null;
}

export function readRelationshipOwnerFollowUpTemplateLanguage(): string {
  return (
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_LANGUAGE?.trim() || "en"
  );
}
