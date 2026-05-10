ALTER TABLE "UserManga"
ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'IDLE',
ADD COLUMN "syncStartedAt" TIMESTAMP(3),
ADD COLUMN "syncFinishedAt" TIMESTAMP(3),
ADD COLUMN "syncError" TEXT;

CREATE INDEX "UserManga_userId_updatedAt_idx" ON "UserManga"("userId", "updatedAt");
