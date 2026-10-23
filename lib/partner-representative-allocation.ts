export type RepresentativeFields = {
  name: string;
  designation: string;
  phone: string;
};

export function parseRepresentativeSlotCount(
  value: unknown
): { ok: true; count: number } | { ok: false; error: string } {
  if (typeof value === "string" && value.trim() === "") {
    return { ok: true, count: 0 };
  }
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(count) || count < 0) {
    return {
      ok: false,
      error: "Event representative slots must be a whole number of 0 or more.",
    };
  }
  return { ok: true, count };
}

/**
 * Replace representatives inside the current allocation and keep any
 * previously stored rows beyond that maximum. Blank rows are not stored.
 */
export function mergeRepresentativesPreservingHistory(
  existing: RepresentativeFields[] | undefined,
  allocation: number,
  submitted: RepresentativeFields[]
): RepresentativeFields[] {
  const prior = existing ?? [];
  const maximum = Number.isInteger(allocation) && allocation > 0 ? allocation : 0;
  const visible = submitted
    .filter(
      (row) =>
        Boolean(row.name.trim() || row.designation.trim() || row.phone.trim())
    )
    .slice(0, maximum);
  return [...visible, ...prior.slice(maximum)];
}
