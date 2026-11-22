export function isWhatsAppCampaignDryRun(): boolean {
  return process.env.WHATSAPP_CAMPAIGN_DRY_RUN?.trim() === "true";
}

export function dryRunMessageId(recipientId: string): string {
  return `dry_run_${recipientId}`;
}

export function isDryRunMetaMessageId(messageId: string): boolean {
  return messageId.startsWith("dry_run_");
}