import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteUserMangaMock,
  getLibraryMangaSummariesMock,
  getCurrentUserIdMock,
  mangaFindUniqueMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  deleteUserMangaMock: vi.fn(),
  getLibraryMangaSummariesMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));

vi.mock("@/lib/library-summary", () => ({
  getLibraryMangaSummaries: getLibraryMangaSummariesMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    manga: {
      findUnique: mangaFindUniqueMock,
    },
    userManga: {
      delete: deleteUserMangaMock,
      findUnique: userMangaFindUniqueMock,
    },
  },
}));

import { DELETE } from "@/app/api/manga/[slug]/library/route";
import { GET } from "@/app/api/manga/library/route";

describe("GET /api/manga/library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    getLibraryMangaSummariesMock.mockResolvedValue([{ id: "m1", slug: "one-piece" }]);
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(getLibraryMangaSummariesMock).not.toHaveBeenCalled();
  });

  it("returns compact summaries for the signed-in user", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mangas).toEqual([{ id: "m1", slug: "one-piece" }]);
    expect(getLibraryMangaSummariesMock).toHaveBeenCalledWith("u1");
  });
});

describe("DELETE /api/manga/[slug]/library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    mangaFindUniqueMock.mockResolvedValue({ id: "m1" });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1" });
    deleteUserMangaMock.mockResolvedValue({ id: "um1" });
  });

  it("requires authentication", async () => {
    getCurrentUserIdMock.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(401);
    expect(deleteUserMangaMock).not.toHaveBeenCalled();
  });

  it("removes only the signed-in user's library entry", async () => {
    const res = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteUserMangaMock).toHaveBeenCalledWith({
      where: {
        userId_mangaId: {
          userId: "u1",
          mangaId: "m1",
        },
      },
    });
  });

  it("returns 404 when manga is not tracked", async () => {
    userMangaFindUniqueMock.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost") as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(404);
    expect(deleteUserMangaMock).not.toHaveBeenCalled();
  });
});
