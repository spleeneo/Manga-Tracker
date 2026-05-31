import { fetchWithRetry } from "./http";
import { MangaMetadata, ReaderChapterInput, ReaderPage, ReaderResult, ScrapedChapter, Scraper, SearchResult } from "./types";

export type SingleMangaSiteConfig = {
  sourceName: string;
  baseUrl: string;
  canonicalTitle: string;
  aliases: string[];
  status?: string;
  author?: string;
  fallbackDescription?: string;
  fallbackCoverUrl?: string;
  chapterUrlPattern: RegExp;
  chapterTitlePattern?: RegExp;
  minimumReaderPages?: number;
  readerImageAllowPatterns?: RegExp[];
  readerImageDenyPatterns?: RegExp[];
};

export const SINGLE_MANGA_SITE_CONFIGS: SingleMangaSiteConfig[] = [
  {
    sourceName: "Witch Hat Atelier Manga",
    baseUrl: "https://witchhatateliermanga.com/",
    canonicalTitle: "Witch Hat Atelier",
    aliases: [
      "witch hat atelier",
      "tongari booshi no atorie",
      "tongari boushi no atelier",
      "tongari boshi no atelier",
      "coco",
    ],
    status: "ONGOING",
    author: "Kamome Shirahama",
    fallbackDescription: "Read Witch Hat Atelier manga online.",
    fallbackCoverUrl: "https://witchhatateliermanga.com/wp-content/uploads/2024/10/Tongari-Booshi-No-Atorie.jpg",
    chapterUrlPattern: /witch-hat-atelier-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 1,
    readerImageDenyPatterns: [/tongari-booshi-no-atorie/i],
  },
  {
    sourceName: "Land of the Lustrous",
    baseUrl: "https://w1.land-of-the-lustrous.online/",
    canonicalTitle: "Houseki no Kuni",
    aliases: [
      "houseki no kuni",
      "houseki",
      "land of the lustrous",
      "lustrous",
      "phosphophyllite",
    ],
    status: "COMPLETED",
    author: "Haruko Ichikawa",
    fallbackDescription: "Read Land of the Lustrous manga online in high quality.",
    fallbackCoverUrl: "https://land-of-the-lustrous.online/wp-content/uploads/2023/12/EdYT8OLU4AUmCM8.jpg",
    chapterUrlPattern: /land-of-the-lustrous-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 1,
  },
  {
    sourceName: "Bleach Live",
    baseUrl: "https://w42.bleach.live/",
    canonicalTitle: "Bleach",
    aliases: ["bleach", "bleach manga", "bleach live", "ichigo"],
    status: "COMPLETED",
    author: "Tite Kubo",
    fallbackDescription: "Read Bleach Manga Online in High Quality.",
    fallbackCoverUrl: "https://bleach.live/wp-content/uploads/2022/11/ezgif-1-2666aed46a.jpg",
    chapterUrlPattern: /bleach-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /bleach\s*,?\s*chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 3,
  },
  {
    sourceName: "Blue Lock Manga",
    baseUrl: "https://w45.blue-lock-manga.com/",
    canonicalTitle: "Blue Lock",
    aliases: ["blue lock", "blue lock manga", "bluelock"],
    status: "ONGOING",
    author: "Muneyuki Kaneshiro",
    fallbackDescription: "Read Blue Lock manga online.",
    chapterUrlPattern: /blue-lock(?:-manga)?-chapter-(\d+)(?:-(\d+))?/i,
    chapterTitlePattern: /chapter\s+(\d+(?:\.\d+)?)/i,
    minimumReaderPages: 1,
  },
];

export const SINGLE_MANGA_SITE_SOURCE_NAMES = SINGLE_MANGA_SITE_CONFIGS.map((config) => config.sourceName.toLowerCase());

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

function normalizeValue(value: string) {
  return decodeHtml(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
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

function parseChapterNumber(value: string, config: SingleMangaSiteConfig): number | null {
  const match = value.match(config.chapterUrlPattern) ?? (config.chapterTitlePattern ? value.match(config.chapterTitlePattern) : null);
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

function isKnownContentImage(url: string, config: SingleMangaSiteConfig): boolean {
  const lower = url.toLowerCase();
  if (!/^https?:\/\//.test(lower)) return false;
  if (!/\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower)) return false;
  if (lower.includes("logo") || lower.includes("avatar") || lower.includes("emoji")) return false;
  if (lower.includes("/wp-content/themes/") || lower.includes("/wp-includes/")) return false;
  if (config.readerImageDenyPatterns?.some((pattern) => pattern.test(url))) return false;
  if (config.readerImageAllowPatterns?.length) {
    return config.readerImageAllowPatterns.some((pattern) => pattern.test(url));
  }
  return lower.includes("/wp-content/uploads/") || lower.includes("blogger.googleusercontent.com/img/");
}

export class SingleMangaSiteScraper implements Scraper {
  name = "Single Manga Sites";
  capabilities = { search: true, metadata: true, chapters: true, reader: true };

  canHandle(url: string): boolean {
    return Boolean(this.findConfigByUrl(url));
  }

  private findConfigByUrl(url: string): SingleMangaSiteConfig | undefined {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      return SINGLE_MANGA_SITE_CONFIGS.find((config) => new URL(config.baseUrl).hostname.replace(/^www\./, "").toLowerCase() === hostname);
    } catch {
      return SINGLE_MANGA_SITE_CONFIGS.find((config) => url.toLowerCase().includes(config.baseUrl.toLowerCase()));
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
    const normalizedQuery = normalizeValue(query);
    if (!normalizedQuery) return [];

    const matchedConfigs = SINGLE_MANGA_SITE_CONFIGS.filter((config) => (
      config.aliases.some((alias) => {
        const normalizedAlias = normalizeValue(alias);
        return normalizedAlias.includes(normalizedQuery) || normalizedQuery.includes(normalizedAlias);
      })
    ));

    const results = await Promise.all(matchedConfigs.map(async (config) => {
      try {
        const metadata = await this.fetchMetadata(config.baseUrl);
        return {
          title: metadata.title,
          description: metadata.description,
          coverUrl: metadata.coverUrl,
          status: metadata.status,
          author: metadata.author,
          sourceUrl: config.baseUrl,
          sourceName: config.sourceName,
        };
      } catch {
        return {
          title: config.canonicalTitle,
          description: config.fallbackDescription,
          coverUrl: config.fallbackCoverUrl,
          status: config.status,
          author: config.author,
          sourceUrl: config.baseUrl,
          sourceName: config.sourceName,
        };
      }
    }));

    return results;
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const config = this.findConfigByUrl(url);
    if (!config) throw new Error(`No single-manga site config found for URL: ${url}`);

    const html = await this.fetchHtml(url);
    return {
      title: config.canonicalTitle,
      description: getMeta(html, "description") ?? getMeta(html, "og:description") ?? config.fallbackDescription,
      coverUrl: getMeta(html, "twitter:image") ?? getMeta(html, "og:image") ?? config.fallbackCoverUrl,
      status: config.status,
      author: config.author,
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const config = this.findConfigByUrl(url);
    if (!config) throw new Error(`No single-manga site config found for URL: ${url}`);

    const html = await this.fetchHtml(url);
    const linkMatches = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const chapters = linkMatches.flatMap((match) => {
      const href = match[1];
      const text = decodeHtml(match[2]);
      const chapterNumber = parseChapterNumber(href, config) ?? parseChapterNumber(text, config);
      if (chapterNumber == null) return [];

      return [{
        providerChapterId: String(chapterNumber),
        chapterNumber,
        title: text || `${config.canonicalTitle} Chapter ${chapterNumber}`,
        url: new URL(href, config.baseUrl).toString(),
      }];
    });

    return uniqueByChapterNumber(chapters).sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async fetchReaderPages(chapter: ReaderChapterInput): Promise<ReaderResult> {
    const config = this.findConfigByUrl(chapter.url);
    if (!config) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "This single-manga source is not configured for the Mangateo reader.",
      };
    }

    const html = await this.fetchHtml(chapter.url);
    const pages = Array.from(html.matchAll(/<img\b[^>]*>/gi))
      .map((match) => {
        const tag = match[0];
        const imageUrl = getAttribute(tag, "data-src") ?? getAttribute(tag, "src");
        if (!imageUrl) return null;

        const absoluteUrl = new URL(imageUrl, config.baseUrl).toString();
        if (!isKnownContentImage(absoluteUrl, config)) return null;

        const width = Number(getAttribute(tag, "width"));
        const height = Number(getAttribute(tag, "height"));
        const page: ReaderPage = {
          index: 0,
          imageUrl: absoluteUrl,
        };
        if (Number.isFinite(width)) page.width = width;
        if (Number.isFinite(height)) page.height = height;

        return page;
      })
      .filter((page): page is ReaderPage => Boolean(page))
      .map((page, index) => ({ ...page, index }));

    if (pages.length < (config.minimumReaderPages ?? 1)) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: `${config.sourceName} did not expose readable public page images for this chapter.`,
      };
    }

    return {
      status: "READABLE",
      pages,
      externalUrl: chapter.url,
    };
  }
}
