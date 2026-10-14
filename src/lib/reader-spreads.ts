/** Group adjacent source pages; visual reading direction must not reorder the source. */
export function groupReaderPages<T extends { index: number }>(pages: T[], pairedStarts: number[]): T[][] {
  const starts = new Set(pairedStarts);
  const groups: T[][] = [];
  for (let position = 0; position < pages.length; position++) {
    const page = pages[position];
    const next = pages[position + 1];
    if (next && starts.has(page.index)) {
      groups.push([page, next]);
      position++;
    } else {
      groups.push([page]);
    }
  }
  return groups;
}
