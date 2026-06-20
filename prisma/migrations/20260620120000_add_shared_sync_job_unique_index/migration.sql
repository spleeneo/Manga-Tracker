DELETE FROM "SyncJob" duplicate
USING "SyncJob" keep
WHERE duplicate."id" <> keep."id"
  AND duplicate."type" = keep."type"
  AND duplicate."mangaId" = keep."mangaId"
  AND duplicate."userId" IS NULL
  AND keep."userId" IS NULL
  AND duplicate."status" IN ('QUEUED', 'RUNNING')
  AND keep."status" IN ('QUEUED', 'RUNNING')
  AND (
    keep."status" = 'RUNNING'
    OR duplicate."status" <> 'RUNNING'
  )
  AND (
    (keep."status" = 'RUNNING' AND duplicate."status" <> 'RUNNING')
    OR keep."updatedAt" > duplicate."updatedAt"
    OR (keep."updatedAt" = duplicate."updatedAt" AND keep."id" > duplicate."id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "SyncJob_active_type_shared_manga_key"
ON "SyncJob"("type", "mangaId")
WHERE "status" IN ('QUEUED', 'RUNNING') AND "userId" IS NULL;
