import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithRetryMock } = vi.hoisted(() => ({
  fetchWithRetryMock: vi.fn(),
}));

vi.mock("@/lib/scrapers/http", () => ({
  fetchWithRetry: fetchWithRetryMock,
}));

import { WebtoonScraper } from "@/lib/scrapers/webtoon";

function textResponse(body: string) {
  return {
    text: vi.fn().mockResolvedValue(body),
  };
}

describe("WebtoonScraper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds Originals search cards such as Tower of God: Urek Mazino", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <a href="https://www.webtoons.com/en/fantasy/tower-of-god-urek-mazino/list?title_no=8136"
         class="link _card_item" data-title-no="8136" data-webtoon-type="WEBTOON">
        <div class="image_wrap">
          <img src="https://webtoon.example/urek.png" alt="">
        </div>
        <div class="info_text">
          <strong class="title">Tower of God: Urek Mazino</strong>
          <div class="author">SIU</div>
        </div>
      </a>
    `));

    const scraper = new WebtoonScraper();
    const results = await scraper.search("tower of god urek mazino");

    expect(results).toEqual([
      {
        title: "Tower of God: Urek Mazino",
        sourceUrl: "https://www.webtoons.com/en/fantasy/tower-of-god-urek-mazino/list?title_no=8136",
        coverUrl: "https://webtoon.example/urek.png",
        sourceName: "Webtoon",
        status: "ONGOING",
      },
    ]);
  });

  it("fetches paginated episode lists instead of stopping after the first page", async () => {
    fetchWithRetryMock
      .mockResolvedValueOnce(textResponse(`
        <a href="https://www.webtoons.com/en/fantasy/tower-of-god/season-3-ep-235/viewer?title_no=95&episode_no=653">
          <span class="subj"><span>[Season 3] Ep. 235</span></span>
          <span class="date">Feb 23, 2025</span>
        </a>
        <div class="paginate">
          <a href="/en/fantasy/tower-of-god/list?title_no=95&page=2"><span>2</span></a>
        </div>
      `))
      .mockResolvedValueOnce(textResponse(`
        <a href="https://www.webtoons.com/en/fantasy/tower-of-god/season-3-ep-234/viewer?title_no=95&episode_no=652">
          <span class="subj"><span>[Season 3] Ep. 234</span></span>
          <span class="date">Feb 16, 2025</span>
        </a>
      `));

    const scraper = new WebtoonScraper();
    const chapters = await scraper.fetchChapters("https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95");

    expect(fetchWithRetryMock).toHaveBeenCalledTimes(2);
    expect(chapters.map((chapter) => chapter.chapterNumber)).toEqual([653, 652]);
    expect(chapters[0]).toMatchObject({
      providerChapterId: "653",
      title: "[Season 3] Ep. 235",
      url: "https://www.webtoons.com/en/fantasy/tower-of-god/season-3-ep-235/viewer?title_no=95&episode_no=653",
    });
  });

  it("skips episode rows marked as locked or paid", async () => {
    fetchWithRetryMock.mockResolvedValueOnce(textResponse(`
      <a href="https://www.webtoons.com/en/fantasy/tower-of-god/free/viewer?title_no=95&episode_no=10">
        <span class="subj"><span>Episode 10</span></span>
        <span class="date">Jan 1, 2025</span>
      </a>
      <a href="https://www.webtoons.com/en/fantasy/tower-of-god/fast-pass/viewer?title_no=95&episode_no=11">
        <span class="subj"><span>Episode 11</span></span>
        <span class="badge">Fast Pass</span>
        <span class="date">Jan 8, 2025</span>
      </a>
      <a href="https://www.webtoons.com/en/fantasy/tower-of-god/coin/viewer?title_no=95&episode_no=12">
        <span class="subj"><span>Episode 12</span></span>
        <em class="ico_lock">locked</em>
        <span class="date">Jan 15, 2025</span>
      </a>
    `));

    const scraper = new WebtoonScraper();
    const chapters = await scraper.fetchChapters("https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95");

    expect(chapters.map((chapter) => chapter.chapterNumber)).toEqual([10]);
  });
});
