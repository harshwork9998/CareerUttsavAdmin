import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

import {
  findSubmittedPortalDocument,
  isStorageBackedPortalDocument,
  isSubmittedPortalDocument,
} from "@/lib/partner-portal-document";
import {
  isPartnerEntitledToAdCreative,
} from "@/lib/server/partner-portal-ad-creative";
import { isAdCreativeApplicable } from "@/lib/portal-entitlements";
import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";
import type { Partner, PartnerDeliverable, PartnerPortalDocument } from "@/types";

export const AD_CREATIVE_KIND = "ad_creative" as const;

export function loadProductionAdminEnv(): void {
  loadEnv({ path: path.join(process.cwd(), ".env.local") });
}

export function assertProductionPartnerPersistence(): void {
  if (!isPrismaPartnerPersistence()) {
    throw new Error(
      "PARTNER_PERSISTENCE must be prisma for production preflight/upload. Set it in .env.local on the Admin server."
    );
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }
}

export function redactStoragePath(storagePath: string | undefined): string | null {
  const value = storagePath?.trim();
  if (!value) return null;
  const parts = value.replace(/\\/g, "/").split("/");
  if (parts.length <= 2) return "[redacted]";
  return `…/${parts.slice(-2).join("/")}`;
}

export function summarizePortalDocument(doc: PartnerPortalDocument): Record<string, unknown> {
  return {
    kind: doc.kind,
    fileName: doc.fileName,
    fileSizeBytes: doc.fileSizeBytes,
    uploadedAt: doc.uploadedAt,
    storageBacked: isStorageBackedPortalDocument(doc),
    storagePathTail: redactStoragePath(doc.storagePath),
  };
}

export function includedDeliverableKeys(
  deliverables: PartnerDeliverable[] | undefined
): string[] {
  return (deliverables ?? [])
    .filter((row) => row.included)
    .map((row) => row.key);
}

export type AdDeliverableRow = {
  key: string;
  included: boolean;
  option: string | null;
};

export function adEntitlementDeliverableSummary(
  deliverables: PartnerDeliverable[] | undefined
): AdDeliverableRow[] {
  const keys = new Set([
    "eventSouvenirAd",
    "bookAdPremiumSpot",
    "bookAdCareersAfterPlus2",
  ]);
  return (deliverables ?? [])
    .filter((row) => keys.has(row.key))
    .map((row) => ({
      key: row.key,
      included: row.included,
      option: row.option ?? null,
    }));
}

export type AdCreativePreflightAssessment = {
  okToUpload: boolean;
  stopReasons: string[];
  partnerId: string;
  name: string;
  city: string;
  state: string;
  sponsorshipTier: string | null;
  entitled: boolean;
  adCreativeApplicableOnLegacyDeliverables: boolean;
  adCreativeSubmitted: boolean;
  existingAdCreative: ReturnType<typeof summarizePortalDocument> | null;
  portalDocumentSummaries: ReturnType<typeof summarizePortalDocument>[];
  deliverablesIncludedKeys: string[];
  adDeliverableSummary: AdDeliverableRow[];
  eventPartnershipTiers: Array<{
    eventId: string;
    sponsorshipTier: string | null;
    adApplicable: boolean;
    adDeliverableSummary: AdDeliverableRow[];
  }>;
};

export function assessPartnerAdCreativePreflight(partner: Partner): AdCreativePreflightAssessment {
  const existing = findSubmittedPortalDocument(partner.portalDocuments, AD_CREATIVE_KIND);
  const entitled = isPartnerEntitledToAdCreative(partner);
  const stopReasons: string[] = [];

  if (!entitled) {
    stopReasons.push("ad_creative is not applicable for this partner (no ad entitlement).");
  }
  if (existing && isSubmittedPortalDocument(existing)) {
    stopReasons.push(
      "An advertisement creative is already submitted; upload would overwrite (blocked)."
    );
  }

  const eventPartnershipTiers = (partner.eventPartnerships ?? []).map((row) => ({
    eventId: row.eventId,
    sponsorshipTier: row.sponsorshipTier ?? null,
    adApplicable: isAdCreativeApplicable(row.deliverables ?? []),
    adDeliverableSummary: adEntitlementDeliverableSummary(row.deliverables),
  }));

  return {
    okToUpload: stopReasons.length === 0,
    stopReasons,
    partnerId: partner.id,
    name: partner.name,
    city: partner.city,
    state: partner.state,
    sponsorshipTier: partner.sponsorshipTier ?? null,
    entitled,
    adCreativeApplicableOnLegacyDeliverables: isAdCreativeApplicable(
      partner.deliverables ?? []
    ),
    adCreativeSubmitted: Boolean(existing && isSubmittedPortalDocument(existing)),
    existingAdCreative: existing ? summarizePortalDocument(existing) : null,
    portalDocumentSummaries: (partner.portalDocuments ?? [])
      .filter((doc) => isSubmittedPortalDocument(doc))
      .map(summarizePortalDocument),
    deliverablesIncludedKeys: includedDeliverableKeys(partner.deliverables),
    adDeliverableSummary: adEntitlementDeliverableSummary(partner.deliverables),
    eventPartnershipTiers,
  };
}

export function writeExecutionLog(entry: Record<string, unknown>): string {
  const logsDir = path.join(process.cwd(), "scripts", "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(logsDir, `ad-creative-admin-${stamp}.json`);
  fs.writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
  return file;
}

export function parseCliFlags(argv: string[]): Map<string, string | boolean> {
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, true);
    } else {
      flags.set(key, next);
      i += 1;
    }
  }
  return flags;
}

export function flagString(
  flags: Map<string, string | boolean>,
  key: string
): string | undefined {
  const value = flags.get(key);
  return typeof value === "string" ? value : undefined;
}

export function flagBool(flags: Map<string, string | boolean>, key: string): boolean {
  return flags.get(key) === true;
}
