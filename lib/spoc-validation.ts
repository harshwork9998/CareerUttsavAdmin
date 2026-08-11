import { requireIndianMobile, validateIndianMobileOnWrite } from "@/lib/indian-mobile";
import type { Spoc } from "@/types";

export function validateSpocInput(
  body: {
    name?: unknown;
    organization?: unknown;
    phone?: unknown;
    email?: unknown;
  },
  previous?: { phone?: string } | null
):
  | {
      ok: true;
      data: { name: string; organization: string; phone: string; email: string };
    }
  | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const organization =
    typeof body.organization === "string" ? body.organization.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (name.length < 2) {
    return { ok: false, error: "SPOC name is required (at least 2 characters)" };
  }
  if (organization.length < 2) {
    return { ok: false, error: "Organization name is required" };
  }

  const phoneCheck = previous
    ? validateIndianMobileOnWrite(
        typeof body.phone === "string" ? body.phone : "",
        previous.phone,
        { required: true, label: "SPOC contact number" }
      )
    : requireIndianMobile(body.phone, "SPOC contact number");

  if (!phoneCheck.ok) {
    return { ok: false, error: phoneCheck.error };
  }
  const phone =
    "mobile" in phoneCheck ? phoneCheck.mobile : phoneCheck.value;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid SPOC email" };
  }

  return {
    ok: true,
    data: { name, organization, phone, email },
  };
}

export type { Spoc };
