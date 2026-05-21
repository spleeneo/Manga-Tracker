CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "userId" TEXT,
    "mangaId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncJob_status_runAfter_idx" ON "SyncJob"("status", "runAfter");
CREATE INDEX "SyncJob_userId_status_idx" ON "SyncJob"("userId", "status");
CREATE INDEX "SyncJob_mangaId_status_idx" ON "SyncJob"("mangaId", "status");

ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "Chapter" c
USING "Chapter" duplicate
WHERE c."sourceId" IS NOT NULL
  AND duplicate."sourceId" = c."sourceId"
  AND duplicate."chapterNumber" = c."chapterNumber"
  AND (
    COALESCE(duplicate."releaseDate", duplicate."createdAt") > COALESCE(c."releaseDate", c."createdAt")
    OR (
      COALESCE(duplicate."releaseDate", duplicate."createdAt") = COALESCE(c."releaseDate", c."createdAt")
      AND duplicate."id" > c."id"
    )
  );

CREATE UNIQUE INDEX "Chapter_sourceId_chapterNumber_key" ON "Chapter"("sourceId", "chapterNumber");
