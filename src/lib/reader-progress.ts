export type ReaderProgressRect = {
  top: number;
  bottom: number;
};

export function isReaderChapterCompleted({
  sectionRect,
  lastPageRect,
  lastPageLoaded,
  viewportHeight,
  thresholdPx,
}: {
  sectionRect: ReaderProgressRect;
  lastPageRect: ReaderProgressRect | null;
  lastPageLoaded: boolean;
  viewportHeight: number;
  thresholdPx: number;
}) {
  if (!lastPageLoaded || !lastPageRect) return false;

  const sectionWasEntered = sectionRect.top < viewportHeight * 0.25;
  const lastPageWasEntered = lastPageRect.top < viewportHeight * 0.95;
  const lastPageEndReached = lastPageRect.bottom <= viewportHeight + thresholdPx;

  return sectionWasEntered && lastPageWasEntered && lastPageEndReached;
}
