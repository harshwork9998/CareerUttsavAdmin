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
 * Replace the allocated visible rows and keep any previously stored rows
 * beyond the new allocation.
 */
export function mergeRepresentativesPreservingHistory(
  existing: RepresentativeFields[] | undefined,
  allocation: number,
  submitted: RepresentativeFields[]
): RepresentativeFields[] {
  const prior = existing ?? [];
  const next = prior.map((row) => ({ ...row }));
  const visible = submitted.slice(0, allocation);
  for (let index = 0; index < visible.length; index += 1) {
    next[index] = visible[index];
  }
  return next;
}
