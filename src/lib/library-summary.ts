import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface SummaryChapter {
  id: string;
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
  syncStatus: string;
  syncStartedAt: Date | null;
  syncFinishedAt: Date | null;
  syncError: string | null;
  lastReadChapterNumber: number | null;
  latestChapter: SummaryChapter | null;
  latestAvailableAt: Date | null;
  nextUnreadChapter: SummaryChapter | null;
  totalChapters: number;
  readChapters: number;
  unreadChapters: number;
  isCaughtUp: boolean;
}

type SummaryRow = {
  mangaId: string;
  title: string;
  slug: string;
  coverUrl: string | null;
  status: string | null;
  syncStatus: string;
  syncStartedAt: Date | null;
  syncFinishedAt: Date | null;
  syncError: string | null;
  lastReadChapterNumber: number | Prisma.Decimal | null;
  latestChapterNumber: number | Prisma.Decimal | null;
  latestChapterId: string | null;
  latestUrl: string | null;
  latestReleaseDate: Date | null;
  latestAvailableAt: Date | null;
  nextUnreadChapterNumber: number | Prisma.Decimal | null;
  nextUnreadChapterId: string | null;
  nextUnreadUrl: string | null;
  nextUnreadReleaseDate: Date | null;
  totalChapters: number | bigint | null;
  readChapters: number | bigint | null;
};

function toNumber(value: number | Prisma.Decimal | null | undefined) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function toCount(value: number | bigint | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function buildSummaryFromRow(row: SummaryRow): LibraryMangaSummary {
  const lastReadChapterNumber = toNumber(row.lastReadChapterNumber);
  const totalChapters = toCount(row.totalChapters);
  const readChapters = toCount(row.readChapters);

  return {
    id: row.mangaId,
    title: row.title,
    slug: row.slug,
    coverUrl: row.coverUrl,
    status: row.status,
    syncStatus: row.syncStatus,
    syncStartedAt: row.syncStartedAt,
    syncFinishedAt: row.syncFinishedAt,
    syncError: row.syncError,
    lastReadChapterNumber,
    latestChapter: row.latestChapterNumber != null && row.latestUrl
      ? {
          id: row.latestChapterId ?? "",
          chapterNumber: toNumber(row.latestChapterNumber) ?? 0,
          url: row.latestUrl,
          releaseDate: row.latestReleaseDate,
        }
      : null,
    latestAvailableAt: row.latestAvailableAt,
    nextUnreadChapter: row.nextUnreadChapterNumber != null && row.nextUnreadUrl
      ? {
          id: row.nextUnreadChapterId ?? "",
          chapterNumber: toNumber(row.nextUnreadChapterNumber) ?? 0,
          url: row.nextUnreadUrl,
          releaseDate: row.nextUnreadReleaseDate,
        }
      : null,
    totalChapters,
    readChapters,
    unreadChapters: Math.max(totalChapters - readChapters, 0),
    isCaughtUp: totalChapters > 0 && readChapters >= totalChapters,
  };
}

const SOURCE_RANK_SQL = Prisma.sql`
  CASE LOWER(COALESCE(s."sourceName", ''))
    WHEN 'nelomanga' THEN 7
    WHEN 'urek mazino' THEN 6
    WHEN 'bleach live' THEN 6
    WHEN 'mangaplus' THEN 5
    WHEN 'mangadex' THEN 4
    WHEN 'webtoon' THEN 3
    WHEN 'manganato' THEN 1
    ELSE 0
  END
`;

async function getSummaryRows(userId: string, mangaId?: string) {
  return prisma.$queryRaw<SummaryRow[]>`
    SELECT
      m."id" AS "mangaId",
      m."title" AS "title",
      m."slug" AS "slug",
      m."coverUrl" AS "coverUrl",
      m."status" AS "status",
      um."syncStatus" AS "syncStatus",
      um."syncStartedAt" AS "syncStartedAt",
      um."syncFinishedAt" AS "syncFinishedAt",
      um."syncError" AS "syncError",
      um."lastReadChapterNumber" AS "lastReadChapterNumber",
      latest."chapterNumber" AS "latestChapterNumber",
      latest."id" AS "latestChapterId",
      latest."url" AS "latestUrl",
      latest."releaseDate" AS "latestReleaseDate",
      latest."availableAt" AS "latestAvailableAt",
      next_unread."chapterNumber" AS "nextUnreadChapterNumber",
      next_unread."id" AS "nextUnreadChapterId",
      next_unread."url" AS "nextUnreadUrl",
      next_unread."releaseDate" AS "nextUnreadReleaseDate",
      COALESCE(counts."totalChapters", 0) AS "totalChapters",
      COALESCE(counts."readChapters", 0) AS "readChapters"
    FROM "UserManga" um
    JOIN "Manga" m ON m."id" = um."mangaId"
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT c."chapterNumber")::int AS "totalChapters",
        COUNT(DISTINCT c."chapterNumber") FILTER (
          WHERE um."lastReadChapterNumber" IS NOT NULL
            AND c."chapterNumber" <= um."lastReadChapterNumber"
        )::int AS "readChapters"
      FROM "Chapter" c
      WHERE c."mangaId" = m."id"
    ) counts ON true
    LEFT JOIN LATERAL (
      SELECT DISTINCT ON (c."chapterNumber")
        c."id",
        c."chapterNumber",
        c."url",
        c."releaseDate",
        COALESCE(c."releaseDate", c."createdAt") AS "availableAt"
      FROM "Chapter" c
      LEFT JOIN "Source" s ON s."id" = c."sourceId"
      WHERE c."mangaId" = m."id"
      ORDER BY
        c."chapterNumber" DESC,
        ${SOURCE_RANK_SQL} DESC,
        c."releaseDate" DESC NULLS LAST,
        c."createdAt" DESC
      LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT DISTINCT ON (c."chapterNumber")
        c."id",
        c."chapterNumber",
        c."url",
        c."releaseDate"
      FROM "Chapter" c
      LEFT JOIN "Source" s ON s."id" = c."sourceId"
      WHERE c."mangaId" = m."id"
        AND (um."lastReadChapterNumber" IS NULL OR c."chapterNumber" > um."lastReadChapterNumber")
      ORDER BY
        c."chapterNumber" ASC,
        ${SOURCE_RANK_SQL} DESC,
        c."releaseDate" DESC NULLS LAST,
        c."createdAt" DESC
      LIMIT 1
    ) next_unread ON true
    WHERE um."userId" = ${userId}
      ${mangaId ? Prisma.sql`AND um."mangaId" = ${mangaId}` : Prisma.empty}
    ORDER BY latest."availableAt" DESC NULLS LAST, latest."chapterNumber" DESC NULLS LAST, um."updatedAt" DESC
  `;
}

export async function getLibraryMangaSummaries(userId: string): Promise<LibraryMangaSummary[]> {
  const rows = await getSummaryRows(userId);
  return rows.map(buildSummaryFromRow);
}

export async function getLibraryMangaSummary(userId: string, mangaId: string) {
  const [row] = await getSummaryRows(userId, mangaId);
  return row ? buildSummaryFromRow(row) : null;
}
