import { fetchWithRetry } from "./http";
import { MangaMetadata, ScrapedChapter, Scraper, SearchResult } from "./types";

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

      const cards = Array.from(html.matchAll(/<a[^>]+href="(https:\/\/www\.webtoons\.com\/en\/[^"]+title_no=\d+[^"]*)"[^>]*>[\s\S]*?<p[^>]*class="subj"[^>]*>([^<]+)<\/p>/gi));
      return cards.slice(0, 5).map((match) => ({
        title: match[2].trim(),
        sourceUrl: match[1],
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

    const title = html.match(/<h1[^>]*class="subj"[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ?? "Unknown";
    const description = html.match(/<p[^>]*class="summary"[^>]*>([\s\S]*?)<\/p>/i)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .trim();
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

    const listUrl = url.includes("title_no=") ? url : `${url}${url.includes("?") ? "&" : "?"}title_no=${titleNo}`;
    const res = await fetchWithRetry(listUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await res.text();

    const episodes = Array.from(
      html.matchAll(/<a[^>]+href="([^"]*episode_no=(\d+)[^"]*)"[^>]*>[\s\S]*?<span[^>]*class="subj"[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*class="date"[^>]*>([^<]+)<\/span>/gi)
    );

    return episodes.map((entry) => {
      const chapterNumber = Number(entry[2]);
      const fullUrl = entry[1].startsWith("http") ? entry[1] : `https://www.webtoons.com${entry[1]}`;
      const parsedDate = new Date(entry[4]);

      return {
        providerChapterId: entry[2],
        chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : 0,
        title: entry[3].trim(),
        url: fullUrl,
        releaseDate: Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate,
      };
    });
  }
}
