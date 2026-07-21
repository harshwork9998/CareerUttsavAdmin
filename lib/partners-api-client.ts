import type { Partner } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchAllPartners(): Promise<Partner[]> {
  const res = await fetch("/api/partners", { cache: "no-store" });
  return parseJson<Partner[]>(res);
}

export async function fetchPartnerById(id: string): Promise<Partner | null> {
  const res = await fetch(`/api/partners/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  return parseJson<Partner>(res);
}

export async function createPartnerApi(
  data: Omit<Partner, "id" | "createdAt" | "updatedAt">
): Promise<Partner> {
  const res = await fetch("/api/partners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Partner>(res);
}

export async function updatePartnerApi(
  id: string,
  data: Partial<Partner>
): Promise<Partner | null> {
  const res = await fetch(`/api/partners/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 404) return null;
  return parseJson<Partner>(res);
}

export async function deletePartnerApi(id: string): Promise<Partner[]> {
  const res = await fetch(`/api/partners/${id}`, { method: "DELETE" });
  return parseJson<Partner[]>(res);
}
