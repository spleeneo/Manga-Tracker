import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserIdMock, sourceFindManyMock } = vi.hoisted(() => ({
  getCurrentUserIdMock: vi.fn(),
  sourceFindManyMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    source: {
      findMany: sourceFindManyMock,
    },
  },
}));

import { GET as exploreGET } from "@/app/api/explore/route";
import { GET as tagsGET } from "@/app/api/explore/tags/route";

function mockNextRequest(url: string) {
  return {
    nextUrl: new URL(url),
  } as never;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as never;
}

describe("GET /api/explore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    sourceFindManyMock.mockResolvedValue([]);
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      data: [
        {
          id: "md1",
          attributes: {
            title: { en: "One Piece" },
            description: { en: "Pirates\nMore text" },
            status: "ongoing",
            year: 1997,
            tags: [
              { id: "tag1", attributes: { name: { en: "Action" }, group: "genre" } },
            ],
          },
          relationships: [
            { id: "cover1", type: "cover_art", attributes: { fileName: "cover.jpg" } },
          ],
        },
      ],
      limit: 24,
      offset: 0,
      total: 30,
    })) as never;
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);
    const res = await exploreGET(mockNextRequest("http://localhost/api/explore"));

    expect(res.status).toBe(401);
  });

  it("returns compact discover results and tracked state", async () => {
    sourceFindManyMock.mockResolvedValue([{ sourceUrl: "https://mangadex.org/title/md1" }]);

    const res = await exploreGET(mockNextRequest("http://localhost/api/explore?sort=trending"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({
        id: "md1",
        title: "One Piece",
        slug: "one-piece",
        coverUrl: "https://uploads.mangadex.org/covers/md1/cover.jpg.256.jpg",
        isTracked: true,
      }),
    ]);
    expect(body.nextOffset).toBe(24);
  });

  it("maps sort modes and caps limit", async () => {
    const res = await exploreGET(mockNextRequest("http://localhost/api/explore?sort=updated&limit=200&includedTags=tag1&publicationDemographic=shounen&status=ongoing&contentRating=erotica,pornographic"));

    expect(res.status).toBe(200);
    const calledUrl = String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl).toContain("limit=48");
    expect(calledUrl).toContain("order%5BlatestUploadedChapter%5D=desc");
    expect(calledUrl).toContain("includedTags%5B%5D=tag1");
    expect(calledUrl).toContain("publicationDemographic%5B%5D=shounen");
    expect(calledUrl).toContain("status%5B%5D=ongoing");
    expect(calledUrl).toContain("contentRating%5B%5D=erotica");
    expect(calledUrl).toContain("contentRating%5B%5D=pornographic");
    expect(calledUrl).not.toContain("contentRating%5B%5D=safe");
  });

  it("returns a readable error when MangaDex fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({}, false, 500)) as never;
    const res = await exploreGET(mockNextRequest("http://localhost/api/explore?q=bad"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Failed to load explore results");
  });
});

describe("GET /api/explore/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({
      data: [
        { id: "tag1", attributes: { name: { en: "Action" }, group: "genre" } },
      ],
    })) as never;
  });

  it("returns tags for signed-in users", async () => {
    const res = await tagsGET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tags).toEqual([{ id: "tag1", name: "Action", group: "genre" }]);
  });
});
