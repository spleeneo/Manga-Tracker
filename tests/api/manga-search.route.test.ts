import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchScrapers } = vi.hoisted(() => ({
  searchScrapers: vi.fn(),
}));

const { getCurrentUserId, getChildPolicy } = vi.hoisted(() => ({ getCurrentUserId: vi.fn(), getChildPolicy: vi.fn() }));

vi.mock("@/lib/scrapers/registry", () => ({
  searchScrapers,
}));
vi.mock("@/lib/session", () => ({ getCurrentUserId }));
vi.mock("@/lib/parental-controls", () => ({ getChildPolicy }));

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

  it("does not expose unclassified provider search to child accounts", async () => {
    getChildPolicy.mockResolvedValue({ enabled: true, allowedContentRatings: ["safe"], blockedTagNames: ["gore"] });
    const res = await GET(mockNextRequest("http://localhost/api/manga/search?q=one+piece"));
    expect(await res.json()).toEqual({ results: [] });
    expect(searchScrapers).not.toHaveBeenCalled();
  });

  it("returns 500 when scraper search fails", async () => {
    searchScrapers.mockRejectedValue(new Error("search failed"));
    const req = mockNextRequest("http://localhost/api/manga/search?q=error");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
