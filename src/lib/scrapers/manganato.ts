import { fetchWithRetry } from "./http";
import { MangaMetadata, ReaderResult, ScrapedChapter, Scraper, SearchResult } from "./types";

const BASE = "https://manganato.com";

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .trim();
}

function toAbsoluteUrl(url: string, base: string): string {
  return new URL(decodeHtml(url), base).toString();
}

function getImageSrc(tag: string): string | undefined {
  return tag.match(/\s(?:data-src|src)=["']([^"']+)["']/i)?.[1];
}

function isReaderImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;
  if (!/\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower)) return false;
  if (lower.includes("logo") || lower.includes("avatar") || /[/?&_-]ads?[/?&_.-]/.test(lower)) return false;
  return lower.includes("manganato") || lower.includes("mncdn") || lower.includes("blogspot");
}

export class ManganatoScraper implements Scraper {
  name = "Manganato";
  capabilities = { search: true, metadata: true, chapters: true, reader: true };

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

  async fetchReaderPages(chapter: { url: string }): Promise<ReaderResult> {
    const res = await fetchWithRetry(chapter.url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": BASE,
      },
      timeoutMs: 10_000,
      retries: 1,
    });
    const html = await res.text();
    const pages = Array.from(html.matchAll(/<img\b[^>]*>/gi))
      .map((match) => getImageSrc(match[0]))
      .filter((url): url is string => Boolean(url))
      .map((url) => toAbsoluteUrl(url, chapter.url))
      .filter(isReaderImage);

    if (pages.length === 0) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "Manganato did not expose public page images for this chapter.",
      };
    }

    return {
      status: "READABLE",
      pages: pages.map((imageUrl, index) => ({ index, imageUrl })),
      externalUrl: chapter.url,
    };
  }
}
