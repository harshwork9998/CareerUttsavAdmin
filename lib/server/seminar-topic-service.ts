import { listEventsForApi } from "@/lib/server/event-service";
import { notifyConfirmedSeminarCommunications } from "@/lib/server/partner-communication-service";
import {
  getPartnerByIdForApi,
  listPartnersForApi,
  updatePartnerForApi,
  type PartnerWriteResult,
} from "@/lib/server/partner-service";
import {
  buildPartnerSeminarTopicCatalog,
  planPartnerSeminarTopicWrite,
  readSeminarTopicSelection,
  type PartnerSeminarTopicCatalog,
} from "@/lib/seminar-topic-selection";

export type SeminarTopicCatalogResult =
  | { ok: true; catalog: PartnerSeminarTopicCatalog }
  | { ok: false; status: number; error: string };

async function catalogFor(partnerId: string): Promise<SeminarTopicCatalogResult> {
  const partner = await getPartnerByIdForApi(partnerId);
  if (!partner) return { ok: false, status: 404, error: "Not found" };
  const [events, partners] = await Promise.all([
    listEventsForApi(),
    listPartnersForApi(),
  ]);
  return {
    ok: true,
    catalog: buildPartnerSeminarTopicCatalog({ partner, events, partners }),
  };
}

export async function getPartnerSeminarTopicCatalog(
  partnerId: string
): Promise<SeminarTopicCatalogResult> {
  return catalogFor(partnerId);
}

export async function savePartnerSeminarTopics(
  partnerId: string,
  body: unknown
): Promise<SeminarTopicCatalogResult> {
  const parsed = readSeminarTopicSelection(body);
  if (!parsed.ok) return parsed;

  const partner = await getPartnerByIdForApi(partnerId);
  if (!partner) return { ok: false, status: 404, error: "Not found" };
  const [events, partners] = await Promise.all([
    listEventsForApi(),
    listPartnersForApi(),
  ]);
  const planned = planPartnerSeminarTopicWrite({
    partner,
    events,
    partners,
    topics: parsed.topics,
    confirm: parsed.confirm,
  });
  if (!planned.ok) return planned;

  const saved: PartnerWriteResult = await updatePartnerForApi(partnerId, {
    seminarSlotAssignments: planned.assignments,
    seminarSlotsConfirmedAt: planned.seminarSlotsConfirmedAt,
  });
  if (!saved.ok) return saved;
  if (parsed.confirm) {
    try {
      await notifyConfirmedSeminarCommunications(saved.partner, { events });
    } catch (error) {
      console.info("[partner-communication]", {
        partnerId,
        outcome: "unknown",
        error: error instanceof Error ? error.message : "Seminar communication failed",
      });
    }
  }
  return catalogFor(partnerId);
}
