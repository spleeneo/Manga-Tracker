import { normalizeMangaStatus } from "@/lib/manga-status";
import type { LibraryMangaSummary } from "@/lib/library-summary";

export type LibrarySection<T extends Pick<LibraryMangaSummary, "status" | "unreadChapters">> = {
  id: "updates" | "caught-up" | "completed";
  title: string;
  description: string;
  items: T[];
};

function isCompletedStatus(status: string | null | undefined) {
  return normalizeMangaStatus(status) === "COMPLETED";
}

export function groupLibrarySections<T extends Pick<LibraryMangaSummary, "status" | "unreadChapters">>(
  sortedItems: T[],
): LibrarySection<T>[] {
  const activeItems = sortedItems.filter((manga) => !isCompletedStatus(manga.status));
  const completed = sortedItems.filter((manga) => isCompletedStatus(manga.status));
  const updates = activeItems.filter((manga) => manga.unreadChapters > 0);
  const caughtUp = activeItems.filter((manga) => manga.unreadChapters === 0);

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
