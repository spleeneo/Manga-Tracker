DELETE FROM "SyncJob" duplicate
USING "SyncJob" keep
WHERE duplicate."id" <> keep."id"
  AND duplicate."type" = keep."type"
  AND duplicate."userId" = keep."userId"
  AND duplicate."mangaId" = keep."mangaId"
  AND duplicate."userId" IS NOT NULL
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

CREATE UNIQUE INDEX IF NOT EXISTS "SyncJob_active_type_user_manga_key"
ON "SyncJob"("type", "userId", "mangaId")
WHERE "status" IN ('QUEUED', 'RUNNING') AND "userId" IS NOT NULL;
