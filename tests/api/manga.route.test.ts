import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkForUpdatesMock, mangaFindUnique, mangaCreate, mangaFindUniqueById, sourceCreate, sourceFindUnique, userMangaUpsert } = vi.hoisted(() => ({
  checkForUpdatesMock: vi.fn(),
  mangaFindUnique: vi.fn(),
  mangaCreate: vi.fn(),
  mangaFindUniqueById: vi.fn(),
  sourceCreate: vi.fn(),
  sourceFindUnique: vi.fn(),
  userMangaUpsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: {
      findUnique: (...args: unknown[]) => {
        const [query] = args as [{ where: { slug?: string; id?: string } }];
        if (query?.where?.id) return mangaFindUniqueById(...args);
        return mangaFindUnique(...args);
      },
      create: mangaCreate,
    },
    source: {
      findUnique: sourceFindUnique,
      create: sourceCreate,
    },
    userManga: {
      upsert: userMangaUpsert,
    },
  },
}));

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
    mangaFindUniqueById.mockResolvedValue({ id: "m1", title: "One Piece", sources: [] });

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
    mangaFindUniqueById.mockResolvedValue({ id: "m1", title: "One Piece", sources: [{ id: "s1" }] });

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
    expect(checkForUpdatesMock).toHaveBeenCalledWith("m1");
  });
});
