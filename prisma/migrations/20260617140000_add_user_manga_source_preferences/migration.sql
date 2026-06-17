CREATE TABLE "UserMangaSourcePreference" (
    "id" TEXT NOT NULL,
    "userMangaId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMangaSourcePreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMangaSourcePreference_userMangaId_sourceId_key" ON "UserMangaSourcePreference"("userMangaId", "sourceId");

CREATE INDEX "UserMangaSourcePreference_sourceId_idx" ON "UserMangaSourcePreference"("sourceId");

CREATE INDEX "UserMangaSourcePreference_userMangaId_position_idx" ON "UserMangaSourcePreference"("userMangaId", "position");

ALTER TABLE "UserMangaSourcePreference" ADD CONSTRAINT "UserMangaSourcePreference_userMangaId_fkey" FOREIGN KEY ("userMangaId") REFERENCES "UserManga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMangaSourcePreference" ADD CONSTRAINT "UserMangaSourcePreference_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
