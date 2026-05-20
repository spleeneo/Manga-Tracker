import { MangaMetadata, ScrapedChapter, Scraper, SearchResult } from "./types";
import { fetchWithRetry } from "./http";

const VIZ_BASE_URL = "https://www.viz.com";
const SERIES_INDEX_URL = `${VIZ_BASE_URL}/search/series_titles.js`;

interface VizSeriesSuggestion {
  title?: string;
  subtitle?: string;
  vanityurl?: string;
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
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, property: string): string | undefined {
  const pattern = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function extractFirst(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function parseChapterNumber(text: string): number | null {
  const match = text.match(/(?:chapter|ch\.?|#)\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const chapterNumber = Number(match[1]);
  return Number.isFinite(chapterNumber) ? chapterNumber : null;
}

function toAbsoluteVizUrl(url: string): string {
  return new URL(url, VIZ_BASE_URL).toString();
}

export class VizScraper implements Scraper {
  name = "VIZ";
  capabilities = { search: true, metadata: true, chapters: true };

  canHandle(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith("viz.com");
    } catch {
      return url.includes("viz.com");
    }
  }

  private async fetchText(url: string): Promise<string> {
    const response = await fetchWithRetry(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeoutMs: 10_000,
      retries: 1,
    });

    return response.text();
  }

  private async fetchSeriesIndex(): Promise<VizSeriesSuggestion[]> {
    const body = await this.fetchText(SERIES_INDEX_URL);
    const match = body.match(/var\s+series_suggestions\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];

    try {
      const suggestions = JSON.parse(match[1]) as VizSeriesSuggestion[];
      return suggestions.filter((item) => item.title && item.vanityurl);
    } catch (error) {
      console.error("VIZ series index parse failed:", error);
      return [];
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    try {
      const suggestions = await this.fetchSeriesIndex();
      return suggestions
        .filter((item) => {
          const title = item.title?.toLowerCase() ?? "";
          const subtitle = item.subtitle?.toLowerCase() ?? "";
          const slug = item.vanityurl?.toLowerCase() ?? "";
          return title.includes(normalizedQuery)
            || subtitle.includes(normalizedQuery)
            || slug.includes(normalizedQuery.replace(/\s+/g, "-"));
        })
        .sort((a, b) => {
          const aExact = a.title?.toLowerCase() === normalizedQuery ? 0 : 1;
          const bExact = b.title?.toLowerCase() === normalizedQuery ? 0 : 1;
          return aExact - bExact;
        })
        .slice(0, 5)
        .map((item) => ({
          title: item.title ?? "Untitled",
          description: item.subtitle,
          sourceUrl: toAbsoluteVizUrl(`/${item.vanityurl}`),
          sourceName: "VIZ",
        }));
    } catch (error) {
      console.error("VIZ search failed:", error);
      return [];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const html = await this.fetchText(url);
    const title = extractFirst(html, /<h2[^>]*id=["']page_title["'][^>]*>([\s\S]*?)<\/h2>/i)
      ?? extractMeta(html, "og:title")?.replace(/^VIZ:\s*(?:The Official Website for\s*)?/i, "")
      ?? "VIZ manga";

    const description = extractFirst(html, /<section[^>]*id=["']series-intro["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
      ?? extractMeta(html, "og:description");
    const coverUrl = extractMeta(html, "og:image")
      ?? extractFirst(html, /<img[^>]+class=["'][^"']*o_hero-media[^"']*["'][^>]+src=["']([^"']+)["']/i);
    const author = extractFirst(html, /Created by\s*([^<]+)/i);

    return {
      title,
      description,
      coverUrl,
      author,
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    try {
      const html = await this.fetchText(url);
      const chapters = new Map<number, ScrapedChapter>();
      const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

      for (const match of html.matchAll(anchorPattern)) {
        const href = match[1];
        const label = decodeHtml(match[2]);
        const chapterNumber = parseChapterNumber(label) ?? parseChapterNumber(href);

        if (chapterNumber === null || !href.includes("/read/")) continue;
        if (!chapters.has(chapterNumber)) {
          chapters.set(chapterNumber, {
            chapterNumber,
            title: label || `Chapter ${chapterNumber}`,
            url: toAbsoluteVizUrl(href),
          });
        }
      }

      return Array.from(chapters.values()).sort((a, b) => b.chapterNumber - a.chapterNumber);
    } catch (error) {
      console.error("VIZ chapters failed:", error);
      return [];
    }
  }
}
