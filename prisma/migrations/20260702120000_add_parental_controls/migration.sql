ALTER TABLE "Manga" ADD COLUMN "contentRating" TEXT;
ALTER TABLE "Manga" ADD COLUMN "classificationSource" TEXT;
ALTER TABLE "Manga" ADD COLUMN "classifiedAt" TIMESTAMP(3);

CREATE TABLE "ParentChildLink" (
  "id" TEXT NOT NULL, "parentId" TEXT NOT NULL, "childId" TEXT, "childEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ParentChildLink_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChildPolicy" (
  "id" TEXT NOT NULL, "childId" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "allowedContentRatings" TEXT[] DEFAULT ARRAY['safe']::TEXT[],
  "blockedTagNames" TEXT[] DEFAULT ARRAY['gore', 'sexual violence']::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChildPolicy_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ContentTag" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "group" TEXT, CONSTRAINT "ContentTag_pkey" PRIMARY KEY ("id"));
CREATE TABLE "MangaTag" ("mangaId" TEXT NOT NULL, "tagId" TEXT NOT NULL, CONSTRAINT "MangaTag_pkey" PRIMARY KEY ("mangaId","tagId"));
CREATE TABLE "ChildMangaOverride" (
  "id" TEXT NOT NULL, "childId" TEXT NOT NULL, "mangaId" TEXT NOT NULL, "decision" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChildMangaOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ParentChildLink_childId_key" ON "ParentChildLink"("childId");
CREATE UNIQUE INDEX "ParentChildLink_childEmail_key" ON "ParentChildLink"("childEmail");
CREATE INDEX "ParentChildLink_parentId_idx" ON "ParentChildLink"("parentId");
CREATE UNIQUE INDEX "ChildPolicy_childId_key" ON "ChildPolicy"("childId");
CREATE INDEX "ContentTag_name_idx" ON "ContentTag"("name");
CREATE INDEX "MangaTag_tagId_idx" ON "MangaTag"("tagId");
CREATE UNIQUE INDEX "ChildMangaOverride_childId_mangaId_key" ON "ChildMangaOverride"("childId","mangaId");
CREATE INDEX "ChildMangaOverride_mangaId_idx" ON "ChildMangaOverride"("mangaId");
ALTER TABLE "ParentChildLink" ADD CONSTRAINT "ParentChildLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentChildLink" ADD CONSTRAINT "ParentChildLink_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildPolicy" ADD CONSTRAINT "ChildPolicy_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MangaTag" ADD CONSTRAINT "MangaTag_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MangaTag" ADD CONSTRAINT "MangaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ContentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildMangaOverride" ADD CONSTRAINT "ChildMangaOverride_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildMangaOverride" ADD CONSTRAINT "ChildMangaOverride_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChildMangaOverride" ADD CONSTRAINT "ChildMangaOverride_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
