export const WHATSAPP_SEMINAR_LIST_TITLE_LIMIT = 24;
export const WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT = 72;

export function truncateAtWordBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const ellipsis = "…";
  const allowance = Math.max(1, maxLength - ellipsis.length);
  let slice = trimmed.slice(0, allowance).trimEnd();
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 0) {
    slice = slice.slice(0, lastSpace);
  }

  return `${slice}${ellipsis}`;
}

function uniqueCandidates(candidates: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of candidates) {
    const normalized = candidate.replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function buildSeminarListDisplayTitle(
  fullTitle: string,
  maxLength = WHATSAPP_SEMINAR_LIST_TITLE_LIMIT
): string {
  const trimmed = fullTitle.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const candidates: string[] = [trimmed];
  const withoutParens = trimmed.replace(/\s*\([^)]*\)/g, "").trim();
  if (withoutParens) {
    candidates.push(withoutParens);
  }

  for (const separator of [" – ", " - ", ": ", " — "]) {
    for (const part of trimmed.split(separator)) {
      const normalized = part.trim();
      if (normalized) {
        candidates.push(normalized);
      }
    }
  }

  const base = withoutParens || trimmed;
  const words = base.split(/\s+/).filter(Boolean);
  for (let count = words.length - 1; count >= 1; count -= 1) {
    candidates.push(words.slice(0, count).join(" "));
  }

  for (const candidate of uniqueCandidates(candidates)) {
    if (candidate.length <= maxLength) {
      return candidate;
    }
  }

  return truncateAtWordBoundary(trimmed, maxLength);
}

export function buildSeminarListRowDescription(fullTitle: string): string {
  return truncateAtWordBoundary(
    fullTitle.trim(),
    WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT
  );
}

export function formatSeminarListRow(
  fullTitle: string,
  selected: boolean
): { title: string; description: string } {
  const prefix = selected ? "✓ " : "";
  const titleAllowance = WHATSAPP_SEMINAR_LIST_TITLE_LIMIT - prefix.length;
  const displayTitle = buildSeminarListDisplayTitle(fullTitle, titleAllowance);

  return {
    title: `${prefix}${displayTitle}`,
    description: buildSeminarListRowDescription(fullTitle),
  };
}
