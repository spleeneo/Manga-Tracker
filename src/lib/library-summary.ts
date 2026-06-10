import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface SummaryChapter {
  id: string;
  chapterNumber: number;
  url: string;
  releaseDate: Date | null;
  sourceName: string | null;
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
  lastReadAt: Date | null;
  latestChapter: SummaryChapter | null;
  latestAvailableAt: Date | null;
  estimatedNextChapterAt: Date | null;
  releaseCadenceDays: number | null;
  releaseEstimateSampleSize: number;
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
  lastReadAt: Date | null;
  latestChapterNumber: number | Prisma.Decimal | null;
  latestChapterId: string | null;
  latestUrl: string | null;
  latestSourceName: string | null;
  latestReleaseDate: Date | null;
  latestAvailableAt: Date | null;
  estimatedNextChapterAt: Date | null;
  releaseCadenceDays: number | Prisma.Decimal | null;
  releaseEstimateSampleSize: number | bigint | null;
  nextUnreadChapterNumber: number | Prisma.Decimal | null;
  nextUnreadChapterId: string | null;
  nextUnreadUrl: string | null;
  nextUnreadSourceName: string | null;
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
    lastReadAt: row.lastReadAt,
    latestChapter: row.latestChapterNumber != null && row.latestUrl
      ? {
          id: row.latestChapterId ?? "",
          chapterNumber: toNumber(row.latestChapterNumber) ?? 0,
          url: row.latestUrl,
          releaseDate: row.latestReleaseDate,
          sourceName: row.latestSourceName,
        }
      : null,
    latestAvailableAt: row.latestAvailableAt,
    estimatedNextChapterAt: row.status?.toUpperCase() === "ONGOING" ? row.estimatedNextChapterAt : null,
    releaseCadenceDays: row.status?.toUpperCase() === "ONGOING" ? toNumber(row.releaseCadenceDays) : null,
    releaseEstimateSampleSize: row.status?.toUpperCase() === "ONGOING" ? toCount(row.releaseEstimateSampleSize) : 0,
    nextUnreadChapter: row.nextUnreadChapterNumber != null && row.nextUnreadUrl
      ? {
          id: row.nextUnreadChapterId ?? "",
          chapterNumber: toNumber(row.nextUnreadChapterNumber) ?? 0,
          url: row.nextUnreadUrl,
          releaseDate: row.nextUnreadReleaseDate,
          sourceName: row.nextUnreadSourceName,
        }
      : null,
    totalChapters,
    readChapters,
    unreadChapters: Math.max(totalChapters - readChapters, 0),
    isCaughtUp: totalChapters > 0 && readChapters >= totalChapters,
  };
}

const SOURCE_RANK_SQL = Prisma.sql`
  CASE
    WHEN LOWER(m."slug") = 'witch-hat-atelier' AND LOWER(COALESCE(s."sourceName", '')) = 'witch hat atelier manga' THEN 9
    WHEN LOWER(m."slug") = 'bleach' AND LOWER(COALESCE(s."sourceName", '')) = 'bleach live' THEN 8
    ELSE CASE LOWER(COALESCE(s."sourceName", ''))
    WHEN 'mangapill' THEN 8
    WHEN 'nelomanga' THEN 7
    WHEN 'witch hat atelier manga' THEN 6
    WHEN 'land of the lustrous' THEN 6
    WHEN 'blue lock manga' THEN 6
    WHEN 'fire punch' THEN 6
    WHEN 'urek mazino' THEN 5
    WHEN 'bleach live' THEN 5
    WHEN 'atsumaru' THEN 5
    WHEN 'mangaplus' THEN 4
    WHEN 'mangadex' THEN 3
    WHEN 'webtoon' THEN 2
    WHEN 'manganato' THEN 1
    ELSE 0
    END
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
      um."lastReadAt" AS "lastReadAt",
      latest."chapterNumber" AS "latestChapterNumber",
      latest."id" AS "latestChapterId",
      latest."url" AS "latestUrl",
      latest."sourceName" AS "latestSourceName",
      latest."releaseDate" AS "latestReleaseDate",
      latest."availableAt" AS "latestAvailableAt",
      release_estimate."estimatedNextChapterAt" AS "estimatedNextChapterAt",
      release_estimate."releaseCadenceDays" AS "releaseCadenceDays",
      COALESCE(release_estimate."releaseEstimateSampleSize", 0) AS "releaseEstimateSampleSize",
      next_unread."chapterNumber" AS "nextUnreadChapterNumber",
      next_unread."id" AS "nextUnreadChapterId",
      next_unread."url" AS "nextUnreadUrl",
      next_unread."sourceName" AS "nextUnreadSourceName",
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
      LEFT JOIN "Source" s ON s."id" = c."sourceId"
      WHERE c."mangaId" = m."id"
    ) counts ON true
    LEFT JOIN LATERAL (
      SELECT DISTINCT ON (c."chapterNumber")
        c."id",
        c."chapterNumber",
        c."url",
        s."sourceName",
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
      WITH releases AS (
        SELECT DISTINCT ON (c."chapterNumber")
          c."chapterNumber",
          c."releaseDate"
        FROM "Chapter" c
        LEFT JOIN "Source" s ON s."id" = c."sourceId"
        WHERE c."mangaId" = m."id"
          AND c."releaseDate" IS NOT NULL
          AND c."releaseDate" <= now()
        ORDER BY
          c."chapterNumber" DESC,
          ${SOURCE_RANK_SQL} DESC,
          c."releaseDate" DESC,
          c."createdAt" DESC
        LIMIT 10
      ),
      gaps AS (
        SELECT
          EXTRACT(EPOCH FROM (r."releaseDate" - LEAD(r."releaseDate") OVER (ORDER BY r."releaseDate" DESC))) AS "gapSeconds"
        FROM releases r
      ),
      valid_gaps AS (
        SELECT "gapSeconds"
        FROM gaps
        WHERE "gapSeconds" BETWEEN 43200 AND 10368000
      )
      SELECT
        CASE
          WHEN COUNT(*) >= 2 THEN
            (SELECT MAX("releaseDate") FROM releases)
            + (percentile_cont(0.5) WITHIN GROUP (ORDER BY "gapSeconds") * INTERVAL '1 second')
          ELSE NULL
        END AS "estimatedNextChapterAt",
        CASE
          WHEN COUNT(*) >= 2 THEN
            ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY "gapSeconds") / 86400)::numeric, 1)
          ELSE NULL
        END AS "releaseCadenceDays",
        COUNT(*)::int AS "releaseEstimateSampleSize"
      FROM valid_gaps
    ) release_estimate ON LOWER(COALESCE(m."status", '')) = 'ongoing'
    LEFT JOIN LATERAL (
      SELECT DISTINCT ON (c."chapterNumber")
        c."id",
        c."chapterNumber",
        c."url",
        s."sourceName",
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
