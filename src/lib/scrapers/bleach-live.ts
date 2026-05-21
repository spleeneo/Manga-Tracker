import { fetchWithRetry } from "./http";
import { MangaMetadata, ReaderChapterInput, ReaderResult, ScrapedChapter, Scraper, SearchResult } from "./types";

const BASE_URL = "https://w42.bleach.live/";
const COVER_FALLBACK = "https://bleach.live/wp-content/uploads/2022/11/ezgif-1-2666aed46a.jpg";

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

function toAbsoluteUrl(url: string): string {
  return new URL(url, BASE_URL).toString();
}

function parseChapterNumber(value: string): number | null {
  const match = value.match(/bleach-chapter-(\d+)(?:-(\d+))?/i)
    ?? value.match(/bleach,\s*chapter\s+(\d+(?:\.\d+)?)/i)
    ?? value.match(/bleach\s+chapter\s+(\d+(?:\.\d+)?)/i);
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

function extractImageSrc(tag: string): string | undefined {
  const src = tag.match(/\s(?:data-src|src)=["']([^"']+)["']/i)?.[1];
  return src ? decodeHtml(src) : undefined;
}

function isContentImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;
  if (!/\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower)) return false;
  if (lower.includes("logo") || lower.includes("avatar") || lower.includes("emoji")) return false;
  if (lower.includes("/wp-content/themes/") || lower.includes("/wp-includes/")) return false;
  return lower.includes("/wp-content/uploads/") || lower.includes("blogger.googleusercontent.com/img/");
}

export class BleachLiveScraper implements Scraper {
  name = "Bleach Live";
  capabilities = { search: true, metadata: true, chapters: true, reader: true };

  canHandle(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return hostname === "w42.bleach.live" || hostname === "bleach.live";
    } catch {
      return url.includes("bleach.live");
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

    const aliases = ["bleach", "bleach manga", "bleach live", "ichigo"];
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
        title: "Bleach",
        description: "Read Bleach Manga Online in High Quality.",
        coverUrl: COVER_FALLBACK,
        status: "COMPLETED",
        author: "Tite Kubo",
        sourceUrl: BASE_URL,
        sourceName: this.name,
      }];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const html = await this.fetchHtml(url);

    return {
      title: "Bleach",
      description: getMeta(html, "description") ?? getMeta(html, "og:description"),
      coverUrl: getMeta(html, "twitter:image") ?? getMeta(html, "og:image") ?? COVER_FALLBACK,
      status: "COMPLETED",
      author: "Tite Kubo",
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const html = await this.fetchHtml(url);
    const linkMatches = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']*\/manga\/bleach-chapter-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const chapters = linkMatches.flatMap((match) => {
      const chapterNumber = parseChapterNumber(match[1]) ?? parseChapterNumber(match[2]);
      if (chapterNumber == null) return [];

      return [{
        providerChapterId: String(chapterNumber),
        chapterNumber,
        title: decodeHtml(match[2]) || `Bleach Chapter ${chapterNumber}`,
        url: toAbsoluteUrl(match[1]),
      }];
    });

    return uniqueByChapterNumber(chapters).sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async fetchReaderPages(chapter: ReaderChapterInput): Promise<ReaderResult> {
    const html = await this.fetchHtml(chapter.url);
    const pageUrls = Array.from(html.matchAll(/<img\b[^>]*>/gi))
      .map((match) => extractImageSrc(match[0]))
      .filter((url): url is string => Boolean(url))
      .map(toAbsoluteUrl)
      .filter(isContentImage);

    if (pageUrls.length < 3) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "Bleach Live did not expose readable public page images for this chapter.",
      };
    }

    return {
      status: "READABLE",
      pages: pageUrls.map((imageUrl, index) => ({ index, imageUrl })),
      externalUrl: chapter.url,
    };
  }
}
