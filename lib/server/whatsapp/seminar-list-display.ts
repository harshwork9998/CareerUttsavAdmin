export const WHATSAPP_SEMINAR_LIST_TITLE_LIMIT = 24;
export const WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT = 72;

const SELECTED_DESCRIPTION_PREFIX = "✓ Selected · ";

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

export function buildSeminarListRowDescription(fullTitle: string): string {
  return truncateAtWordBoundary(
    fullTitle.trim(),
    WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT
  );
}

export function formatNumberedSeminarListRow(input: {
  displayNumber: number;
  fullTitle: string;
  selected: boolean;
}): { title: string; description: string } {
  const title = `Seminar ${input.displayNumber}`;
  const baseDescription = buildSeminarListRowDescription(input.fullTitle);

  if (!input.selected) {
    return { title, description: baseDescription };
  }

  const selectedDescription = `${SELECTED_DESCRIPTION_PREFIX}${baseDescription}`;
  if (selectedDescription.length <= WHATSAPP_SEMINAR_LIST_DESCRIPTION_LIMIT) {
    return { title, description: selectedDescription };
  }

  return { title, description: baseDescription };
}
