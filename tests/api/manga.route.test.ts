import { beforeEach, describe, expect, it, vi } from "vitest";

const { afterMock, checkForUpdatesMock, mangaFindUnique, mangaCreate, sourceCreate, sourceFindUnique, userMangaUpsert, userMangaUpdate } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  checkForUpdatesMock: vi.fn(),
  mangaFindUnique: vi.fn(),
  mangaCreate: vi.fn(),
  sourceCreate: vi.fn(),
  sourceFindUnique: vi.fn(),
  userMangaUpsert: vi.fn(),
  userMangaUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: {
      findUnique: mangaFindUnique,
      create: mangaCreate,
    },
    source: {
      findUnique: sourceFindUnique,
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

vi.mock("@/lib/manga-updater", () => ({
  checkForUpdates: checkForUpdatesMock,
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: vi.fn(async () => "u1"),
}));

import { POST } from "@/app/api/manga/route";

describe("POST /api/manga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    checkForUpdatesMock.mockResolvedValue([{ status: "Added 1 new chapter" }]);

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
    expect(afterMock).toHaveBeenCalledOnce();
    expect(checkForUpdatesMock).not.toHaveBeenCalled();
    expect(userMangaUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ syncStatus: "SYNCING" }),
      create: expect.objectContaining({ syncStatus: "SYNCING" }),
    }));
  });
});
