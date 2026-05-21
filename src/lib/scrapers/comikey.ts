import { MangaMetadata, ScrapedChapter, Scraper, SearchResult } from "./types";
import { fetchWithRetry } from "./http";
import { normalizeMangaStatus } from "@/lib/manga-status";

const COMIKEY_BASE_URL = "https://comikey.com";
const COMIKEY_GUNDAM_API = "https://gundam.comikey.net";

interface ComikeyPerson {
  name?: string;
}

interface ComikeyComicData {
  id?: number;
  link?: string;
  name?: string;
  uslug?: string;
  author?: ComikeyPerson[];
  artist?: ComikeyPerson[];
  description?: string;
  excerpt?: string;
  chapter_title?: string;
  format?: number;
  cover?: string;
  thumbnail?: string;
  wallpaper?: string;
  removed?: boolean;
}

interface ComikeyEpisode {
  id?: string;
  number?: number;
  releasedAt?: string;
  title?: string;
  subtitle?: string;
}

interface ComikeyEpisodeResponse {
  episodes?: ComikeyEpisode[];
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

function extractMeta(html: string, property: string): string | undefined {
  const pattern = new RegExp(`<meta\\s+[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i");
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

function toAbsoluteComikeyUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return new URL(url, COMIKEY_BASE_URL).toString();
}

function extractComicId(url: string): number | null {
  const match = url.match(/\/comics\/[^/]+\/(\d+)\/?/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

function parseChapterNumber(value?: string): number | null {
  const match = value?.match(/(?:chapter|episode|ch\.?|#)\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;

  const chapterNumber = Number(match[1]);
  return Number.isFinite(chapterNumber) ? chapterNumber : null;
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function buildChapterTitle(episode: ComikeyEpisode, chapterNumber: number) {
  const title = decodeHtml(episode.title ?? "");
  const subtitle = decodeHtml(episode.subtitle ?? "");

  if (title && subtitle) return `${title}: ${subtitle}`;
  return title || subtitle || `Chapter ${chapterNumber}`;
}

function buildEpisodeUrl(comic: ComikeyComicData, episode: ComikeyEpisode, chapterNumber: number) {
  const id = episode.id?.replace(/^EPI-/i, "");
  const slug = comic.uslug;
  const prefix = comic.format === 2 ? "episode" : "chapter";
  if (!id || !slug) return undefined;

  return `${COMIKEY_BASE_URL}/read/${slug}/${id}/${prefix}-${String(chapterNumber).replace(".", "-")}/`;
}

function extractComicData(html: string): ComikeyComicData | null {
  const match = html.match(/<script\s+id=["']comic["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as ComikeyComicData;
  } catch (error) {
    console.error("Comikey comic data parse failed:", error);
    return null;
  }
}

export class ComikeyScraper implements Scraper {
  name = "Comikey";
  capabilities = { search: true, metadata: true, chapters: true };

  canHandle(url: string): boolean {
    try {
      return new URL(url).hostname.endsWith("comikey.com");
    } catch {
      return url.includes("comikey.com");
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

  private async fetchEpisodes(comicId: number): Promise<ComikeyEpisode[]> {
    const response = await fetchWithRetry(`${COMIKEY_GUNDAM_API}/comic.public/${comicId}/episodes?language=en`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "application/json",
        "Origin": COMIKEY_BASE_URL,
        "Referer": `${COMIKEY_BASE_URL}/`,
      },
      timeoutMs: 10_000,
      retries: 1,
    });

    const data = await response.json() as ComikeyEpisodeResponse;
    return data.episodes ?? [];
  }

  async search(query: string): Promise<SearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    try {
      const html = await this.fetchText(`${COMIKEY_BASE_URL}/comics/?q=${encodeURIComponent(query)}`);
      const cards = Array.from(html.matchAll(/<li\b[^>]*class=["'][^"']*item-preview[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi));
      const seen = new Set<string>();

      return cards.flatMap((card) => {
        const body = card[1];
        const href = body.match(/<span\s+class=["']title["'][\s\S]*?<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!href) return [];

        const sourceUrl = toAbsoluteComikeyUrl(href[1]);
        const title = decodeHtml(href[2]);
        if (!sourceUrl || !title || seen.has(sourceUrl)) return [];
        seen.add(sourceUrl);

        const lowerTitle = title.toLowerCase();
        if (!lowerTitle.includes(normalizedQuery)) return [];

        const coverUrl = body.match(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']Thumbnail for/i)?.[1]
          ?? body.match(/<img[^>]+alt=["']Thumbnail for[^"']*["'][^>]+src=["']([^"']+)["']/i)?.[1];
        const author = decodeHtml(body.match(/<span\s+class=["']subtitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "")
          .replace(/^by\s+/i, "");

        return [{
          title,
          sourceUrl,
          sourceName: this.name,
          coverUrl: toAbsoluteComikeyUrl(coverUrl),
          author: author || undefined,
        }];
      }).slice(0, 5);
    } catch (error) {
      console.error("Comikey search failed:", error);
      return [];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const html = await this.fetchText(url);
    const comic = extractComicData(html);
    const title = comic?.name
      ?? extractMeta(html, "og:title")?.replace(/\s*\([^)]*\)\s*\|\s*Read Free.*$/i, "")
      ?? "Comikey manga";

    const people = [
      ...(comic?.author ?? []),
      ...(comic?.artist ?? []),
    ].map((person) => person.name).filter(Boolean);

    return {
      title,
      description: comic?.description ?? comic?.excerpt ?? extractMeta(html, "description") ?? extractMeta(html, "og:description"),
      coverUrl: toAbsoluteComikeyUrl(comic?.cover ?? comic?.thumbnail ?? comic?.wallpaper) ?? extractMeta(html, "og:image"),
      status: normalizeMangaStatus(comic?.removed ? "ENDED" : "ONGOING"),
      author: people.length > 0 ? Array.from(new Set(people)).join(" | ") : undefined,
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    try {
      const html = await this.fetchText(url);
      const comic = extractComicData(html);
      const comicId = comic?.id ?? extractComicId(url);
      if (!comicId || !comic) return [];

      const episodes = await this.fetchEpisodes(comicId);
      return episodes.flatMap((episode) => {
        const chapterNumber = episode.number ?? parseChapterNumber(episode.title);
        if (chapterNumber == null) return [];
        const releaseDate = parseDate(episode.releasedAt);
        if (releaseDate && releaseDate.getTime() > Date.now()) return [];

        const chapterUrl = buildEpisodeUrl(comic, episode, chapterNumber);
        if (!chapterUrl) return [];

        return [{
          providerChapterId: episode.id,
          chapterNumber,
          title: buildChapterTitle(episode, chapterNumber),
          url: chapterUrl,
          releaseDate,
        }];
      }).sort((a, b) => b.chapterNumber - a.chapterNumber);
    } catch (error) {
      console.error("Comikey chapters failed:", error);
      return [];
    }
  }
}
