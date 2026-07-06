import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  chapterFindFirstMock,
  chapterFindManyMock,
  getCurrentUserIdMock,
  getMangaAccessMock,
  mangaFindUniqueMock,
  sourceFindFirstMock,
  userMangaFindUniqueMock,
} = vi.hoisted(() => ({
  chapterFindFirstMock: vi.fn(),
  chapterFindManyMock: vi.fn(),
  getCurrentUserIdMock: vi.fn(),
  getMangaAccessMock: vi.fn(),
  mangaFindUniqueMock: vi.fn(),
  sourceFindFirstMock: vi.fn(),
  userMangaFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentUserId: getCurrentUserIdMock,
}));
vi.mock("@/lib/parental-controls", () => ({ getMangaAccess: getMangaAccessMock, parentalControlError: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    chapter: { findFirst: chapterFindFirstMock, findMany: chapterFindManyMock },
    manga: { findUnique: mangaFindUniqueMock },
    source: { findFirst: sourceFindFirstMock },
    userManga: { findUnique: userMangaFindUniqueMock },
  },
}));

import { GET } from "@/app/api/manga/[slug]/chapters/route";

describe("GET /api/manga/[slug]/chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("u1");
    getMangaAccessMock.mockResolvedValue({ allowed: true, isChild: false, reason: "allowed" });
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      title: "One Piece",
      sources: [{ id: "s1", sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" }],
    });
    userMangaFindUniqueMock.mockResolvedValue({ id: "um1", lastReadChapterNumber: 1, disabledSources: [], sourcePreferences: [] });
    sourceFindFirstMock.mockResolvedValue({ id: "s1" });
  });

  it("returns only anonymized Mangateo-readable chapters to children", async () => {
    getMangaAccessMock.mockResolvedValue({ allowed: true, isChild: true, reason: "allowed" });
    chapterFindManyMock.mockResolvedValue([
      { id: "c1", chapterNumber: 2, title: "Two", url: "https://provider.example/c1", releaseDate: null, sourceId: "s1", readerStatus: "READABLE", source: { sourceName: "Secret Provider" } },
    ]);
    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters") };
    const res = await GET(req as never, { params: Promise.resolve({ slug: "one-piece" }) });
    const body = await res.json();
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ readerStatus: "READABLE" }) }));
    expect(body.chapters[0]).toEqual(expect.objectContaining({ url: "/manga/one-piece/chapter/c1", sourceId: null }));
    expect(body.chapters[0].sourceName).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("provider.example");
    expect(JSON.stringify(body)).not.toContain("Secret Provider");
  });

  it("requires ownership before returning chapter pages", async () => {
    userMangaFindUniqueMock.mockResolvedValue(null);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(403);
    expect(chapterFindManyMock).not.toHaveBeenCalled();
  });

  it("returns a paged chapter slice with user read state", async () => {
    chapterFindManyMock.mockResolvedValue([
      { id: "c1", chapterNumber: 2, title: "Two", url: "u1", releaseDate: null, sourceId: "s1" },
      { id: "c2", chapterNumber: 1, title: "One", url: "u2", releaseDate: null, sourceId: "s1" },
      { id: "c3", chapterNumber: 0, title: "Zero", url: "u3", releaseDate: null, sourceId: "s1" },
    ]);

    const cursor = Buffer.from(JSON.stringify({ id: "after-this" }), "utf8").toString("base64url");
    const req = { nextUrl: new URL(`http://localhost/api/manga/one-piece/chapters?limit=2&cursor=${cursor}&sourceId=s1&mode=all`) };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe("all");
    expect(body.sortDirection).toBe("desc");
    expect(body.nextCursor).toBe(Buffer.from(JSON.stringify({ id: "c2" }), "utf8").toString("base64url"));
    expect(body.chapters).toEqual([
      expect.objectContaining({ id: "c1", isRead: false }),
      expect.objectContaining({ id: "c2", isRead: true }),
    ]);
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      take: 3,
      cursor: { id: "after-this" },
      skip: 1,
      where: expect.objectContaining({
        mangaId: "m1",
        sourceId: "s1",
      }),
      orderBy: [
        { chapterNumber: "desc" },
        { releaseDate: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    }));
  });

  it("supports loading the oldest chapter page from the database", async () => {
    chapterFindManyMock.mockResolvedValue([
      { id: "c0", chapterNumber: 0, title: "Zero", url: "u0", releaseDate: null, sourceId: "s1" },
      { id: "c1", chapterNumber: 1, title: "One", url: "u1", releaseDate: null, sourceId: "s1" },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?limit=2&sort=asc") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sortDirection).toBe("asc");
    expect(body.chapters).toEqual([
      expect.objectContaining({ id: "c0", chapterNumber: 0 }),
      expect.objectContaining({ id: "c1", chapterNumber: 1 }),
    ]);
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [
        { chapterNumber: "asc" },
        { releaseDate: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    }));
  });

  it("keeps broad providers in default chapter pages when single-title fallbacks are present", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "blue-lock",
      title: "Blue Lock",
      sources: [
        { id: "s1", sourceName: "NeloManga", sourceUrl: "https://www.nelomanga.net/manga/blue-lock" },
        { id: "s2", sourceName: "Blue Lock Manga", sourceUrl: "https://w45.blue-lock-manga.com/" },
        { id: "s3", sourceName: "MangaPill", sourceUrl: "https://mangapill.com/manga/580/blue-lock" },
      ],
    });
    chapterFindManyMock.mockResolvedValue([
      { id: "c1", chapterNumber: 291, title: "Latest", url: "u1", releaseDate: null, sourceId: "s3" },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/blue-lock/chapters?limit=2") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "blue-lock" }),
    });

    expect(res.status).toBe(200);
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        mangaId: "m1",
        sourceId: { in: ["s1", "s2", "s3"] },
      }),
    }));
  });

  it("excludes user-disabled sources from default chapter pages", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      title: "One Piece",
      sources: [
        { id: "s1", sourceName: "MangaPlus", sourceUrl: "https://mangaplus.shueisha.co.jp/titles/100020" },
        { id: "s2", sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" },
      ],
    });
    userMangaFindUniqueMock.mockResolvedValue({
      id: "um1",
      lastReadChapterNumber: 1,
      disabledSources: [{ sourceId: "s1" }],
    });
    chapterFindManyMock.mockResolvedValue([
      { id: "c1", chapterNumber: 2, title: "Two", url: "u1", releaseDate: null, sourceId: "s2" },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?limit=2") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(200);
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        mangaId: "m1",
        sourceId: { in: ["s2"] },
      }),
    }));
  });

  it("does not allow loading a disabled source directly", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      title: "One Piece",
      sources: [
        { id: "s1", sourceName: "MangaPlus", sourceUrl: "https://mangaplus.shueisha.co.jp/titles/100020" },
        { id: "s2", sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" },
      ],
    });
    userMangaFindUniqueMock.mockResolvedValue({
      id: "um1",
      lastReadChapterNumber: 1,
      disabledSources: [{ sourceId: "s1" }],
    });

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?sourceId=s1") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(404);
    expect(chapterFindManyMock).not.toHaveBeenCalled();
  });

  it("does not allow loading a disabled source directly when every source is disabled", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      title: "One Piece",
      sources: [
        { id: "s1", sourceName: "MangaPlus", sourceUrl: "https://mangaplus.shueisha.co.jp/titles/100020" },
      ],
    });
    userMangaFindUniqueMock.mockResolvedValue({
      id: "um1",
      lastReadChapterNumber: 1,
      disabledSources: [{ sourceId: "s1" }],
    });

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?sourceId=s1") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });

    expect(res.status).toBe(404);
    expect(chapterFindManyMock).not.toHaveBeenCalled();
  });

  it("returns the true first chapter target from the database", async () => {
    chapterFindFirstMock.mockResolvedValue({
      chapterNumber: 0,
    });
    chapterFindManyMock.mockResolvedValue([{
      id: "c0",
      chapterNumber: 0,
      title: "Zero",
      url: "u0",
      releaseDate: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      sourceId: "s1",
      readerStatus: null,
      source: { sourceName: "MangaDex" },
    }]);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?target=first") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "c0",
      chapterNumber: 0,
      sourceName: "MangaDex",
    }));
    expect(chapterFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ mangaId: "m1" }),
      orderBy: [
        { chapterNumber: "asc" },
        { releaseDate: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    }));
    expect(chapterFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        mangaId: "m1",
        chapterNumber: 0,
      }),
    }));
  });

  it("returns the preferred source candidate for the latest target", async () => {
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 42 });
    chapterFindManyMock.mockResolvedValue([
      {
        id: "manganato-42",
        chapterNumber: 42,
        title: "Forty Two",
        url: "manganato-url",
        releaseDate: new Date("2024-01-02T00:00:00.000Z"),
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
        sourceId: "s1",
        readerStatus: null,
        source: { sourceName: "Manganato" },
      },
      {
        id: "mangaplus-42",
        chapterNumber: 42,
        title: "Forty Two",
        url: "mangaplus-url",
        releaseDate: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        sourceId: "s2",
        readerStatus: null,
        source: { sourceName: "MangaPlus" },
      },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?target=latest") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "mangaplus-42",
      sourceName: "MangaPlus",
    }));
    expect(chapterFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [
        { chapterNumber: "desc" },
        { releaseDate: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    }));
  });

  it("uses user source order when choosing a duplicate latest target", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      title: "One Piece",
      sources: [
        { id: "s1", sourceName: "MangaPill", sourceUrl: "https://mangapill.com/manga/2/one-piece" },
        { id: "s2", sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" },
      ],
    });
    userMangaFindUniqueMock.mockResolvedValue({
      id: "um1",
      lastReadChapterNumber: 1,
      disabledSources: [],
      sourcePreferences: [
        { sourceId: "s2", position: 0 },
        { sourceId: "s1", position: 1 },
      ],
    });
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 42 });
    chapterFindManyMock.mockResolvedValue([
      {
        id: "mangapill-42",
        chapterNumber: 42,
        title: "Forty Two",
        url: "mangapill-url",
        releaseDate: new Date("2024-01-02T00:00:00.000Z"),
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
        sourceId: "s1",
        readerStatus: null,
        source: { sourceName: "MangaPill" },
      },
      {
        id: "mangadex-42",
        chapterNumber: 42,
        title: "Forty Two",
        url: "mangadex-url",
        releaseDate: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        sourceId: "s2",
        readerStatus: null,
        source: { sourceName: "MangaDex" },
      },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?target=latest") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "mangadex-42",
      sourceName: "MangaDex",
    }));
  });

  it("prefers MangaPlus over MangaDex for duplicate latest chapter targets", async () => {
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 35 });
    chapterFindManyMock.mockResolvedValue([
      {
        id: "mangadex-35",
        chapterNumber: 35,
        title: "The Aircraft Carrier Floor, Part 2",
        url: "https://mangadex.org/chapter/8f39a659-9041-4311-8252-1162c1085802",
        releaseDate: new Date("2026-06-05T00:00:00.000Z"),
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        sourceId: "s1",
        readerStatus: null,
        source: { sourceName: "MangaDex" },
      },
      {
        id: "mangaplus-35",
        chapterNumber: 35,
        title: "Chapter 35",
        url: "https://mangaplus.shueisha.co.jp/viewer/1029242",
        releaseDate: new Date("2026-06-04T00:00:00.000Z"),
        createdAt: new Date("2026-06-04T00:00:00.000Z"),
        sourceId: "s2",
        readerStatus: null,
        source: { sourceName: "MangaPlus" },
      },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/maison/chapters?target=latest") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "maison" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "mangaplus-35",
      sourceName: "MangaPlus",
      url: "https://mangaplus.shueisha.co.jp/viewer/1029242",
    }));
  });

  it("prefers MangaPill over single-title fallback chapter targets", async () => {
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 108 });
    chapterFindManyMock.mockResolvedValue([
      {
        id: "single-108",
        chapterNumber: 108,
        title: "Chapter 108",
        url: "https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-108/",
        releaseDate: new Date("2024-04-01T00:00:00.000Z"),
        createdAt: new Date("2024-04-01T00:00:00.000Z"),
        sourceId: "s1",
        readerStatus: null,
        source: { sourceName: "Land of the Lustrous" },
      },
      {
        id: "mangapill-108",
        chapterNumber: 108,
        title: "Chapter 108",
        url: "https://mangapill.com/chapters/123-10108000/houseki-no-kuni-chapter-108",
        releaseDate: new Date("2024-03-30T00:00:00.000Z"),
        createdAt: new Date("2024-03-30T00:00:00.000Z"),
        sourceId: "s2",
        readerStatus: null,
        source: { sourceName: "MangaPill" },
      },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/houseki-no-kuni/chapters?target=latest") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "houseki-no-kuni" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "mangapill-108",
      sourceName: "MangaPill",
    }));
  });

  it("prefers the Witch Hat Atelier dedicated source over broad duplicate chapter targets", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "witch-hat-atelier",
      title: "Witch Hat Atelier",
      sources: [
        { id: "s1", sourceName: "MangaPill", sourceUrl: "https://mangapill.com/manga/example/witch-hat-atelier" },
        { id: "s2", sourceName: "Manganato", sourceUrl: "https://chapmanganato.to/manga/example" },
        { id: "s3", sourceName: "Witch Hat Atelier Manga", sourceUrl: "https://witchhatateliermanga.com/" },
      ],
    });
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 96 });
    chapterFindManyMock.mockResolvedValue([
      {
        id: "mangapill-96",
        chapterNumber: 96,
        title: "Chapter 96",
        url: "https://mangapill.com/chapters/example/witch-hat-atelier-chapter-96",
        releaseDate: new Date("2026-01-02T00:00:00.000Z"),
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        sourceId: "s1",
        readerStatus: null,
        source: { sourceName: "MangaPill" },
      },
      {
        id: "manganato-96",
        chapterNumber: 96,
        title: "Chapter 96",
        url: "https://chapmanganato.to/example/chapter-96",
        releaseDate: new Date("2026-01-03T00:00:00.000Z"),
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
        sourceId: "s2",
        readerStatus: null,
        source: { sourceName: "Manganato" },
      },
      {
        id: "witch-96",
        chapterNumber: 96,
        title: "Witch Hat Atelier Chapter 96",
        url: "https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-96/",
        releaseDate: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        sourceId: "s3",
        readerStatus: "EXTERNAL_ONLY",
        source: { sourceName: "Witch Hat Atelier Manga" },
      },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/witch-hat-atelier/chapters?target=latest") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "witch-hat-atelier" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "witch-96",
      sourceName: "Witch Hat Atelier Manga",
      readerStatus: "EXTERNAL_ONLY",
    }));
  });

  it("returns the preferred source candidate for the next unread target", async () => {
    mangaFindUniqueMock.mockResolvedValue({
      id: "m1",
      slug: "one-piece",
      title: "One Piece",
      sources: [
        { id: "s1", sourceName: "Manganato", sourceUrl: "https://chapmanganato.to/manga/example" },
        { id: "s2", sourceName: "MangaDex", sourceUrl: "https://mangadex.org/title/x" },
      ],
    });
    userMangaFindUniqueMock.mockResolvedValue({
      id: "um1",
      lastReadChapterNumber: 10,
      disabledSources: [],
      sourcePreferences: [],
    });
    chapterFindFirstMock.mockResolvedValue({ chapterNumber: 11 });
    chapterFindManyMock.mockResolvedValue([
      {
        id: "manganato-11",
        chapterNumber: 11,
        title: "Eleven",
        url: "manganato-url",
        releaseDate: new Date("2024-01-02T00:00:00.000Z"),
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
        sourceId: "s1",
        readerStatus: null,
        source: { sourceName: "Manganato" },
      },
      {
        id: "mangadex-11",
        chapterNumber: 11,
        title: "Eleven",
        url: "mangadex-url",
        releaseDate: new Date("2024-01-01T00:00:00.000Z"),
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        sourceId: "s2",
        readerStatus: null,
        source: { sourceName: "MangaDex" },
      },
    ]);

    const req = { nextUrl: new URL("http://localhost/api/manga/one-piece/chapters?target=next-unread") };
    const res = await GET(req as never, {
      params: Promise.resolve({ slug: "one-piece" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chapter).toEqual(expect.objectContaining({
      id: "mangadex-11",
      sourceName: "MangaDex",
      isRead: false,
    }));
    expect(chapterFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        mangaId: "m1",
        chapterNumber: { gt: 10 },
      }),
    }));
  });
});
