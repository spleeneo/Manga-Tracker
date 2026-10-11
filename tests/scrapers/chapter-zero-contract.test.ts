import { beforeEach, describe, expect, it, vi } from "vitest";
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/scrapers/http", () => ({ fetchWithRetry: fetchMock, ScraperRequestError: class extends Error {} }));
import { getRegisteredScrapers, scrapeChapters } from "@/lib/scrapers/registry";

function response(body: string | object) {
  return { ok: true, text: async () => typeof body === "string" ? body : JSON.stringify(body), json: async () => body };
}
const date = "2024-01-01T00:00:00Z";
const comic = '<script id="comic" type="application/json">{"id":10,"uslug":"example"}</script>';
type ProviderCase = { name: string; url: string; bodies: Array<string | object>; oneShotBodies: Array<string | object>; oneShotNumber?: number };
const cases: ProviderCase[] = [
  { name: "MangaDex", url: "https://mangadex.org/title/6eca560a-d5e3-4711-88c4-5676e3cd8364",
    bodies: [{ data: [{ id: "c0", attributes: { chapter: "0", publishAt: date } }], total: 1, limit: 100 }],
    oneShotBodies: [{ data: [{ id: "one-shot", attributes: { chapter: null, title: "One-shot: Story of 2024", publishAt: date } }], total: 1, limit: 100 }] },
  { name: "NeloManga", url: "https://www.nelomanga.net/manga/example",
    bodies: [{ success: true, data: { chapters: [{ chapter_slug: "chapter-0", chapter_num: 0, chapter_name: "Chapter 0" }], pagination: { has_more: false } } }],
    oneShotBodies: [{ success: true, data: { chapters: [{ chapter_slug: "one-shot", chapter_num: null, chapter_name: "One-shot" }], pagination: { has_more: false } } }] },
  { name: "MangaPlus", url: "https://mangaplus.shueisha.co.jp/titles/100001",
    bodies: [{ success: { titleDetailView: { chapterListGroup: [{ firstChapterList: [{ chapterId: 100, name: "#000" }] }] } } }],
    oneShotBodies: [{ success: { titleDetailView: { chapterListGroup: [{ firstChapterList: [{ chapterId: 101, name: "One-shot", subTitle: "Story of 2024" }] }] } } }] },
  { name: "Comikey", url: "https://comikey.com/comics/example/10/",
    bodies: [comic, { episodes: [{ id: "EPI-zero", number: 0, title: "Chapter 0" }] }],
    oneShotBodies: [comic, { episodes: [{ id: "EPI-one-shot", number: null, title: "One-shot" }] }] },
  { name: "VIZ", url: "https://www.viz.com/example",
    bodies: ['<a href="/read/manga/example/chapter-0">Chapter 0</a>'],
    oneShotBodies: ['<a href="/read/manga/example/one-shot">One-shot</a>'] },
  { name: "Webtoon", url: "https://www.webtoons.com/en/canvas/example/list?title_no=10", oneShotNumber: 7,
    bodies: ['<a href="https://www.webtoons.com/en/canvas/example/prologue/viewer?title_no=10&episode_no=0"><span class="subj">Prologue</span><span class="date">Jan 1, 2024</span></a>'],
    oneShotBodies: ['<a href="https://www.webtoons.com/en/canvas/example/one-shot/viewer?title_no=10&episode_no=7"><span class="subj">One-shot</span><span class="date">Jan 1, 2024</span></a>'] },
  { name: "Manganato", url: "https://chapmanganato.to/manga-aa",
    bodies: ['<a class="chapter-name text-nowrap" href="https://chapmanganato.to/manga-aa/chapter-0">Chapter 0</a><span class="chapter-time text-nowrap" title="Jan 1, 2024"></span>'],
    oneShotBodies: ['<a class="chapter-name text-nowrap" href="https://chapmanganato.to/manga-aa/one-shot">One-shot</a><span class="chapter-time text-nowrap" title="Jan 1, 2024"></span>'] },
  { name: "MangaPill", url: "https://mangapill.com/manga/10391/black-santa",
    bodies: ['<a href="/chapters/10391-10000000/black-santa-chapter-0">Chapter 0</a>'],
    oneShotBodies: ['<a href="/chapters/10391-10000000/black-santa-one-shot">One-shot</a>'] },
  { name: "Atsumaru", url: "https://atsu.moe/manga/example",
    bodies: [{ chapters: [{ id: "zero", number: 0, title: "Chapter 0" }] }],
    oneShotBodies: [{ chapters: [{ id: "one-shot", title: "One-shot: Story of 2024" }] }] },
  { name: "Urek Mazino", url: "https://urekmazino.com/",
    bodies: ['<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"url":"https://urekmazino.com/chapter/0/","name":"Urek Mazino Chapter 0"}]}</script>'],
    oneShotBodies: ['<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"url":"https://urekmazino.com/chapter/one-shot/","name":"Urek Mazino One-shot"}]}</script>'] },
  { name: "Bleach Live", url: "https://w42.bleach.live/",
    bodies: ['<a href="https://w42.bleach.live/manga/bleach-chapter-0/">Bleach Chapter 0</a>'],
    oneShotBodies: ['<a href="https://w42.bleach.live/manga/bleach-one-shot/">Bleach One-shot</a>'] },
  { name: "Witch Hat Atelier Manga", url: "https://witchhatateliermanga.com/",
    bodies: ['<a href="https://witchhatateliermanga.com/manga/witch-hat-atelier-chapter-0/">Chapter 0</a>'],
    oneShotBodies: ['<a href="https://witchhatateliermanga.com/manga/witch-hat-atelier-one-shot/">One-shot</a>'] },
  { name: "Land of the Lustrous", url: "https://w1.land-of-the-lustrous.online/",
    bodies: ['<a href="https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-chapter-0/">Chapter 0</a>'],
    oneShotBodies: ['<a href="https://w1.land-of-the-lustrous.online/manga/land-of-the-lustrous-one-shot/">One-shot</a>'] },
  { name: "Single Manga Sites", url: "https://w45.blue-lock-manga.com/",
    bodies: ['<a href="https://w45.blue-lock-manga.com/manga/blue-lock-chapter-0/">Chapter 0</a>'],
    oneShotBodies: ['<a href="https://w45.blue-lock-manga.com/manga/blue-lock-one-shot/">One-shot</a>'] },
];

describe("all registered providers preserve chapter zero", () => {
  beforeEach(() => fetchMock.mockReset());
  it("keeps the matrix complete as providers are added", () => {
    expect(cases.map((entry) => entry.name).sort()).toEqual(getRegisteredScrapers().map((scraper) => scraper.name).sort());
  });
  it.each(cases)("$name imports chapter zero through the registry", async ({ url, bodies }) => {
    bodies.forEach((body) => fetchMock.mockResolvedValueOnce(response(body)));
    const chapters = await scrapeChapters(url);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]).toMatchObject({ chapterNumber: 0, url: expect.any(String) });
  });
  it.each(cases)("$name imports a named one-shot through the registry", async ({ url, oneShotBodies, oneShotNumber }) => {
    oneShotBodies.forEach((body) => fetchMock.mockResolvedValueOnce(response(body)));
    const chapters = await scrapeChapters(url);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].chapterNumber).toBe(oneShotNumber ?? 0);
  });
  it.each([null, "0"])("rejects two different releases competing for zero (%s)", async (number) => {
    fetchMock.mockResolvedValueOnce(response({ data: [
      { id: "a", attributes: { chapter: number, title: number === null ? "One-shot: A" : "Chapter 0", publishAt: date } },
      { id: "b", attributes: { chapter: null, title: "One-shot: B", publishAt: date } },
    ], total: 2, limit: 100 }));
    await expect(scrapeChapters(cases[0].url)).rejects.toThrow("Multiple distinct releases");
  });
  it("ignores an unrelated sidebar one-shot on a single-manga site", async () => {
    fetchMock.mockResolvedValueOnce(response('<a href="https://w45.blue-lock-manga.com/manga/fire-punch-one-shot/">One-shot</a><a href="https://w45.blue-lock-manga.com/manga/blue-lock-one-shot/">One-shot</a>'));
    const chapters = await scrapeChapters("https://w45.blue-lock-manga.com/");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].url).toContain("blue-lock-one-shot");
  });
  it.each([
    { url: "https://mangapill.com/manga/1/example", body: '<a href="/chapters/1/a-one-shot">One-shot: A</a><a href="/chapters/1/b-one-shot">One-shot: B</a>' },
    { url: "https://www.viz.com/example", body: '<a href="/read/manga/example/a-one-shot">One-shot: A</a><a href="/read/manga/example/b-one-shot">One-shot: B</a>' },
    { url: "https://w45.blue-lock-manga.com/", body: '<a href="/manga/blue-lock-one-shot-a">One-shot: A</a><a href="/manga/blue-lock-one-shot-b">One-shot: B</a>' },
  ])("reports ambiguous one-shots before deduplicating $url", async ({ url, body }) => {
    fetchMock.mockResolvedValueOnce(response(body));
    await expect(scrapeChapters(url)).rejects.toThrow("Multiple distinct releases");
  });
  it.each([NaN, Infinity, -1])("rejects invalid adapter numbers (%s) at the shared boundary", async (number) => {
    const scraper = getRegisteredScrapers().find((provider) => provider.name === "MangaDex")!;
    const spy = vi.spyOn(scraper, "fetchChapters").mockResolvedValueOnce([{ chapterNumber: number, url: "https://mangadex.org/chapter/test" }]);
    try {
      await expect(scrapeChapters(cases[0].url)).rejects.toThrow("invalid chapter number");
    } finally {
      spy.mockRestore();
    }
  });
});
