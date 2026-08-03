import type { Registration, RegistrationKind } from "@/types";

const CITY_CODES: Record<string, string> = {
  bangalore: "BLR",
  bengaluru: "BLR",
  mysore: "MYS",
  hubli: "HBL",
  "delhi ncr": "DEL",
  delhi: "DEL",
  hyderabad: "HYD",
  mumbai: "MUM",
  pune: "PUN",
  chennai: "CHN",
};

function cityCode(city: string): string {
  const key = city.trim().toLowerCase();
  if (CITY_CODES[key]) return CITY_CODES[key];
  const letters = key.replace(/[^a-z]/g, "");
  return (letters.slice(0, 3) || "CU").toUpperCase().padEnd(3, "X");
}

const KIND_CODES: Record<RegistrationKind, string> = {
  student: "",
  school: "SCH",
  partner_registration: "PTR",
  student_ambassador: "AMB",
};

export function nextRegistrationNumber(
  kind: RegistrationKind,
  eventCity: string,
  eventStartDate: string,
  existing: Registration[]
): string {
  const year =
    eventStartDate.match(/^\d{4}/)?.[0] ?? String(new Date().getFullYear());
  const kindCode = KIND_CODES[kind];
  const kindPart = kindCode ? `${kindCode}-` : "";
  const prefix = `CU-${kindPart}${cityCode(eventCity)}-${year}-`;
  const maxSeq = existing
    .map((registration) => registration.registrationNumber)
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.slice(prefix.length)))
    .filter((value) => !Number.isNaN(value))
    .reduce((max, value) => Math.max(max, value), 0);

  return `${prefix}${String(maxSeq + 1).padStart(5, "0")}`;
}
