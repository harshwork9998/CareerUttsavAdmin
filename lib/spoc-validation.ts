import type { Spoc } from "@/types";

export function validateSpocInput(body: {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
}):
  | { ok: true; data: { name: string; phone: string; email: string } }
  | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (name.length < 2) {
    return { ok: false, error: "SPOC name is required (at least 2 characters)" };
  }
  if (phone.length < 7) {
    return { ok: false, error: "SPOC contact number is required" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid SPOC email" };
  }

  return { ok: true, data: { name, phone, email } };
}

export type { Spoc };
