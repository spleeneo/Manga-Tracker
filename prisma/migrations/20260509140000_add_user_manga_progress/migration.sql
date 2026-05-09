-- Add per-user manga progress so read state can be derived by chapter number.
ALTER TABLE "UserManga"
ADD COLUMN "lastReadChapterNumber" DOUBLE PRECISION,
ADD COLUMN "lastReadAt" TIMESTAMP(3);

-- Backfill from the legacy per-provider chapter read rows.
UPDATE "UserManga" um
SET
  "lastReadChapterNumber" = progress."chapterNumber",
  "lastReadAt" = progress."readAt"
FROM (
  SELECT
    uc."userId",
    c."mangaId",
    MAX(c."chapterNumber") AS "chapterNumber",
    MAX(uc."readAt") AS "readAt"
  FROM "UserChapter" uc
  INNER JOIN "Chapter" c ON c."id" = uc."chapterId"
  WHERE uc."isRead" = true
  GROUP BY uc."userId", c."mangaId"
) progress
WHERE um."userId" = progress."userId"
  AND um."mangaId" = progress."mangaId";
