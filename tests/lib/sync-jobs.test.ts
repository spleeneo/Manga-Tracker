import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  userMangaUpdateMock,
  userMangaUpdateManyMock,
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
  userMangaUpdateManyMock: vi.fn(),
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
      update: userMangaUpdateMock,
      updateMany: userMangaUpdateManyMock,
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

import { enqueueMangaSyncJob, processSyncJob } from "@/lib/sync-jobs";

describe("enqueueMangaSyncJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userMangaUpdateMock.mockResolvedValue({});
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

  it("keeps a sync job queued for retry when every source fails", async () => {
    syncJobFindUniqueMock.mockResolvedValue({
      id: "job1",
      status: "RUNNING",
      mangaId: "m1",
      attempts: 1,
      manga: { title: "Out" },
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
});
