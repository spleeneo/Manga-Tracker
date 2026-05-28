import { prisma } from "@/lib/db";
import { checkForUpdates } from "@/lib/manga-updater";

const SYNC_JOB_TYPE = "MANGA_UPDATE";
const MAX_ATTEMPTS = 3;

export async function enqueueMangaSyncJob(userId: string, mangaId: string) {
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

  const existingJobs = await prisma.syncJob.findMany({
    where: {
      type: SYNC_JOB_TYPE,
      userId,
      mangaId,
    },
    select: {
      id: true,
      status: true,
    },
    orderBy: [
      { status: "asc" },
      { updatedAt: "desc" },
    ],
  });

  const runningJob = existingJobs.find((job) => job.status === "RUNNING");
  const existingJob = runningJob ?? existingJobs[0];

  if (existingJob) {
    const duplicateJobIds = existingJobs
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
      userId,
      mangaId,
      status: "QUEUED",
      runAfter: now,
    },
    select: { id: true },
  });
}

export async function processSyncJob(jobId: string) {
  const job = await prisma.syncJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      userId: true,
      mangaId: true,
      attempts: true,
      manga: { select: { title: true } },
    },
  });

  if (!job || job.status === "DONE" || job.status === "RUNNING") return;

  await prisma.syncJob.update({
    where: { id: job.id },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
      lockedAt: new Date(),
      error: null,
    },
  });

  try {
    await checkForUpdates(job.mangaId);

    if (job.userId) {
      await prisma.userManga.update({
        where: {
          userId_mangaId: {
            userId: job.userId,
            mangaId: job.mangaId,
          },
        },
        data: {
          syncStatus: "UPDATED",
          syncFinishedAt: new Date(),
          syncError: null,
        },
      });
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        lockedAt: null,
        error: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown update error";
    const nextAttempts = job.attempts + 1;
    const failedPermanently = nextAttempts >= MAX_ATTEMPTS;

    if (job.userId) {
      await prisma.userManga.update({
        where: {
          userId_mangaId: {
            userId: job.userId,
            mangaId: job.mangaId,
          },
        },
        data: {
          syncStatus: failedPermanently ? "FAILED" : "SYNCING",
          syncFinishedAt: failedPermanently ? new Date() : null,
          syncError: message,
        },
      });
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: failedPermanently ? "FAILED" : "QUEUED",
        runAfter: new Date(Date.now() + Math.min(nextAttempts, MAX_ATTEMPTS) * 60_000),
        lockedAt: null,
        finishedAt: failedPermanently ? new Date() : null,
        error: message,
      },
    });
  }
}

export async function processQueuedSyncJobs(limit = 5) {
  const jobs = await prisma.syncJob.findMany({
    where: {
      status: "QUEUED",
      runAfter: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const job of jobs) {
    await processSyncJob(job.id);
  }

  return jobs.length;
}
