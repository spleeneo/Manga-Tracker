/** Group adjacent source pages; visual reading direction must not reorder the source. */
export function groupReaderPages<T extends { index: number; width?: number; height?: number }>(pages: T[], pairedStarts: number[], { auto = false, singlePages = [] }: { auto?: boolean; singlePages?: number[] } = {}): T[][] {
  const starts = new Set(pairedStarts);
  const singles = new Set(singlePages);
  const groups: T[][] = [];
  for (let position = 0; position < pages.length; position++) {
    const page = pages[position];
    const next = pages[position + 1];
    const automaticPair = auto && next && !starts.has(next.index)
      && !singles.has(page.index) && !singles.has(next.index)
      && isPortraitPage(page) && isPortraitPage(next);
    if (next && (starts.has(page.index) || automaticPair)) {
      groups.push([page, next]);
      position++;
    } else {
      groups.push([page]);
    }
  }
  return groups;
}

export function isLandscapePage(page: { width?: number; height?: number }) {
  const { width, height } = page;
  return Boolean(width && height && Number.isFinite(width) && Number.isFinite(height) && height > 0 && width > height);
}

function isPortraitPage(page: { width?: number; height?: number }) {
  const { width, height } = page;
  // Very tall images are usually vertical scrolling strips rather than printed pages.
  return Boolean(width && height && Number.isFinite(width) && Number.isFinite(height)
    && width > 0 && height > width && height / width <= 2.5);
}
