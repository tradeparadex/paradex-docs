/**
 * Anchor id of a changelog entry's date, as on Fern: the date as an ISO
 * timestamp, e.g. "2026-10-02T00:00:00.000Z".
 */
export function changelogDateId(date: string): string {
  return new Date(date).toISOString();
}
