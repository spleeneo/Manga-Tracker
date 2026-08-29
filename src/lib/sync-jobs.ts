import { prisma } from "@/lib/db";
import { updateSingleManga } from "@/lib/manga-updater";

const SYNC_JOB_TYPE = "MANGA_UPDATE";
const MAX_ATTEMPTS = 3;
const DEFAULT_QUEUE_LIMIT = 20;
const DEFAULT_CONCURRENCY = 4;
const STALE_RUNNING_JOB_MS = 10 * 60_000;

type SyncJobRef = { id: string };
type ClaimedJob = { id: string };

type ProcessQueuedSyncJobsOptions = {
  limit?: number;
  concurrency?: number;
};

type ProcessSyncJobsOptions = {
  concurrency?: number;
};

type RecoverStaleSyncJobsOptions = {
  mangaId?: string;
  staleAfterMs?: number;
};

export async function recoverStaleRunningSyncJobs(options: RecoverStaleSyncJobsOptions = {}) {
  const staleAfterMs = options.staleAfterMs ?? STALE_RUNNING_JOB_MS;
  const staleBefore = new Date(Date.now() - staleAfterMs);

  return prisma.syncJob.updateMany({
    where: {
      type: SYNC_JOB_TYPE,
      status: "RUNNING",
      lockedAt: { lt: staleBefore },
      ...(options.mangaId ? { mangaId: options.mangaId } : {}),
    },
    data: {
      status: "QUEUED",
      runAfter: new Date(),
      lockedAt: null,
      error: "Previous sync worker timed out before completion",
    },
  });
}

async function markUserMangaSyncing(userId: string, mangaId: string) {
  const now = new Date();

  await prisma.userManga.update({
    where: {
      userId_mangaId: {
        userId,
        mangaId,
      },
    },
    data: {
      syncStatus: "SYNCING",
      syncStartedAt: now,
      syncFinishedAt: null,
      syncError: null,
    },
  });
}

export async function enqueueSharedMangaSyncJob(mangaId: string): Promise<SyncJobRef> {
  await recoverStaleRunningSyncJobs({ mangaId });

  const now = new Date();
  const activeJobs = await prisma.syncJob.findMany({
    where: {
      type: SYNC_JOB_TYPE,
      userId: null,
      mangaId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: {
      id: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const runningJob = activeJobs.find((job) => job.status === "RUNNING");
  const existingJob = runningJob ?? activeJobs[0];

  if (existingJob) {
    const duplicateJobIds = activeJobs
      .filter((job) => job.id !== existingJob.id)
      .map((job) => job.id);

    if (duplicateJobIds.length > 0) {
      await prisma.syncJob.deleteMany({
        where: {
          id: { in: duplicateJobIds },
        },
      });
    }

    if (existingJob.status === "RUNNING") {
      return { id: existingJob.id };
    }

    return prisma.syncJob.update({
      where: { id: existingJob.id },
      data: {
        status: "QUEUED",
        attempts: 0,
        runAfter: now,
        lockedAt: null,
        finishedAt: null,
        error: null,
      },
      select: { id: true },
    });
  }

  return prisma.syncJob.create({
    data: {
      type: SYNC_JOB_TYPE,
      userId: null,
      mangaId,
      status: "QUEUED",
      runAfter: now,
    },
    select: { id: true },
  });
}

export async function enqueueMangaSyncJob(userId: string, mangaId: string) {
  await markUserMangaSyncing(userId, mangaId);
  return enqueueSharedMangaSyncJob(mangaId);
}

export async function enqueueUserLibrarySyncJobs(userId: string) {
  const library = await prisma.userManga.findMany({
    where: {
      userId,
      manga: {
        OR: [
          { status: null },
          { status: { not: "COMPLETED" } },
        ],
      },
    },
    select: { mangaId: true },
  });

  const jobs: SyncJobRef[] = [];
  for (const entry of library) {
    jobs.push(await enqueueMangaSyncJob(userId, entry.mangaId));
  }

  return {
    queued: library.length,
    jobs,
  };
}

export async function enqueueTrackedMangaSyncJobs() {
  const mangas = await prisma.manga.findMany({
    where: {
      userManga: { some: {} },
      OR: [
        { status: null },
        { status: { not: "COMPLETED" } },
      ],
    },
    select: { id: true },
  });

  const jobs: SyncJobRef[] = [];
  for (const manga of mangas) {
    jobs.push(await enqueueSharedMangaSyncJob(manga.id));
  }

  return {
    enqueued: mangas.length,
    jobs,
  };
}

async function claimSyncJob(jobId: string) {
  const result = await prisma.syncJob.updateMany({
    where: {
      id: jobId,
      status: "QUEUED",
      runAfter: { lte: new Date() },
    },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
      lockedAt: new Date(),
      error: null,
    },
  });

  return result.count > 0;
}

async function claimQueuedSyncJobs(limit: number) {
  return prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "SyncJob"
    SET
      "status" = 'RUNNING',
      "attempts" = "attempts" + 1,
      "lockedAt" = NOW(),
      "error" = NULL,
      "updatedAt" = NOW()
    WHERE "id" IN (
      SELECT "id"
      FROM "SyncJob"
      WHERE "type" = ${SYNC_JOB_TYPE}
        AND "status" = 'QUEUED'
        AND "runAfter" <= NOW()
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING "id"
  `;
}

async function markWaitingUsersUpdated(mangaId: string) {
  await prisma.userManga.updateMany({
    where: {
      mangaId,
      syncStatus: "SYNCING",
    },
    data: {
      syncStatus: "UPDATED",
      syncFinishedAt: new Date(),
      syncError: null,
    },
  });
}

async function markWaitingUsersFailed(mangaId: string, message: string) {
  await prisma.userManga.updateMany({
    where: {
      mangaId,
      syncStatus: "SYNCING",
    },
    data: {
      syncStatus: "FAILED",
      syncFinishedAt: new Date(),
      syncError: message,
    },
  });
}

async function markWaitingUsersRetrying(mangaId: string, message: string) {
  await prisma.userManga.updateMany({
    where: {
      mangaId,
      syncStatus: "SYNCING",
    },
    data: {
      syncFinishedAt: null,
      syncError: message,
    },
  });
}

async function runClaimedSyncJob(jobId: string) {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      mangaId: true,
      attempts: true,
      manga: { select: { status: true, title: true } },
    },
  });

  if (!job || job.status !== "RUNNING") {
    return { id: jobId, status: "skipped" as const };
  }

  if (job.manga.status === "COMPLETED") {
    await markWaitingUsersUpdated(job.mangaId);
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        lockedAt: null,
        error: null,
      },
    });

    return { id: job.id, status: "skipped" as const };
  }

  try {
    const result = await updateSingleManga(job.mangaId);
    if ("allSourcesFailed" in result && result.allSourcesFailed) {
      throw new Error(result.status);
    }

    await markWaitingUsersUpdated(job.mangaId);

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        lockedAt: null,
        error: null,
      },
    });

    return { id: job.id, status: "completed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown update error";
    const failedPermanently = job.attempts >= MAX_ATTEMPTS;

    if (failedPermanently) {
      await markWaitingUsersFailed(job.mangaId, message);
    } else {
      await markWaitingUsersRetrying(job.mangaId, message);
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: failedPermanently ? "FAILED" : "QUEUED",
        runAfter: new Date(Date.now() + Math.min(job.attempts, MAX_ATTEMPTS) * 60_000),
        lockedAt: null,
        finishedAt: failedPermanently ? new Date() : null,
        error: message,
      },
    });

    return { id: job.id, status: failedPermanently ? "failed" as const : "retrying" as const };
  }
}

export async function processSyncJob(jobId: string) {
  await recoverStaleRunningSyncJobs();

  const claimed = await claimSyncJob(jobId);
  if (!claimed) {
    return { id: jobId, status: "skipped" as const };
  }

  return runClaimedSyncJob(jobId);
}

export async function processSyncJobs(jobIds: string[], options: ProcessSyncJobsOptions = {}) {
  await recoverStaleRunningSyncJobs();

  const uniqueJobIds = [...new Set(jobIds)];
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const results = await runWithConcurrency(uniqueJobIds, concurrency, (jobId) => processSyncJob(jobId));
  const remaining = uniqueJobIds.length > 0 ? await prisma.syncJob.count({
    where: {
      id: { in: uniqueJobIds },
      type: SYNC_JOB_TYPE,
      status: "QUEUED",
      runAfter: { lte: new Date() },
    },
  }) : 0;

  return {
    processed: results.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    retrying: results.filter((result) => result.status === "retrying").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    remaining,
  };
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }));

  return results;
}

export async function processQueuedSyncJobs(options: ProcessQueuedSyncJobsOptions = {}) {
  await recoverStaleRunningSyncJobs();

  const limit = options.limit ?? DEFAULT_QUEUE_LIMIT;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const jobs = await claimQueuedSyncJobs(limit);
  const results = await runWithConcurrency(jobs, concurrency, (job) => runClaimedSyncJob(job.id));
  const remaining = await prisma.syncJob.count({
    where: {
      type: SYNC_JOB_TYPE,
      status: "QUEUED",
      runAfter: { lte: new Date() },
    },
  });

  return {
    processed: jobs.length,
    completed: results.filter((result) => result.status === "completed").length,
    failed: results.filter((result) => result.status === "failed").length,
    retrying: results.filter((result) => result.status === "retrying").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    remaining,
  };
}
