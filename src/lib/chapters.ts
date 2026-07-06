import { prisma } from "@/lib/db";
import { getPreferredSourceRank } from "@/lib/source-preference";

export const CHAPTER_PAGE_SIZE = 60;

export type ChapterListMode = "best" | "all";
export type ChapterSortDirection = "desc" | "asc";
export type ChapterTarget = "first" | "latest" | "next-unread";

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

type ChapterRecord = {
  id: string;
  chapterNumber: number;
  title: string | null;
  url: string;
  releaseDate: Date | null;
  createdAt?: Date | null;
  sourceId: string | null;
  readerStatus: string | null;
  source: {
    sourceName: string;
  } | null;
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
  sourceIds,
  lastReadChapterNumber,
  sortDirection = "desc",
  readableOnly = false,
}: {
  mangaId: string;
  cursor?: string;
  limit?: number;
  sourceId?: string;
  sourceIds?: string[];
  lastReadChapterNumber?: number | null;
  sortDirection?: ChapterSortDirection;
  readableOnly?: boolean;
}) {
  const pageSize = Math.min(Math.max(limit, 1), 100);
  const parsedCursor = parseChapterCursor(cursor);

  const chapters = await prisma.chapter.findMany({
    where: {
      mangaId,
      ...(readableOnly ? { readerStatus: "READABLE" } : {}),
      ...(sourceId ? { sourceId } : sourceIds ? { sourceId: { in: sourceIds } } : {}),
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

export async function getMangaChapterTarget({
  mangaId,
  mangaSlug,
  sourceId,
  sourceIds,
  sourceRanks,
  lastReadChapterNumber,
  target,
  readableOnly = false,
}: {
  mangaId: string;
  mangaSlug?: string | null;
  sourceId?: string;
  sourceIds?: string[];
  sourceRanks?: Record<string, number>;
  lastReadChapterNumber?: number | null;
  target: ChapterTarget;
  readableOnly?: boolean;
}) {
  const sourceFilter = sourceId ? { sourceId } : sourceIds ? { sourceId: { in: sourceIds } } : {};
  const chapterNumberFilter = target === "next-unread" && lastReadChapterNumber != null
    ? { chapterNumber: { gt: lastReadChapterNumber } }
    : {};
  const orderDirection = target === "latest" ? "desc" : "asc";

  const boundaryChapter = await prisma.chapter.findFirst({
    where: {
      mangaId,
      ...(readableOnly ? { readerStatus: "READABLE" } : {}),
      ...sourceFilter,
      ...chapterNumberFilter,
    },
    orderBy: [
      { chapterNumber: orderDirection },
      { releaseDate: orderDirection },
      { createdAt: orderDirection },
      { id: orderDirection },
    ],
    select: {
      chapterNumber: true,
    },
  });

  if (!boundaryChapter) return null;

  const candidates = await prisma.chapter.findMany({
    where: {
      mangaId,
      ...(readableOnly ? { readerStatus: "READABLE" } : {}),
      ...sourceFilter,
      chapterNumber: boundaryChapter.chapterNumber,
    },
    select: {
      id: true,
      chapterNumber: true,
      title: true,
      url: true,
      releaseDate: true,
      createdAt: true,
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
  const chapter = pickBestChapterCandidate(candidates, mangaSlug, sourceRanks);

  return chapter
    ? {
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        url: chapter.url,
        releaseDate: chapter.releaseDate,
        sourceId: chapter.sourceId,
        sourceName: chapter.source?.sourceName,
        readerStatus: chapter.readerStatus,
        isRead: lastReadChapterNumber != null && chapter.chapterNumber <= lastReadChapterNumber,
    } satisfies ChapterView
    : null;
}

function pickBestChapterCandidate(
  chapters: ChapterRecord[],
  mangaSlug?: string | null,
  sourceRanks?: Record<string, number>,
) {
  return [...chapters].sort((a, b) => {
    const rankDelta = getChapterSourceRank(b, mangaSlug, sourceRanks) - getChapterSourceRank(a, mangaSlug, sourceRanks);
    if (rankDelta !== 0) return rankDelta;

    const releaseDelta = getTime(b.releaseDate) - getTime(a.releaseDate);
    if (releaseDelta !== 0) return releaseDelta;

    const createdDelta = getTime(b.createdAt) - getTime(a.createdAt);
    if (createdDelta !== 0) return createdDelta;

    return a.id.localeCompare(b.id);
  })[0] ?? null;
}

function getChapterSourceRank(
  chapter: ChapterRecord,
  mangaSlug?: string | null,
  sourceRanks?: Record<string, number>,
) {
  if (chapter.sourceId && sourceRanks?.[chapter.sourceId] != null) {
    return sourceRanks[chapter.sourceId];
  }

  return getPreferredSourceRank(chapter.source?.sourceName, mangaSlug);
}

function getTime(value?: Date | string | null) {
  return value ? new Date(value).getTime() : 0;
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
