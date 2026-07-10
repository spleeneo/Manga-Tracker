import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  afterMock,
  enqueueMangaSyncJobMock,
  fetchMetadataMock,
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  mangaUpdateMock,
  processSyncJobMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  afterMock: vi.fn(),
  enqueueMangaSyncJobMock: vi.fn(),
  fetchMetadataMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  mangaUpdateMock: vi.fn(),
  processSyncJobMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/sync-jobs", () => ({
  enqueueMangaSyncJob: enqueueMangaSyncJobMock,
  processSyncJob: processSyncJobMock,
}));

vi.mock("@/lib/scrapers/registry", () => ({
  fetchMetadata: fetchMetadataMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: {
      findUnique: mangaFindUniqueMock,
      update: mangaUpdateMock,
    },
    userManga: {
      findUnique: userMangaFindUniqueMock,
    },
  },
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: afterMock,
  };
});

import { POST as checkUpdates } from "@/app/api/manga/[slug]/check-updates/route";
import { GET as getManga } from "@/app/api/manga/get/route";
import { POST as refreshMetadata } from "@/app/api/manga/[slug]/refresh-metadata/route";

describe("owned manga API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    enqueueMangaSyncJobMock.mockResolvedValue({ id: "job1" });
    processSyncJobMock.mockResolvedValue({ id: "job1", status: "completed" });
  });

  it("requires ownership before checking updates", async () => {
    mangaFindUniqueMock.mockResolvedValue({ id: "m1", slug: "one-piece" });
    userMangaFindUniqueMock.mockResolvedValue(null);

    const res = await checkUpdates(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(403);
    expect(enqueueMangaSyncJobMock).not.toHaveBeenCalled();
  });

  it("queues updates for tracked manga", async () => {
    mangaFindUniqueMock.mockResolvedValue({ id: "m1", slug: "one-piece" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });

    const res = await checkUpdates(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.queued).toBe(1);
    expect(body.jobStatus).toBe("completed");
    expect(enqueueMangaSyncJobMock).toHaveBeenCalledWith("u1", "m1");
    expect(processSyncJobMock).toHaveBeenCalledWith("job1");
    expect(afterMock).toHaveBeenCalledOnce();
  });

  it("requires ownership before returning manga data", async () => {
    mangaFindUniqueMock.mockResolvedValue({ id: "m1", chapters: [], sources: [] });
    userMangaFindUniqueMock.mockResolvedValue(null);

    const req = { nextUrl: new URL("http://localhost/api/manga/get?slug=one-piece") };
    const res = await getManga(req as never);

    expect(res.status).toBe(403);
  });

  it("returns progress-derived read state for tracked manga data", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      chapters: [
        { id: "c1", chapterNumber: 1 },
        { id: "c2", chapterNumber: 2 },
      ],
      sources: [],
    });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1", lastReadChapterNumber: 1 });

    const req = { nextUrl: new URL("http://localhost/api/manga/get?slug=one-piece") };
    const res = await getManga(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapters).toEqual([
      expect.objectContaining({ id: "c1", isRead: true }),
      expect.objectContaining({ id: "c2", isRead: false }),
    ]);
  });

  it("requires ownership before refreshing metadata", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      sources: [{ sourceUrl: "https://example.com", sourceName: "Source" }],
    });
    userMangaFindUniqueMock.mockResolvedValue(null);

    const res = await refreshMetadata(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(403);
    expect(fetchMetadataMock).not.toHaveBeenCalled();
  });
});
