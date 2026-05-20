ALTER TABLE "Chapter"
ADD COLUMN "readerStatus" TEXT,
ADD COLUMN "readerCheckedAt" TIMESTAMP(3),
ADD COLUMN "readerPageCount" INTEGER,
ADD COLUMN "readerError" TEXT;
