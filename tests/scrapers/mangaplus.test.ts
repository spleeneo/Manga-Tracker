import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
  ScraperRequestError: class ScraperRequestError extends Error {
    constructor(
      message: string,
      public kind: string,
      public status?: number,
    ) {
      super(message);
      this.name = "ScraperRequestError";
    }
  },
}));

import { MangaPlusScraper } from "@/lib/scrapers/mangaplus";
import { mangaPlusResponseType } from "@/lib/scrapers/mangaplus-protocol";

function binaryResponse(body: unknown) {
  return new Response(mangaPlusResponseType.encode(body as Record<string, unknown>).finish(), {
    headers: { "Content-Type": "application/x-protobuf" },
  });
}

describe("MangaPlusScraper", () => {
  it("searches binary responses using one stable public session and no JSON format parameter", async () => {
    // Fixed wire fixture, independent of the production schema/encoder:
    // Response.success(1), Success.allTitles(25), groups(1), titles(2).
    const wire = Buffer.from("CkfKAUQKQhIfCLSNBhIJT25lIFBpZWNlGgxFaWljaGlybyBPZGE4ABIfCNSaDBIJT25lIFBpZWNlGgxFaWljaGlybyBPZGE4AQ==", "base64");
    const response = () => new Response(wire, { headers: { "Content-Type": "application/x-protobuf" } });
    fetchWithRetryMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(response());
    const scraper = new MangaPlusScraper();
    expect(await scraper.search("piece")).toEqual([
      expect.objectContaining({ title: "One Piece", author: "Eiichiro Oda", sourceUrl: "https://mangaplus.shueisha.co.jp/titles/100020" }),
    ]);
    const controller = new AbortController();
    await new MangaPlusScraper().search("one", { signal: controller.signal });
    const [url, options] = fetchWithRetryMock.mock.calls[0];
    expect(new URL(url).searchParams.has("format")).toBe(false);
    expect(options.headers["SESSION-TOKEN"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchWithRetryMock.mock.calls[1][1].headers["SESSION-TOKEN"]).toBe(options.headers["SESSION-TOKEN"]);
    expect(fetchWithRetryMock.mock.calls[1][1].signal).toBe(controller.signal);
  });

  it.each([
    new Response("<html>Unavailable</html>", { headers: { "Content-Type": "text/html" } }),
    new Response(new Uint8Array([10, 255]), { headers: { "Content-Type": "application/x-protobuf" } }),
    binaryResponse({}),
  ])("reports unexpected or malformed payloads instead of an empty search", async (response) => {
    fetchWithRetryMock.mockResolvedValueOnce(response);
    await expect(new MangaPlusScraper().search("piece")).rejects.toMatchObject({ kind: "parsing" });
  });

  it("reads binary title metadata", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(binaryResponse({ success: { titleDetailView: {
      title: { titleId: 100020, name: "One Piece", author: "Eiichiro Oda" }, overview: "A pirate adventure.",
    } } }));
    expect(await new MangaPlusScraper().fetchMetadata("https://mangaplus.shueisha.co.jp/titles/100020"))
      .toMatchObject({ title: "One Piece", author: "Eiichiro Oda", description: "A pirate adventure." });
  });

  it("selects the requested viewer chapter rather than an adjacent release", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(binaryResponse({ success: { mangaViewer: {
      chapterId: 1029045,
      chapters: [{ chapterId: 1, name: "#016" }, { chapterId: 1029045, name: "#017" }, { chapterId: 2, name: "#018" }],
    } } }));
    expect(await new MangaPlusScraper().fetchChapters("https://mangaplus.shueisha.co.jp/viewer/1029045"))
      .toEqual([expect.objectContaining({ chapterNumber: 17, providerChapterId: "1029045" })]);
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks public first/latest chapters and skips archive-only middle chapters", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(binaryResponse({
      success: {
        titleDetailView: {
          chapterListGroup: [
            {
              firstChapterList: [
                { chapterId: 1000303, name: "#001", subTitle: "Cruelty", startTimeStamp: 1704067200 },
                { chapterId: 1006664, name: "ex", subTitle: "Special one shot" },
              ],
              midChapterList: [
                { chapterId: 1000304, name: "#002", subTitle: "Trainer Sakonji Urokodaki" },
                { chapterId: 1000305, name: "#003", subTitle: "Return by Dawn" },
              ],
              lastChapterList: [
                { chapterId: 1000306, name: "#004", subTitle: "Tanjiro's Journal, Part 1" },
              ],
            },
          ],
        },
      },
    }));

    const scraper = new MangaPlusScraper();
    const chapters = await scraper.fetchChapters("https://mangaplus.shueisha.co.jp/titles/100009");

    expect(chapters.map((chapter) => chapter.chapterNumber)).toEqual([1, 0, 4]);
    expect(chapters.map((chapter) => chapter.url)).toEqual([
      "https://mangaplus.shueisha.co.jp/viewer/1000303",
      "https://mangaplus.shueisha.co.jp/viewer/1006664",
      "https://mangaplus.shueisha.co.jp/viewer/1000306",
    ]);
    expect(chapters.some((chapter) => chapter.chapterNumber === 1006664)).toBe(false);
    expect(chapters.some((chapter) => chapter.chapterNumber === 2)).toBe(false);
    expect(fetchWithRetryMock.mock.calls[0][0]).toContain("/title_detailV3?");
  });

  it("tracks a MangaPlus viewer URL as a single public chapter when metadata is available", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(binaryResponse({
      success: {
        mangaViewer: {
          chapterId: 1029045,
          chapters: [{
            chapterId: 1029045,
            name: "#017",
            subTitle: "A Visitor",
            startTimeStamp: 1767225600,
          }],
        },
      },
    }));

    const scraper = new MangaPlusScraper();
    const chapters = await scraper.fetchChapters("https://mangaplus.shueisha.co.jp/viewer/1029045");

    expect(chapters).toEqual([{
      providerChapterId: "1029045",
      chapterNumber: 17,
      title: "#017: A Visitor",
      url: "https://mangaplus.shueisha.co.jp/viewer/1029045",
      releaseDate: new Date(1767225600 * 1000),
    }]);
  });

  it("surfaces MangaPlus upstream errors instead of returning an empty chapter list", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(binaryResponse({
      error: {
        englishPopup: { subject: "Account Banned" },
      },
    }));

    const scraper = new MangaPlusScraper();

    await expect(scraper.fetchChapters("https://mangaplus.shueisha.co.jp/viewer/1029045"))
      .rejects.toThrow("MangaPlus upstream error: Account Banned");
    expect(fetchWithRetryMock).toHaveBeenCalledTimes(1);
  });
});
