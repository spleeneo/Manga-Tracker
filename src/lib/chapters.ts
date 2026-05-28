import { prisma } from "@/lib/db";

export const CHAPTER_PAGE_SIZE = 60;

export type ChapterListMode = "best" | "all";
export type ChapterSortDirection = "desc" | "asc";

export interface ChapterView {
  id: string;
  chapterNumber: number;
  title: string | null;
  url: string;
  releaseDate: Date | null;
  isRead: boolean;
  sourceId: string | null;
  sourceName?: string;
  readerStatus: string | null;
}

type ChapterCursor = {
  id: string;
};

export function getChapterMode(value: string | null): ChapterListMode {
  return value === "all" ? "all" : "best";
}

export function getChapterSortDirection(value: string | null): ChapterSortDirection {
  return value === "asc" ? "asc" : "desc";
}

export async function getMangaChapterPage({
  mangaId,
  cursor,
  limit = CHAPTER_PAGE_SIZE,
  sourceId,
  lastReadChapterNumber,
  sortDirection = "desc",
}: {
  mangaId: string;
  cursor?: string;
  limit?: number;
  sourceId?: string;
  lastReadChapterNumber?: number | null;
  sortDirection?: ChapterSortDirection;
}) {
  const pageSize = Math.min(Math.max(limit, 1), 100);
  const parsedCursor = parseChapterCursor(cursor);

  const chapters = await prisma.chapter.findMany({
    where: {
      mangaId,
      ...(sourceId ? { sourceId } : {}),
    },
    ...(parsedCursor ? { cursor: { id: parsedCursor.id }, skip: 1 } : {}),
    orderBy: [
      { chapterNumber: sortDirection },
      { releaseDate: sortDirection },
      { createdAt: sortDirection },
      { id: sortDirection },
    ],
    take: pageSize + 1,
    select: {
      id: true,
      chapterNumber: true,
      title: true,
      url: true,
      releaseDate: true,
      sourceId: true,
      providerChapterId: true,
      readerStatus: true,
      source: {
        select: {
          sourceName: true,
        },
      },
    },
  });

  const visibleChapters = chapters.slice(0, pageSize);
  return {
    chapters: visibleChapters.map((chapter): ChapterView => ({
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      url: chapter.url,
      releaseDate: chapter.releaseDate,
      sourceId: chapter.sourceId,
      sourceName: chapter.source?.sourceName,
      readerStatus: chapter.readerStatus,
      isRead: lastReadChapterNumber != null && chapter.chapterNumber <= lastReadChapterNumber,
    })),
    nextCursor: chapters.length > pageSize && visibleChapters.length > 0
      ? createChapterCursor(visibleChapters[visibleChapters.length - 1]?.id)
      : null,
  };
}

function createChapterCursor(id?: string) {
  if (!id) return null;
  return Buffer.from(JSON.stringify({ id } satisfies ChapterCursor), "utf8").toString("base64url");
}

function parseChapterCursor(cursor?: string): ChapterCursor | null {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<ChapterCursor>;
    return typeof parsed.id === "string" && parsed.id ? { id: parsed.id } : null;
  } catch {
    return null;
  }
}
