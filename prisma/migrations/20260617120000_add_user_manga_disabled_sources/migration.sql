CREATE TABLE "UserMangaDisabledSource" (
    "id" TEXT NOT NULL,
    "userMangaId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMangaDisabledSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMangaDisabledSource_userMangaId_sourceId_key" ON "UserMangaDisabledSource"("userMangaId", "sourceId");

CREATE INDEX "UserMangaDisabledSource_sourceId_idx" ON "UserMangaDisabledSource"("sourceId");

ALTER TABLE "UserMangaDisabledSource" ADD CONSTRAINT "UserMangaDisabledSource_userMangaId_fkey" FOREIGN KEY ("userMangaId") REFERENCES "UserManga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMangaDisabledSource" ADD CONSTRAINT "UserMangaDisabledSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
