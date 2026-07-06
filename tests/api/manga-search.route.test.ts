import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchScrapers } = vi.hoisted(() => ({
  searchScrapers: vi.fn(),
}));

const { getCurrentUserId, getChildPolicy, getExploreManga } = vi.hoisted(() => ({ getCurrentUserId: vi.fn(), getChildPolicy: vi.fn(), getExploreManga: vi.fn() }));

vi.mock("@/lib/scrapers/registry", () => ({
  searchScrapers,
}));
vi.mock("@/lib/session", () => ({ getCurrentUserId }));
vi.mock("@/lib/parental-controls", () => ({ getChildPolicy }));
vi.mock("@/lib/explore/mangadex", () => ({ getExploreManga }));

import { GET } from "@/app/api/manga/search/route";

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
  });

  it("returns empty results when q is missing", async () => {
    const req = mockNextRequest("http://localhost/api/manga/search");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ results: [] });
  });

  it("returns scraper results when query exists", async () => {
    searchScrapers.mockResolvedValue([{ title: "One Piece", sources: [] }]);
    const req = mockNextRequest("http://localhost/api/manga/search?q=one+piece");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
  });

  it("returns policy-filtered MangaDex search results to child accounts", async () => {
    getChildPolicy.mockResolvedValue({ enabled: true, allowedContentRatings: ["safe"], blockedTagNames: ["gore"] });
    getExploreManga.mockResolvedValue({ results: [{
      title: "Naruto", description: "Ninja manga", coverUrl: "cover.jpg", status: "COMPLETED",
      contentRating: "safe", classificationSource: "MANGADEX", tags: [{ id: "tag-1", name: "Action" }],
      source: { name: "MangaDex", url: "https://mangadex.org/title/naruto" },
    }], nextOffset: null });
    const res = await GET(mockNextRequest("http://localhost/api/manga/search?q=one+piece"));
    expect(await res.json()).toEqual({ results: [{
      title: "Naruto", description: "Ninja manga", coverUrl: "cover.jpg", status: "COMPLETED",
      contentRating: "safe", classificationSource: "MANGADEX", tags: [{ id: "tag-1", name: "Action" }],
      sources: [{ name: "MangaDex", url: "https://mangadex.org/title/naruto" }],
    }] });
    expect(getExploreManga).toHaveBeenCalledWith("u1", { q: "one piece", limit: "24", sort: "trending" });
    expect(searchScrapers).not.toHaveBeenCalled();
  });

  it("returns 500 when scraper search fails", async () => {
    searchScrapers.mockRejectedValue(new Error("search failed"));
    const req = mockNextRequest("http://localhost/api/manga/search?q=error");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
