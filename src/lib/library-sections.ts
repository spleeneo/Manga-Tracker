import { normalizeMangaStatus } from "@/lib/manga-status";
import type { LibraryMangaSummary } from "@/lib/library-summary";

export type LibrarySection<T extends Pick<LibraryMangaSummary, "status" | "unreadChapters" | "isCaughtUp">> = {
  id: "updates" | "caught-up" | "completed";
  title: string;
  description: string;
  items: T[];
};

function isCompletedStatus(status: string | null | undefined) {
  return normalizeMangaStatus(status) === "COMPLETED";
}

export function groupLibrarySections<T extends Pick<LibraryMangaSummary, "status" | "unreadChapters" | "isCaughtUp">>(
  sortedItems: T[],
): LibrarySection<T>[] {
  const isFullyReadCompleted = (manga: T) => isCompletedStatus(manga.status) && manga.isCaughtUp;
  const completed = sortedItems.filter(isFullyReadCompleted);
  const updates = sortedItems.filter((manga) => manga.unreadChapters > 0);
  const caughtUp = sortedItems.filter((manga) => manga.unreadChapters === 0 && !isFullyReadCompleted(manga));

  return [
    {
      id: "updates",
      title: "Updates to Read",
      description: "Fresh chapters waiting for you.",
      items: updates,
    },
    {
      id: "caught-up",
      title: "Caught Up",
      description: "Ongoing titles with nothing new right now.",
      items: caughtUp,
    },
    {
      id: "completed",
      title: "Completed",
      description: "Finished series kept in your library.",
      items: completed,
    },
  ];
}
