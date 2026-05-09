import { prisma } from "@/lib/db";

export const CHAPTER_PAGE_SIZE = 60;

export type ChapterListMode = "best" | "all";

export interface ChapterView {
  id: string;
  chapterNumber: number;
  title: string | null;
  url: string;
  releaseDate: Date | null;
  isRead: boolean;
  sourceId: string | null;
}

export function getChapterMode(value: string | null): ChapterListMode {
  return value === "all" ? "all" : "best";
}

export async function getMangaChapterPage({
  mangaId,
  cursor,
  limit = CHAPTER_PAGE_SIZE,
  sourceId,
  lastReadChapterNumber,
}: {
  mangaId: string;
  cursor?: number;
  limit?: number;
  sourceId?: string;
  lastReadChapterNumber?: number | null;
}) {
  const pageSize = Math.min(Math.max(limit, 1), 100);

  const chapters = await prisma.chapter.findMany({
    where: {
      mangaId,
      ...(sourceId ? { sourceId } : {}),
      ...(typeof cursor === "number"
        ? { chapterNumber: { lt: cursor } }
        : {}),
    },
    orderBy: [
      { chapterNumber: "desc" },
      { releaseDate: "desc" },
      { createdAt: "desc" },
    ],
    take: pageSize + 1,
    select: {
      id: true,
      chapterNumber: true,
      title: true,
      url: true,
      releaseDate: true,
      sourceId: true,
    },
  });

  const visibleChapters = chapters.slice(0, pageSize);
  return {
    chapters: visibleChapters.map((chapter): ChapterView => ({
      ...chapter,
      isRead: lastReadChapterNumber != null && chapter.chapterNumber <= lastReadChapterNumber,
    })),
    nextCursor: chapters.length > pageSize
      ? visibleChapters[visibleChapters.length - 1]?.chapterNumber ?? null
      : null,
  };
}
