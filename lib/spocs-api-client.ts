import type { Spoc } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchAllSpocs(): Promise<Spoc[]> {
  const res = await fetch("/api/spocs", { cache: "no-store" });
  return parseJson<Spoc[]>(res);
}

export async function createSpocApi(
  data: Pick<Spoc, "name" | "organization" | "phone" | "email">
): Promise<Spoc> {
  const res = await fetch("/api/spocs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Spoc>(res);
}

export async function updateSpocApi(
  id: string,
  data: Partial<Pick<Spoc, "name" | "organization" | "phone" | "email">>
): Promise<Spoc> {
  const res = await fetch(`/api/spocs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Spoc>(res);
}

export async function deleteSpocApi(id: string): Promise<Spoc[]> {
  const res = await fetch(`/api/spocs/${id}`, { method: "DELETE" });
  return parseJson<Spoc[]>(res);
}
