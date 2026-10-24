import type { FollowUpApiItem } from "@/lib/follow-up-api-types";

export type FollowUpsResponse = {
  items: FollowUpApiItem[];
};

export async function fetchFollowUps(): Promise<FollowUpApiItem[]> {
  const res = await fetch("/api/follow-ups", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  const body = (await res.json()) as FollowUpsResponse;
  return body.items ?? [];
}
