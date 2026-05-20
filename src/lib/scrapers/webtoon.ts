import { fetchWithRetry } from "./http";
import { MangaMetadata, ScrapedChapter, Scraper, SearchResult } from "./types";

const WEBTOON_BASE_URL = "https://www.webtoons.com";
const MAX_PAGES = 100;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function absoluteWebtoonUrl(url: string): string {
  return new URL(url, WEBTOON_BASE_URL).toString();
}

function withPage(url: string, page: number): string {
  const parsed = new URL(url);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

function parseWebtoonDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isFreeEpisodeListItem(html: string): boolean {
  const normalized = stripTags(html).toLowerCase();
  const raw = html.toLowerCase();

  return ![
    "fast pass",
    "daily pass",
    "coin",
    "coins",
    "locked",
    "unlock",
    "only on the app",
    "download app",
    "ico_lock",
    "lock_icon",
  ].some((marker) => normalized.includes(marker) || raw.includes(marker));
}

export class WebtoonScraper implements Scraper {
  name = "Webtoon";
  capabilities = { search: true, metadata: true, chapters: true };

  canHandle(url: string): boolean {
    return url.includes("webtoons.com");
  }

  private extractTitleNo(url: string): string | null {
    const titleNoMatch = url.match(/[?&]title_no=(\d+)/);
    return titleNoMatch ? titleNoMatch[1] : null;
  }

  async search(query: string): Promise<SearchResult[]> {
    const searchUrl = `https://www.webtoons.com/en/search?keyword=${encodeURIComponent(query)}`;
    try {
      const res = await fetchWithRetry(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = await res.text();

      const cards = Array.from(html.matchAll(/<a[^>]+href="(https:\/\/www\.webtoons\.com\/en\/[^"]+title_no=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi));
      const seen = new Set<string>();

      return cards.flatMap((match) => {
        const href = match[1];
        if (seen.has(href)) return [];
        seen.add(href);

        const body = match[2];
        const title = stripTags(
          body.match(/<(?:p|strong)[^>]*class="(?:subj|title)"[^>]*>([\s\S]*?)<\/(?:p|strong)>/i)?.[1] ?? ""
        );
        if (!title) return [];

        const coverUrl = body.match(/<img[^>]+src="([^"]+)"/i)?.[1];

        return [{
          title,
          sourceUrl: href,
          coverUrl,
          sourceName: "Webtoon",
          status: "ONGOING",
        }];
      }).slice(0, 5).map((result) => ({
        title: result.title,
        sourceUrl: result.sourceUrl,
        coverUrl: result.coverUrl,
        sourceName: "Webtoon",
        status: "ONGOING",
      }));
    } catch {
      return [];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await res.text();

    const title = stripTags(html.match(/<h1[^>]*class="subj"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") || "Unknown";
    const description = stripTags(html.match(/<p[^>]*class="summary"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const coverUrl = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1];

    return {
      title,
      description,
      coverUrl,
      status: "ONGOING",
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const titleNo = this.extractTitleNo(url);
    if (!titleNo) throw new Error("Invalid Webtoon URL (missing title_no)");

    const startUrl = url.includes("title_no=") ? url : `${url}${url.includes("?") ? "&" : "?"}title_no=${titleNo}`;
    const chapters = new Map<string, ScrapedChapter>();

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetchWithRetry(withPage(startUrl, page), {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = await res.text();
      const pageChapters = this.parseChapterList(html);

      if (pageChapters.length === 0) break;

      let newOnPage = 0;
      for (const chapter of pageChapters) {
        const key = chapter.providerChapterId ?? String(chapter.chapterNumber);
        if (!chapters.has(key)) {
          chapters.set(key, chapter);
          newOnPage++;
        }
      }

      if (newOnPage === 0 || !this.hasNextPage(html, page)) break;
    }

    return Array.from(chapters.values()).sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  private parseChapterList(html: string): ScrapedChapter[] {
    return Array.from(
      html.matchAll(/<a[^>]+href="([^"]*episode_no=(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)
    ).filter((entry) => isFreeEpisodeListItem(entry[3])).map((entry) => {
      const episodeNo = Number(entry[2]);
      const body = entry[3];
      const title = stripTags(
        body.match(/<span[^>]*class="subj"[^>]*>([\s\S]*?)<\/span>\s*<span[^>]*class="date"/i)?.[1]
        ?? body.match(/<span[^>]*class="subj"[^>]*>([\s\S]*?)<\/span>/i)?.[1]
        ?? `Episode ${entry[2]}`
      );
      const date = stripTags(body.match(/<span[^>]*class="date"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");

      return {
        providerChapterId: entry[2],
        chapterNumber: Number.isFinite(episodeNo) ? episodeNo : 0,
        title,
        url: absoluteWebtoonUrl(entry[1]),
        releaseDate: parseWebtoonDate(date),
      };
    });
  }

  private hasNextPage(html: string, currentPage: number): boolean {
    const pageNumbers = Array.from(html.matchAll(/[?&]page=(\d+)/gi))
      .map((match) => Number(match[1]))
      .filter(Number.isFinite);

    return pageNumbers.some((page) => page > currentPage);
  }
}
