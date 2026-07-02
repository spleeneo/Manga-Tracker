import { beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock, enqueueMangaSyncJobMock, processSyncJobMock, mangaFindUnique, mangaFindFirst, mangaCreate, mangaUpdate, sourceCreate, sourceFindUnique, sourceFindFirst, userMangaUpsert, userMangaUpdate } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  enqueueMangaSyncJobMock: vi.fn(),
  processSyncJobMock: vi.fn(),
  mangaFindUnique: vi.fn(),
  mangaFindFirst: vi.fn(),
  mangaCreate: vi.fn(),
  mangaUpdate: vi.fn(),
  sourceCreate: vi.fn(),
  sourceFindUnique: vi.fn(),
  sourceFindFirst: vi.fn(),
  userMangaUpsert: vi.fn(),
  userMangaUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: {
      findUnique: mangaFindUnique,
      findFirst: mangaFindFirst,
      create: mangaCreate,
      update: mangaUpdate,
    },
    source: {
      findUnique: sourceFindUnique,
      findFirst: sourceFindFirst,
      create: sourceCreate,
    },
    userManga: {
      upsert: userMangaUpsert,
      update: userMangaUpdate,
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

vi.mock("@/lib/scrapers/registry", () => ({
  fetchMetadata: vi.fn(),
}));
vi.mock("@/lib/content-classification", () => ({ refreshMangaClassification: vi.fn() }));

vi.mock("@/lib/sync-jobs", () => ({
  enqueueMangaSyncJob: enqueueMangaSyncJobMock,
  processSyncJob: processSyncJobMock,
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => "u1"),
}));

import { POST } from "@/app/api/manga/route";

describe("POST /api/manga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mangaFindFirst.mockResolvedValue(null);
    sourceFindFirst.mockResolvedValue(null);
  });

  it("returns 400 when title and slug are missing", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates manga when valid payload has no sources", async () => {
    mangaFindUnique.mockResolvedValue(null);
    mangaCreate.mockResolvedValue({ id: "m1" });
    userMangaUpsert.mockResolvedValue({ id: "um1" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ title: "One Piece", slug: "one-piece", sources: [] }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mangaCreate).toHaveBeenCalledOnce();
  });

  it("fetches chapters after adding a source during tracking", async () => {
    mangaFindUnique.mockResolvedValue(null);
    mangaCreate.mockResolvedValue({ id: "m1" });
    userMangaUpsert.mockResolvedValue({ id: "um1" });
    sourceFindUnique.mockResolvedValue(null);
    sourceCreate.mockResolvedValue({ id: "s1" });
    enqueueMangaSyncJobMock.mockResolvedValue({ id: "job1" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        title: "One Piece",
        slug: "one-piece",
        sources: [{ name: "MangaDex", url: "https://mangadex.org/title/x" }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(sourceCreate).toHaveBeenCalledOnce();
    expect(enqueueMangaSyncJobMock).toHaveBeenCalledWith("u1", "m1");
    expect(afterMock).toHaveBeenCalledOnce();
    expect(processSyncJobMock).not.toHaveBeenCalled();
    expect(userMangaUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ syncStatus: "SYNCING" }),
      create: expect.objectContaining({ syncStatus: "SYNCING" }),
    }));
  });

  it("attaches an already cached manga without scheduling another scrape", async () => {
    mangaFindUnique.mockResolvedValue({ id: "m1", _count: { chapters: 42 } });
    userMangaUpsert.mockResolvedValue({ id: "um1" });
    sourceFindUnique.mockResolvedValue({ id: "s1" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        title: "One Piece",
        slug: "one-piece",
        sources: [{ name: "MangaDex", url: "https://mangadex.org/title/x" }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.syncStatus).toBe("UPDATED");
    expect(mangaCreate).not.toHaveBeenCalled();
    expect(sourceCreate).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
    expect(userMangaUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ syncStatus: "UPDATED" }),
      create: expect.objectContaining({ syncStatus: "UPDATED" }),
    }));
  });

  it("reuses known title aliases instead of creating duplicate manga", async () => {
    mangaFindUnique.mockResolvedValue(null);
    mangaFindFirst.mockResolvedValue({ id: "m1", _count: { chapters: 12 } });
    mangaUpdate.mockResolvedValue({ id: "m1", _count: { chapters: 12 } });
    userMangaUpsert.mockResolvedValue({ id: "um1" });
    sourceFindUnique.mockResolvedValue({ id: "s1" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        title: "Witch Hat Atelier",
        slug: "witch-hat-atelier",
        sources: [{ name: "MangaDex", url: "https://mangadex.org/title/x" }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.slug).toBe("witch-hat-atelier");
    expect(mangaFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: { in: expect.arrayContaining(["tongari-boushi-no-atelier"]) },
      }),
    }));
    expect(mangaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "m1" },
      data: { title: "Witch Hat Atelier", slug: "witch-hat-atelier" },
    }));
    expect(mangaCreate).not.toHaveBeenCalled();
  });

  it("reuses After the Rain aliases instead of creating duplicate manga", async () => {
    mangaFindUnique.mockResolvedValue(null);
    mangaFindFirst.mockResolvedValue({ id: "m1", _count: { chapters: 12 } });
    mangaUpdate.mockResolvedValue({ id: "m1", _count: { chapters: 12 } });
    userMangaUpsert.mockResolvedValue({ id: "um1" });
    sourceFindUnique.mockResolvedValue({ id: "s1" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        title: "Koi wa Ameagari no You ni",
        slug: "koi-wa-ameagari-no-you-ni",
        sources: [{ name: "MangaDex", url: "https://mangadex.org/title/after-rain" }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.slug).toBe("after-the-rain");
    expect(mangaFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: { in: expect.arrayContaining(["koi-wa-ameagari-no-you-ni"]) },
      }),
    }));
    expect(mangaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "m1" },
      data: { title: "After the Rain", slug: "after-the-rain" },
    }));
    expect(mangaCreate).not.toHaveBeenCalled();
  });

  it("reuses existing manga when any incoming source URL is already tracked", async () => {
    mangaFindUnique.mockResolvedValue(null);
    sourceFindFirst.mockResolvedValue({
      manga: {
        id: "m-existing",
        title: "Existing Canonical Title",
        slug: "existing-canonical-title",
        coverUrl: "cover",
        status: "ONGOING",
        description: "Existing description",
        _count: { chapters: 22 },
      },
    });
    sourceFindUnique.mockResolvedValue({ id: "s1" });
    userMangaUpsert.mockResolvedValue({ id: "um1" });

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        title: "Alternate Language Title",
        slug: "alternate-language-title",
        sources: [{ name: "MangaDex", url: "https://mangadex.org/title/existing" }],
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(expect.objectContaining({
      id: "m-existing",
      title: "Existing Canonical Title",
      slug: "existing-canonical-title",
      syncStatus: "UPDATED",
    }));
    expect(sourceFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { sourceUrl: { in: ["https://mangadex.org/title/existing"] } },
    }));
    expect(mangaCreate).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });
});
