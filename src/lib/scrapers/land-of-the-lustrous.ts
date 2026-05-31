import { fetchWithRetry } from "./http";
import { MangaMetadata, ReaderChapterInput, ReaderPage, ReaderResult, ScrapedChapter, Scraper, SearchResult } from "./types";

const BASE_URL = "https://w1.land-of-the-lustrous.online/";
const COVER_FALLBACK = "https://land-of-the-lustrous.online/wp-content/uploads/2023/12/EdYT8OLU4AUmCM8.jpg";

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeta(html: string, key: string): string | undefined {
  const match = html.match(new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function getAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${attribute}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function toAbsoluteUrl(url: string): string {
  return new URL(url, BASE_URL).toString();
}

function parseChapterNumber(value: string): number | null {
  const match = value.match(/land-of-the-lustrous-chapter-(\d+)(?:-(\d+))?/i)
    ?? value.match(/chapter\s+(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const chapterNumber = Number(match[2] ? `${match[1]}.${match[2]}` : match[1]);
  return Number.isFinite(chapterNumber) ? chapterNumber : null;
}

function uniqueByChapterNumber(chapters: ScrapedChapter[]): ScrapedChapter[] {
  const seen = new Set<number>();
  const unique: ScrapedChapter[] = [];

  for (const chapter of chapters) {
    if (seen.has(chapter.chapterNumber)) continue;
    seen.add(chapter.chapterNumber);
    unique.push(chapter);
  }

  return unique;
}

function isReaderImage(url: string): boolean {
  const lower = url.toLowerCase();
  return /^https?:\/\//.test(lower)
    && /\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower)
    && (
      lower.includes("/wp-content/uploads/")
      || lower.includes("blogger.googleusercontent.com/img/")
    )
    && !lower.includes("logo")
    && !lower.includes("avatar")
    && !lower.includes("emoji");
}

export class LandOfTheLustrousScraper implements Scraper {
  name = "Land of the Lustrous";
  capabilities = { search: true, metadata: true, chapters: true, reader: true };

  canHandle(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return hostname === "w1.land-of-the-lustrous.online" || hostname === "land-of-the-lustrous.online";
    } catch {
      return url.includes("land-of-the-lustrous.online");
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await fetchWithRetry(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeoutMs: 10_000,
      retries: 1,
    });

    return response.text();
  }

  async search(query: string): Promise<SearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const aliases = [
      "houseki no kuni",
      "houseki",
      "land of the lustrous",
      "lustrous",
      "phosphophyllite",
    ];

    if (!aliases.some((alias) => alias.includes(normalizedQuery) || normalizedQuery.includes(alias))) {
      return [];
    }

    try {
      const metadata = await this.fetchMetadata(BASE_URL);
      return [{
        title: metadata.title,
        description: metadata.description,
        coverUrl: metadata.coverUrl,
        status: metadata.status,
        author: metadata.author,
        sourceUrl: BASE_URL,
        sourceName: this.name,
      }];
    } catch {
      return [{
        title: "Houseki no Kuni",
        description: "Read Land of the Lustrous manga online in high quality.",
        coverUrl: COVER_FALLBACK,
        status: "COMPLETED",
        author: "Haruko Ichikawa",
        sourceUrl: BASE_URL,
        sourceName: this.name,
      }];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const html = await this.fetchHtml(url);

    return {
      title: "Houseki no Kuni",
      description: getMeta(html, "description") ?? getMeta(html, "og:description"),
      coverUrl: getMeta(html, "twitter:image") ?? getMeta(html, "og:image") ?? COVER_FALLBACK,
      status: "COMPLETED",
      author: "Haruko Ichikawa",
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const html = await this.fetchHtml(url);
    const linkMatches = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']*\/manga\/land-of-the-lustrous-chapter-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const chapters = linkMatches.flatMap((match) => {
      const chapterNumber = parseChapterNumber(match[1]) ?? parseChapterNumber(match[2]);
      if (chapterNumber == null) return [];

      return [{
        providerChapterId: String(chapterNumber),
        chapterNumber,
        title: decodeHtml(match[2]) || `Land of the Lustrous Chapter ${chapterNumber}`,
        url: toAbsoluteUrl(match[1]),
      }];
    });

    return uniqueByChapterNumber(chapters).sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async fetchReaderPages(chapter: ReaderChapterInput): Promise<ReaderResult> {
    const html = await this.fetchHtml(chapter.url);
    const pages = Array.from(html.matchAll(/<img\b[^>]*>/gi))
      .map((match) => {
        const tag = match[0];
        const imageUrl = getAttribute(tag, "data-src") ?? getAttribute(tag, "src");
        if (!imageUrl) return null;

        const absoluteUrl = toAbsoluteUrl(imageUrl);
        if (!isReaderImage(absoluteUrl)) return null;

        const page: ReaderPage = {
          index: 0,
          imageUrl: absoluteUrl,
        };

        return page;
      })
      .filter((page): page is ReaderPage => Boolean(page))
      .map((page, index) => ({ ...page, index }));

    if (pages.length === 0) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "Land of the Lustrous did not expose public page images for this chapter.",
      };
    }

    return {
      status: "READABLE",
      pages,
      externalUrl: chapter.url,
    };
  }
}
