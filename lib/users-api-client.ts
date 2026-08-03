import type { User } from "@/types";

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err.error === "string" ? err.error : `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await fetch("/api/users", { cache: "no-store" });
  return parseJson<User[]>(res);
}

export async function createUserApi(
  user: Omit<User, "id" | "createdAt" | "updatedAt">
): Promise<User> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  return parseJson<User>(res);
}

export async function updateUserApi(
  id: string,
  data: Partial<User>
): Promise<User> {
  const res = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseJson<User>(res);
}

export async function reviewUserApi(
  id: string,
  payload: { action: "approve" | "reject"; role?: "user" | "superuser" }
): Promise<{ success: boolean; user: User; message?: string }> {
  const res = await fetch(`/api/users/${id}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean; user: User; message?: string }>(res);
}
