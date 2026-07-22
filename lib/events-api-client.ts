import type { Event } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchAllEvents(): Promise<Event[]> {
  const res = await fetch("/api/events", { cache: "no-store" });
  return parseJson<Event[]>(res);
}

export async function fetchEventById(id: string): Promise<Event | null> {
  const res = await fetch(`/api/events/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  return parseJson<Event>(res);
}

export async function createEventApi(
  data: Omit<Event, "id" | "createdAt" | "updatedAt">
): Promise<Event> {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Event>(res);
}

export async function updateEventApi(
  id: string,
  data: Partial<Event>
): Promise<Event | null> {
  const res = await fetch(`/api/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 404) return null;
  return parseJson<Event>(res);
}

export async function deleteEventApi(id: string): Promise<Event[]> {
  const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
  return parseJson<Event[]>(res);
}
