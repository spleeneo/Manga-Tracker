type ContinueReadingCandidate = {
  unreadChapters: number;
  lastReadAt: Date | string | null;
  nextUnreadChapter: { releaseDate: Date | string | null } | null;
};

export function selectContinueReadingManga<T extends ContinueReadingCandidate>(
  items: T[],
  sortedItems: T[],
) {
  const unreadItems = items.filter((manga) => manga.unreadChapters > 0);
  const lastReadManga = [...unreadItems]
    .filter((manga) => manga.lastReadAt)
    .sort((a, b) => new Date(b.lastReadAt ?? 0).getTime() - new Date(a.lastReadAt ?? 0).getTime())[0];

  if (lastReadManga) return lastReadManga;

  return [...unreadItems]
    .sort((a, b) => {
      const aChapter = a.nextUnreadChapter?.releaseDate;
      const bChapter = b.nextUnreadChapter?.releaseDate;
      return (bChapter ? new Date(bChapter).getTime() : 0) - (aChapter ? new Date(aChapter).getTime() : 0);
    })[0] ?? sortedItems[0];
}
