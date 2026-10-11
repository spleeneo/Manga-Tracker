import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchScrapersDetailed } = vi.hoisted(() => ({
  searchScrapersDetailed: vi.fn(),
}));

const { getCurrentUserId, getChildPolicy, getExploreManga } = vi.hoisted(() => ({ getCurrentUserId: vi.fn(), getChildPolicy: vi.fn(), getExploreManga: vi.fn() }));

vi.mock("@/lib/scrapers/registry", () => ({
  searchScrapersDetailed,
}));
vi.mock("@/lib/db", () => ({ prisma: { userManga: { findMany: vi.fn().mockResolvedValue([]) } } }));
vi.mock("@/lib/session", () => ({ getCurrentUserId }));
vi.mock("@/lib/parental-controls", () => ({ getChildPolicy }));
vi.mock("@/lib/explore/mangadex", () => ({ getExploreManga }));

import { GET } from "@/app/api/manga/search/route";
import { prisma } from "@/lib/db";

function mockNextRequest(url: string) {
  const parsed = new URL(url);
  return {
    nextUrl: parsed,
  } as never;
}

describe("GET /api/manga/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserId.mockResolvedValue("u1");
    getChildPolicy.mockResolvedValue(null);
    vi.mocked(prisma.userManga.findMany).mockResolvedValue([]);
  });

  it("returns empty results when q is missing", async () => {
    const req = mockNextRequest("http://localhost/api/manga/search");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ results: [] });
  });

  it("returns scraper results when query exists", async () => {
    searchScrapersDetailed.mockResolvedValue({ results: [{ title: "One Piece", sources: [] }], failedProviders: [], allFailed: false });
    const req = mockNextRequest("http://localhost/api/manga/search?q=one+piece");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
  });

  it("does not cache partial failures and returns usable results", async () => {
    searchScrapersDetailed.mockResolvedValue({ results: [{ title: "Partial", sources: [] }], failedProviders: ["MangaDex"], allFailed: false });
    const req = mockNextRequest("http://localhost/api/manga/search?q=partial-regression");
    expect(await (await GET(req)).json()).toMatchObject({ results: [{ title: "Partial" }], failedProviders: ["MangaDex"] });
    await GET(req);
    expect(searchScrapersDetailed).toHaveBeenCalledTimes(2);
  });

  it("returns service-unavailable for all-provider failure", async () => {
    searchScrapersDetailed.mockResolvedValue({ results: [], failedProviders: ["MangaDex"], allFailed: true });
    expect((await GET(mockNextRequest("http://localhost/api/manga/search?q=all-failed"))).status).toBe(503);
  });

  it("decorates cached results separately for each account", async () => {
    searchScrapersDetailed.mockResolvedValue({ results: [{ title: "Shared", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/shared" }] }], failedProviders: [], allFailed: false });
    vi.mocked(prisma.userManga.findMany).mockResolvedValueOnce([{ manga: { slug: "my-title", sources: [{ sourceUrl: "https://mangadex.org/title/shared/optional-slug" }] } }] as never).mockResolvedValueOnce([]);
    const req = mockNextRequest("http://localhost/api/manga/search?q=cache-privacy");
    expect((await (await GET(req)).json()).results[0]).toMatchObject({ isTracked: true, librarySlug: "my-title" });
    getCurrentUserId.mockResolvedValue("u2");
    expect((await (await GET(req)).json()).results[0].isTracked).toBe(false);
    expect(searchScrapersDetailed).toHaveBeenCalledTimes(1);
  });

  it("returns policy-filtered MangaDex search results to child accounts", async () => {
    getChildPolicy.mockResolvedValue({ enabled: true, allowedContentRatings: ["safe"], blockedTagNames: ["gore"] });
    getExploreManga.mockResolvedValue({ results: [{ id: "12345678-1234-1234-1234-123456789abc",
      title: "Naruto", description: "Ninja manga", status: "COMPLETED",
      coverUrl: "https://uploads.mangadex.org/covers/12345678-1234-1234-1234-123456789abc/cover.jpg.256.jpg",
      contentRating: "safe", tags: [{ id: "tag-1", name: "Action" }],
      source: { name: "MangaDex", url: "https://mangadex.org/title/naruto" },
    }], nextOffset: null });
    const res = await GET(mockNextRequest("http://localhost/api/manga/search?q=one+piece"));
    expect(await res.json()).toEqual({ results: [{
      title: "Naruto", description: "Ninja manga", status: "COMPLETED",
      coverUrl: "/api/manga/catalog/12345678-1234-1234-1234-123456789abc/cover?file=cover.jpg.256.jpg",
      contentRating: "safe", tags: [{ id: "tag-1", name: "Action" }],
      sources: [{ name: "Mangateo", url: "mangateo:catalog:12345678-1234-1234-1234-123456789abc" }],
    }] });
    expect(getExploreManga).toHaveBeenCalledWith("u1", { q: "one piece", limit: "24", sort: "trending" });
    expect(searchScrapersDetailed).not.toHaveBeenCalled();
  });

  it("returns 500 when scraper search fails", async () => {
    searchScrapersDetailed.mockRejectedValue(new Error("search failed"));
    const req = mockNextRequest("http://localhost/api/manga/search?q=error");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
