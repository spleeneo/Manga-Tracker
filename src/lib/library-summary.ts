import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface SummaryChapter {
  chapterNumber: number;
  url: string;
  releaseDate: Date | null;
}

export interface LibraryMangaSummary {
  id: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string | null;
  lastReadChapterNumber: number | null;
  latestChapter: SummaryChapter | null;
  nextUnreadChapter: SummaryChapter | null;
  totalChapters: number;
  readChapters: number;
  unreadChapters: number;
  isCaughtUp: boolean;
}

type LibraryEntry = {
  manga: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
    status: string | null;
  };
  lastReadChapterNumber: number | null;
};

type BestChapterRow = {
  mangaId: string;
  chapterNumber: number;
  url: string;
  releaseDate: Date | null;
};

function toNumber(value: number | Prisma.Decimal | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function buildSummary(entry: LibraryEntry, chapters: BestChapterRow[]): LibraryMangaSummary {
  const lastReadChapterNumber = toNumber(entry.lastReadChapterNumber);
  const latestChapter = chapters[0]
    ? {
        chapterNumber: toNumber(chapters[0].chapterNumber) ?? 0,
        url: chapters[0].url,
        releaseDate: chapters[0].releaseDate,
      }
    : null;
  const nextUnread = chapters
    .filter((chapter) => lastReadChapterNumber == null || chapter.chapterNumber > lastReadChapterNumber)
    .sort((a, b) => a.chapterNumber - b.chapterNumber)[0];
  const readChapters = chapters.filter((chapter) => (
    lastReadChapterNumber != null && chapter.chapterNumber <= lastReadChapterNumber
  )).length;

  return {
    ...entry.manga,
    lastReadChapterNumber,
    latestChapter,
    nextUnreadChapter: nextUnread
      ? {
          chapterNumber: toNumber(nextUnread.chapterNumber) ?? 0,
          url: nextUnread.url,
          releaseDate: nextUnread.releaseDate,
        }
      : null,
    totalChapters: chapters.length,
    readChapters,
    unreadChapters: chapters.length - readChapters,
    isCaughtUp: chapters.length > 0 && readChapters === chapters.length,
  };
}

async function getBestChaptersByManga(mangaIds: string[]) {
  if (mangaIds.length === 0) return new Map<string, BestChapterRow[]>();

  const rows = await prisma.$queryRaw<BestChapterRow[]>`
    SELECT DISTINCT ON (c."mangaId", c."chapterNumber")
      c."mangaId" AS "mangaId",
      c."chapterNumber" AS "chapterNumber",
      c."url" AS "url",
      c."releaseDate" AS "releaseDate"
    FROM "Chapter" c
    LEFT JOIN "Source" s ON s."id" = c."sourceId"
    WHERE c."mangaId" IN (${Prisma.join(mangaIds)})
    ORDER BY
      c."mangaId",
      c."chapterNumber" DESC,
      CASE LOWER(COALESCE(s."sourceName", ''))
        WHEN 'mangaplus' THEN 5
        WHEN 'mangadex' THEN 4
        WHEN 'webtoon' THEN 3
        WHEN 'nelomanga' THEN 2
        WHEN 'manganato' THEN 1
        ELSE 0
      END DESC,
      c."releaseDate" DESC NULLS LAST,
      c."createdAt" DESC
  `;

  const byManga = new Map<string, BestChapterRow[]>();
  for (const row of rows) {
    const chapter = {
      ...row,
      chapterNumber: toNumber(row.chapterNumber) ?? 0,
    };
    byManga.set(chapter.mangaId, [...(byManga.get(chapter.mangaId) ?? []), chapter]);
  }

  return byManga;
}

export async function getLibraryMangaSummaries(userId: string): Promise<LibraryMangaSummary[]> {
  const library = await prisma.userManga.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      lastReadChapterNumber: true,
      manga: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          status: true,
        },
      },
    },
  });

  const chaptersByManga = await getBestChaptersByManga(library.map((entry) => entry.manga.id));
  return library.map((entry) => buildSummary(entry, chaptersByManga.get(entry.manga.id) ?? []));
}

export async function getLibraryMangaSummary(userId: string, mangaId: string) {
  const entry = await prisma.userManga.findUnique({
    where: {
      userId_mangaId: {
        userId,
        mangaId,
      },
    },
    select: {
      lastReadChapterNumber: true,
      manga: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverUrl: true,
          status: true,
        },
      },
    },
  });

  if (!entry) return null;

  const chaptersByManga = await getBestChaptersByManga([mangaId]);
  return buildSummary(entry, chaptersByManga.get(mangaId) ?? []);
}
