import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  userMangaUpdateMock,
  userMangaFindManyMock,
  userMangaUpdateManyMock,
  mangaFindManyMock,
  syncJobCreateMock,
  syncJobDeleteManyMock,
  syncJobFindUniqueMock,
  syncJobFindManyMock,
  syncJobUpdateManyMock,
  syncJobUpdateMock,
  syncJobCountMock,
  updateSingleMangaMock,
} = vi.hoisted(() => ({
  userMangaUpdateMock: vi.fn(),
  userMangaFindManyMock: vi.fn(),
  userMangaUpdateManyMock: vi.fn(),
  mangaFindManyMock: vi.fn(),
  syncJobCreateMock: vi.fn(),
  syncJobDeleteManyMock: vi.fn(),
  syncJobFindUniqueMock: vi.fn(),
  syncJobFindManyMock: vi.fn(),
  syncJobUpdateManyMock: vi.fn(),
  syncJobUpdateMock: vi.fn(),
  syncJobCountMock: vi.fn(),
  updateSingleMangaMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    userManga: {
      findMany: userMangaFindManyMock,
      update: userMangaUpdateMock,
      updateMany: userMangaUpdateManyMock,
    },
    manga: {
      findMany: mangaFindManyMock,
    },
    syncJob: {
      create: syncJobCreateMock,
      deleteMany: syncJobDeleteManyMock,
      findUnique: syncJobFindUniqueMock,
      findMany: syncJobFindManyMock,
      updateMany: syncJobUpdateManyMock,
      update: syncJobUpdateMock,
      count: syncJobCountMock,
    },
  },
}));

vi.mock("@/lib/manga-updater", () => ({
  updateSingleManga: updateSingleMangaMock,
}));

import {
  enqueueMangaSyncJob,
  enqueueUserLibrarySyncJobs,
  enqueueTrackedMangaSyncJobs,
  processSyncJobs,
  processSyncJob,
  recoverStaleRunningSyncJobs,
} from "@/lib/sync-jobs";

describe("enqueueMangaSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userMangaUpdateMock.mockResolvedValue({});
    userMangaFindManyMock.mockResolvedValue([]);
    userMangaUpdateManyMock.mockResolvedValue({ count: 0 });
    syncJobCreateMock.mockResolvedValue({ id: "created-job" });
    syncJobDeleteManyMock.mockResolvedValue({ count: 0 });
    syncJobUpdateManyMock.mockResolvedValue({ count: 1 });
    syncJobUpdateMock.mockResolvedValue({ id: "updated-job" });
    syncJobCountMock.mockResolvedValue(0);
    updateSingleMangaMock.mockResolvedValue({ manga: "Out", status: "No new chapters updates" });
  });

  it("creates a new job when no active job exists", async () => {
    syncJobFindManyMock.mockResolvedValue([]);

    const job = await enqueueMangaSyncJob("u1", "m1");

    expect(job).toEqual({ id: "created-job" });
    expect(syncJobFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: "MANGA_UPDATE",
        userId: null,
        mangaId: "m1",
        status: { in: ["QUEUED", "RUNNING"] },
      }),
    }));
    expect(syncJobCreateMock).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: "MANGA_UPDATE",
          userId: null,
          mangaId: "m1",
          status: "QUEUED",
      }),
    }));
  });

  it("excludes completed manga from the daily tracked-manga sweep", async () => {
    mangaFindManyMock.mockResolvedValue([{ id: "ongoing-manga" }]);
    syncJobFindManyMock.mockResolvedValue([]);

    const result = await enqueueTrackedMangaSyncJobs();

    expect(mangaFindManyMock).toHaveBeenCalledWith({
      where: {
        userManga: { some: {} },
        OR: [
          { status: null },
          { status: { not: "COMPLETED" } },
        ],
      },
      select: { id: true },
    });
    expect(result).toEqual({
      enqueued: 1,
      jobs: [{ id: "created-job" }],
    });
  });

  it("excludes completed manga from user library sync queueing", async () => {
    userMangaFindManyMock.mockResolvedValue([{ mangaId: "ongoing-manga" }]);
    syncJobFindManyMock.mockResolvedValue([]);

    const result = await enqueueUserLibrarySyncJobs("u1");

    expect(userMangaFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        manga: {
          OR: [
            { status: null },
            { status: { not: "COMPLETED" } },
          ],
        },
      },
      select: { mangaId: true },
    });
    expect(result).toEqual({
      queued: 1,
      jobs: [{ id: "created-job" }],
    });
  });

  it("requeues an existing active queued job instead of creating another active job", async () => {
    syncJobFindManyMock.mockResolvedValue([{ id: "queued-job", status: "QUEUED" }]);

    const job = await enqueueMangaSyncJob("u1", "m1");

    expect(job).toEqual({ id: "updated-job" });
    expect(syncJobUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "queued-job" },
      data: expect.objectContaining({
        status: "QUEUED",
        attempts: 0,
        lockedAt: null,
        finishedAt: null,
        error: null,
      }),
    }));
    expect(syncJobCreateMock).not.toHaveBeenCalled();
  });

  it("returns an existing running job and removes duplicate queued active jobs", async () => {
    syncJobFindManyMock.mockResolvedValue([
      { id: "queued-job", status: "QUEUED" },
      { id: "running-job", status: "RUNNING" },
    ]);

    const job = await enqueueMangaSyncJob("u1", "m1");

    expect(job).toEqual({ id: "running-job" });
    expect(syncJobDeleteManyMock).toHaveBeenCalledWith({
      where: { id: { in: ["queued-job"] } },
    });
    expect(syncJobUpdateMock).not.toHaveBeenCalled();
    expect(syncJobCreateMock).not.toHaveBeenCalled();
  });

  it("requeues stale running shared jobs so future workers can retry them", async () => {
    syncJobUpdateManyMock.mockResolvedValueOnce({ count: 2 });

    const result = await recoverStaleRunningSyncJobs({ staleAfterMs: 10 * 60_000 });

    expect(result).toEqual({ count: 2 });
    expect(syncJobUpdateManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: "MANGA_UPDATE",
        status: "RUNNING",
        lockedAt: expect.objectContaining({
          lt: expect.any(Date),
        }),
      }),
      data: expect.objectContaining({
        status: "QUEUED",
        lockedAt: null,
        error: "Previous sync worker timed out before completion",
      }),
    }));
  });

  it("keeps a sync job queued for retry when every source fails", async () => {
    syncJobFindUniqueMock.mockResolvedValue({
      id: "job1",
      status: "RUNNING",
      mangaId: "m1",
      attempts: 1,
      manga: { status: "ONGOING", title: "Out" },
    });
    updateSingleMangaMock.mockResolvedValue({
      manga: "Out",
      status: "All sources failed: blocked",
      failedSources: 1,
      allSourcesFailed: true,
    });

    await processSyncJob("job1");

    expect(userMangaUpdateManyMock).toHaveBeenLastCalledWith(expect.objectContaining({
      where: {
        mangaId: "m1",
        syncStatus: "SYNCING",
      },
      data: expect.objectContaining({
        syncFinishedAt: null,
        syncError: "All sources failed: blocked",
      }),
    }));
    expect(syncJobUpdateMock).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "job1" },
      data: expect.objectContaining({
        status: "QUEUED",
        error: "All sources failed: blocked",
      }),
    }));
  });

  it("processes a targeted list of sync jobs and reports the outcome", async () => {
    syncJobFindUniqueMock
      .mockResolvedValueOnce({
        id: "job1",
        status: "RUNNING",
        mangaId: "m1",
        attempts: 1,
        manga: { status: "ONGOING", title: "Out" },
      })
      .mockResolvedValueOnce({
        id: "job2",
        status: "RUNNING",
        mangaId: "m2",
        attempts: 1,
        manga: { status: "COMPLETED", title: "Finished" },
      });
    updateSingleMangaMock.mockResolvedValue({ manga: "Out", status: "No new chapters updates" });

    const result = await processSyncJobs(["job1", "job1", "job2"], { concurrency: 1 });

    expect(result).toEqual({
      processed: 2,
      completed: 1,
      failed: 0,
      retrying: 0,
      skipped: 1,
      remaining: 0,
    });
    expect(syncJobUpdateManyMock).toHaveBeenCalled();
    expect(syncJobCountMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["job1", "job2"] },
        type: "MANGA_UPDATE",
        status: "QUEUED",
        runAfter: { lte: expect.any(Date) },
      },
    });
  });

  it("finishes already-queued completed manga jobs without scraping them", async () => {
    syncJobFindUniqueMock.mockResolvedValue({
      id: "job1",
      status: "RUNNING",
      mangaId: "m1",
      attempts: 1,
      manga: { status: "COMPLETED", title: "Finished" },
    });

    const result = await processSyncJob("job1");

    expect(result).toEqual({ id: "job1", status: "skipped" });
    expect(updateSingleMangaMock).not.toHaveBeenCalled();
    expect(userMangaUpdateManyMock).toHaveBeenLastCalledWith(expect.objectContaining({
      where: {
        mangaId: "m1",
        syncStatus: "SYNCING",
      },
      data: expect.objectContaining({
        syncStatus: "UPDATED",
        syncError: null,
      }),
    }));
    expect(syncJobUpdateMock).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: "job1" },
      data: expect.objectContaining({
        status: "DONE",
        lockedAt: null,
        error: null,
      }),
    }));
  });
});
