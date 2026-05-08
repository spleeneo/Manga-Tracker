-- CreateTable
CREATE TABLE "Manga" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coverUrl" TEXT,
    "author" TEXT,
    "status" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "disabledUntil" TIMESTAMP(3),

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Source_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "sourceId" TEXT,
    "providerChapterId" TEXT,
    "chapterNumber" DOUBLE PRECISION NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Chapter_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chapter_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Manga_slug_key" ON "Manga"("slug");

-- CreateIndex
CREATE INDEX "Source_sourceName_idx" ON "Source"("sourceName");

-- CreateIndex
CREATE UNIQUE INDEX "Source_mangaId_sourceUrl_key" ON "Source"("mangaId", "sourceUrl");

-- CreateIndex
CREATE INDEX "Chapter_mangaId_chapterNumber_idx" ON "Chapter"("mangaId", "chapterNumber");

-- CreateIndex
CREATE INDEX "Chapter_sourceId_chapterNumber_idx" ON "Chapter"("sourceId", "chapterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_sourceId_providerChapterId_key" ON "Chapter"("sourceId", "providerChapterId");
