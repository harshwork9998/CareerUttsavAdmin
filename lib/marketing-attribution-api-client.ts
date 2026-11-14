import type {
  LeadSourceRecord,
  LeadSubSourceRecord,
  MarketingAttributionTree,
  MarketingCampaignRecord,
} from "@/lib/marketing-attribution/types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchMarketingAttributionTree(): Promise<MarketingAttributionTree> {
  const res = await fetch("/api/marketing-attribution", { cache: "no-store" });
  return parseJson<MarketingAttributionTree>(res);
}

export async function createLeadSourceApi(input: {
  name: string;
  description?: string;
}): Promise<LeadSourceRecord> {
  const res = await fetch("/api/marketing-attribution/sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<LeadSourceRecord>(res);
}

export async function updateLeadSourceApi(
  id: string,
  input: Partial<Pick<LeadSourceRecord, "name" | "description" | "isActive">>
): Promise<LeadSourceRecord> {
  const res = await fetch(`/api/marketing-attribution/sources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<LeadSourceRecord>(res);
}

export async function createLeadSubSourceApi(input: {
  leadSourceId: string;
  name: string;
}): Promise<LeadSubSourceRecord> {
  const res = await fetch("/api/marketing-attribution/sub-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<LeadSubSourceRecord>(res);
}

export async function updateLeadSubSourceApi(
  id: string,
  input: Partial<Pick<LeadSubSourceRecord, "name" | "isActive">>
): Promise<LeadSubSourceRecord> {
  const res = await fetch(`/api/marketing-attribution/sub-sources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<LeadSubSourceRecord>(res);
}

export async function createMarketingCampaignApi(input: {
  leadSubSourceId: string;
  name: string;
  trackingCode?: string;
  suggestCode?: boolean;
  placementDescription?: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<MarketingCampaignRecord> {
  const res = await fetch("/api/marketing-attribution/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<MarketingCampaignRecord>(res);
}

export async function updateMarketingCampaignApi(
  id: string,
  input: Partial<
    Pick<
      MarketingCampaignRecord,
      "name" | "placementDescription" | "startDate" | "endDate" | "isActive"
    >
  >
): Promise<MarketingCampaignRecord> {
  const res = await fetch(`/api/marketing-attribution/campaigns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<MarketingCampaignRecord>(res);
}

export async function suggestCampaignCodeApi(name: string): Promise<string> {
  const params = new URLSearchParams({ suggestCode: "1", name });
  const res = await fetch(`/api/marketing-attribution/campaigns?${params}`);
  const data = await parseJson<{ code: string }>(res);
  return data.code;
}

export function campaignQrImageUrl(campaignId: string): string {
  return `/api/marketing-attribution/campaigns/${campaignId}/qr`;
}