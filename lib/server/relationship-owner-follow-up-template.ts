export function resolveRelationshipOwnerDigestTemplate(
  templateBase: string,
  totalDue: number
): string {
  const base = templateBase.trim();
  if (totalDue <= 0) {
    return `${base}_1`;
  }
  if (totalDue === 1) return `${base}_1`;
  if (totalDue === 2) return `${base}_2`;
  if (totalDue === 3) return `${base}_3`;
  if (totalDue === 4) return `${base}_4`;
  if (totalDue === 5) return `${base}_5`;
  return `${base}_5_plus`;
}
