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
 * The saved list is the current submission. People who were removed are not
 * kept, and rows beyond the Admin maximum are not appended back.
 */
export function mergeRepresentativesPreservingHistory(
  _existing: RepresentativeFields[] | undefined,
  allocation: number,
  submitted: RepresentativeFields[]
): RepresentativeFields[] {
  const maximum = Number.isInteger(allocation) && allocation > 0 ? allocation : 0;
  return submitted
    .filter(
      (row) =>
        Boolean(row.name.trim() || row.designation.trim() || row.phone.trim())
    )
    .slice(0, maximum);
}
