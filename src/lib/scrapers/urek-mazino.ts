import { fetchWithRetry } from "./http";
import { MangaMetadata, ReaderPage, ReaderResult, ScrapedChapter, Scraper, SearchResult } from "./types";

const BASE_URL = "https://urekmazino.com";

interface JsonLdItemList {
  "@type"?: string;
  itemListElement?: Array<{
    url?: string;
    name?: string;
  }>;
}

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

function getNuxtConfigValue(html: string, key: string): string | undefined {
  const match = html.match(new RegExp(`${key}:["']([^"']+)["']`));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function parseChapterNumber(value: string): number | null {
  const match = value.match(/(?:chapter\/|chapter\s+|^)(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const number = Number(match[1]);
  return Number.isFinite(number) ? number : null;
}

function parseReleaseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toAbsoluteUrl(url: string): string {
  return new URL(url, BASE_URL).toString();
}

function getAttribute(tag: string, attribute: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${attribute}=["']([^"']+)["']`, "i"));
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function isReaderImage(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.startsWith("https://assets.urekmazino.com/urekmazino/chapter-")
    && /\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower)
    && !lower.includes("/thumb.");
}

function parseJsonLdItemLists(html: string): JsonLdItemList[] {
  return Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(match[1]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    })
    .filter((item): item is JsonLdItemList => item?.["@type"] === "ItemList");
}

export class UrekMazinoScraper implements Scraper {
  name = "Urek Mazino";
  capabilities = { search: true, metadata: true, chapters: true, reader: true };

  canHandle(url: string): boolean {
    try {
      return new URL(url).hostname === "urekmazino.com";
    } catch {
      return url.includes("urekmazino.com");
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
      "urek",
      "urek mazino",
      "tower of god urek",
      "tower of god: urek mazino",
      "tower of god sidestory",
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
        title: "Urek Mazino: Tower of God",
        description: "Tower of God side story focused on Urek Mazino.",
        coverUrl: `${BASE_URL}/og-image.png`,
        status: "ONGOING",
        author: "SIU",
        sourceUrl: BASE_URL,
        sourceName: this.name,
      }];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const html = await this.fetchHtml(url);
    const title = getNuxtConfigValue(html, "main_page_display_title")
      ?? getMeta(html, "og:title")
      ?? "Urek Mazino: Tower of God";

    return {
      title,
      description: getMeta(html, "description") ?? getMeta(html, "og:description"),
      coverUrl: getMeta(html, "og:image") ?? `${BASE_URL}/og-image.png`,
      status: html.includes("IS_FINISHED:true") ? "COMPLETED" : "ONGOING",
      author: "SIU",
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const html = await this.fetchHtml(url);
    const latestId = html.match(/LATEST_CHAPTER:\{id:["'](\d+(?:\.\d+)?)["'],releaseDate:["']([^"']+)["']\}/)?.[1];
    const latestDate = parseReleaseDate(
      html.match(/LATEST_CHAPTER:\{id:["']\d+(?:\.\d+)?["'],releaseDate:["']([^"']+)["']\}/)?.[1]
    );

    const itemList = parseJsonLdItemLists(html).find((item) => item.itemListElement?.length);
    const items = itemList?.itemListElement ?? [];

    return items.flatMap((item) => {
      if (!item.url || !item.name || /unreleased/i.test(item.name)) return [];

      const chapterNumber = parseChapterNumber(item.url) ?? parseChapterNumber(item.name);
      if (chapterNumber == null) return [];

      const title = decodeHtml(item.name.replace(/^Urek Mazino\s+/i, ""));
      return [{
        providerChapterId: String(chapterNumber),
        chapterNumber,
        title,
        url: toAbsoluteUrl(item.url),
        releaseDate: latestId === String(chapterNumber) ? latestDate : undefined,
      }];
    }).sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async fetchReaderPages(chapter: { url: string }): Promise<ReaderResult> {
    const html = await this.fetchHtml(chapter.url);
    const pages = Array.from(html.matchAll(/<img\b[^>]*>/gi))
      .map((match) => {
        const tag = match[0];
        const imageUrl = getAttribute(tag, "src");
        if (!imageUrl) return null;

        const absoluteUrl = toAbsoluteUrl(imageUrl);
        if (!isReaderImage(absoluteUrl)) return null;

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

    if (pages.length === 0) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "Urek Mazino did not expose public page images for this chapter.",
      };
    }

    return {
      status: "READABLE",
      pages,
      externalUrl: chapter.url,
    };
  }
}
