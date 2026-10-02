/** Anchor id of a changelog entry's date, e.g. "October 2, 2026" -> "october-2-2026". */
export function changelogDateId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
