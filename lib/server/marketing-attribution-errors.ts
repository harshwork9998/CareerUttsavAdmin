import { isPrismaUniqueConstraintError } from "@/lib/server/marketing-attribution-prisma-store";

export type MarketingAttributionWriteEntity =
  | "lead_source"
  | "lead_sub_source"
  | "marketing_campaign";

const CONFLICT_MESSAGES: Record<MarketingAttributionWriteEntity, string> = {
  lead_source:
    "A lead source with this name already exists (names are compared case-insensitively).",
  lead_sub_source:
    "This lead source already has a sub-source with that name (case-insensitive).",
  marketing_campaign:
    "This tracking code is already in use (including retired campaigns). Choose a different code.",
};

export function marketingAttributionWriteConflictResult(
  error: unknown,
  entity: MarketingAttributionWriteEntity
): { ok: false; status: 409; error: string } | null {
  if (!isPrismaUniqueConstraintError(error)) {
    return null;
  }
  return { ok: false, status: 409, error: CONFLICT_MESSAGES[entity] };
}