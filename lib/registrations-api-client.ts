import type { RegistrationAttemptRecord } from "@/lib/registration-attempt";
import type { RegistrationCheckInView } from "@/lib/server/registration-check-in-types";
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

export async function fetchPartialRegistrations(): Promise<
  RegistrationAttemptRecord[]
> {
  const res = await fetch("/api/registration-attempts", { cache: "no-store" });
  return parseJson<RegistrationAttemptRecord[]>(res);
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

export async function deleteRegistrationApi(id: string): Promise<void> {
  const res = await fetch(`/api/registrations/${id}`, { method: "DELETE" });
  await parseJson<{ success: boolean }>(res);
}

export type RegistrationCheckInRequest = {
  eventId: string;
  qrPayload?: string;
  registrationNumber?: string;
  registrationId?: string;
};

export async function checkInRegistrationApi(
  body: RegistrationCheckInRequest
): Promise<RegistrationCheckInView> {
  const res = await fetch("/api/registrations/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : `Check-in failed (${res.status})`;
    const error = new Error(message) as Error & {
      status?: number;
      code?: string;
    };
    error.status = res.status;
    error.code = typeof payload.code === "string" ? payload.code : undefined;
    throw error;
  }
  return payload as RegistrationCheckInView;
}
