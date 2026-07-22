import type { SeminarSessionRoster } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchAllSeminarRosters(): Promise<SeminarSessionRoster[]> {
  const res = await fetch("/api/seminar-rosters", { cache: "no-store" });
  return parseJson<SeminarSessionRoster[]>(res);
}

export async function upsertSeminarRosterApi(
  roster: SeminarSessionRoster
): Promise<SeminarSessionRoster> {
  const res = await fetch("/api/seminar-rosters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(roster),
  });
  return parseJson<SeminarSessionRoster>(res);
}
