import type { CreateRegistrationInput } from "@/lib/registration-validation";
import type { Registration } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchAllRegistrations(): Promise<Registration[]> {
  const res = await fetch("/api/registrations", { cache: "no-store" });
  return parseJson<Registration[]>(res);
}

export async function fetchRegistrationById(
  id: string
): Promise<Registration | null> {
  const res = await fetch(`/api/registrations/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  return parseJson<Registration>(res);
}

export async function createRegistrationApi(
  data: CreateRegistrationInput
): Promise<Registration> {
  const res = await fetch("/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<Registration>(res);
}

export async function updateRegistrationApi(
  id: string,
  data: Partial<Registration>
): Promise<Registration | null> {
  const res = await fetch(`/api/registrations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 404) return null;
  return parseJson<Registration>(res);
}
