import { fetchWithRetry } from "./http";
import { MangaMetadata, ScrapedChapter, Scraper, SearchResult } from "./types";

const BASE = "https://manganato.com";

export class ManganatoScraper implements Scraper {
  name = "Manganato";
  capabilities = { search: true, metadata: true, chapters: true };

  canHandle(url: string): boolean {
    return url.includes("manganato.com") || url.includes("chapmanganato.com");
  }

  async search(query: string): Promise<SearchResult[]> {
    const slug = query.trim().replace(/\s+/g, "_").toLowerCase();
    const searchUrl = `${BASE}/search/story/${encodeURIComponent(slug)}`;
    try {
      const res = await fetchWithRetry(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const html = await res.text();
      const cards = Array.from(
        html.matchAll(/<a[^>]+class="item-img"[^>]+href="([^"]+)"[^>]*title="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"/gi)
      );

      return cards.slice(0, 5).map((match) => ({
        title: match[2].trim(),
        sourceUrl: match[1],
        sourceName: "Manganato",
        coverUrl: match[3],
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

    const title = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ?? "Unknown";
    const description = html
      .match(/<div[^>]+class="panel-story-info-description"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .replace(/Description\s*:/i, "")
      .trim();
    const coverUrl = html.match(/<span[^>]+class="info-image"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i)?.[1];

    return {
      title,
      description,
      coverUrl,
      status: "ONGOING",
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const res = await fetchWithRetry(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await res.text();

    const chapterLinks = Array.from(
      html.matchAll(/<a[^>]+class="chapter-name text-nowrap"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<span[^>]+class="chapter-time text-nowrap"[^>]+title="([^"]+)"/gi)
    );

    return chapterLinks.map((match) => {
      const chapterMatch = match[2].match(/chapter\s+([\d.]+)/i);
      const parsedDate = new Date(match[3]);
      return {
        providerChapterId: match[1],
        chapterNumber: chapterMatch ? Number(chapterMatch[1]) : 0,
        title: match[2].trim(),
        url: match[1],
        releaseDate: Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate,
      };
    });
  }
}
