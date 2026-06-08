import { normalizeMangaStatus } from "@/lib/manga-status";
import { fetchWithRetry, ScraperRequestError } from "./http";
import { MangaMetadata, ReaderChapterInput, ReaderResult, ReaderSourceInput, ScrapedChapter, Scraper, SearchResult } from "./types";

const BASE_URL = "https://mangapill.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36";

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_match, codePoint: string) => String.fromCodePoint(Number(codePoint)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function toAbsoluteUrl(url: string, base = BASE_URL) {
  return new URL(decodeHtml(url), base).toString();
}

function getImageSrc(tag: string) {
  return tag.match(/\s(?:data-src|src)=["']([^"']+)["']/i)?.[1];
}

function getProxyImageUrl(imageUrl: string, referer: string) {
  const params = new URLSearchParams({
    url: imageUrl,
    referer,
  });
  return `/api/proxy/image?${params.toString()}`;
}

function isMangaPillReaderImage(url: string) {
  const lower = url.toLowerCase();
  return /^https?:\/\//.test(lower)
    && lower.includes("readdetectiveconan.com/file/mangap/")
    && /\.(?:jpe?g|png|webp)(?:\?|$)/.test(lower);
}

function extractStatus(html: string) {
  return html.match(/>\s*Status\s*<[\s\S]{0,200}?<div[^>]*>\s*([^<]+)\s*<\/div>/i)?.[1]?.trim();
}

function extractDescription(html: string) {
  const match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*class=["'][^"']*text-sm[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
    ?? html.match(/<h1[^>]*>[\s\S]*?<\/h1>([\s\S]*?)<label[^>]*>\s*Type\s*<\/label>/i);
  return match ? stripTags(match[1]).replace(/\(Source:[^)]+\)/i, "").trim() : undefined;
}

export class MangaPillScraper implements Scraper {
  name = "MangaPill";
  capabilities = { search: true, metadata: true, chapters: true, reader: true };

  canHandle(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      return hostname === "mangapill.com";
    } catch {
      return false;
    }
  }

  private getHeaders(referer = `${BASE_URL}/`) {
    return {
      "User-Agent": USER_AGENT,
      "Referer": referer,
    };
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const response = await fetchWithRetry(`${BASE_URL}/search?q=${encodeURIComponent(query)}`, {
        headers: this.getHeaders(),
      });
      const html = await response.text();
      const links = Array.from(html.matchAll(/<a[^>]+href=["'](\/manga\/\d+\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
      const resultsByUrl = new Map<string, SearchResult>();

      for (const link of links) {
        const sourceUrl = toAbsoluteUrl(link[1]);
        const title = stripTags(link[2].replace(/<figure[\s\S]*?<\/figure>/gi, " "));
        const existing = resultsByUrl.get(sourceUrl);
        const coverMatch = link[2].match(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/i);

        resultsByUrl.set(sourceUrl, {
          title: title || existing?.title || "",
          sourceUrl,
          sourceName: this.name,
          coverUrl: existing?.coverUrl ?? (coverMatch?.[1] ? toAbsoluteUrl(coverMatch[1], sourceUrl) : undefined),
        });
      }

      return Array.from(resultsByUrl.values()).filter((result) => result.title).slice(0, 10);
    } catch (error) {
      if (error instanceof ScraperRequestError) {
        console.error(`[${this.name}] Search failed (${error.kind})`);
      }
      return [];
    }
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const response = await fetchWithRetry(url, { headers: this.getHeaders(url) });
    const html = await response.text();
    const title = html.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/i)?.[1]?.trim() ?? "Unknown";
    const coverUrl = html.match(/<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]+alt=["'][^"']*["']/i)?.[1]
      ?? html.match(/<img[^>]+alt=["'][^"']*["'][^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1];

    return {
      title: decodeHtml(title),
      description: extractDescription(html),
      coverUrl: coverUrl ? toAbsoluteUrl(coverUrl, url) : undefined,
      status: normalizeMangaStatus(extractStatus(html), "ONGOING"),
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const response = await fetchWithRetry(url, { headers: this.getHeaders(url) });
    const html = await response.text();
    const seen = new Set<string>();

    return Array.from(html.matchAll(/href=["'](\/chapters\/([^"']*?chapter-([\d.]+))[^"']*)["']/gi))
      .map((match) => {
        const chapterUrl = toAbsoluteUrl(match[1], url);
        return {
          providerChapterId: match[2],
          chapterNumber: Number(match[3]),
          title: `Chapter ${match[3]}`,
          url: chapterUrl,
        };
      })
      .filter((chapter) => {
        if (!Number.isFinite(chapter.chapterNumber) || seen.has(chapter.url)) return false;
        seen.add(chapter.url);
        return true;
      })
      .sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async fetchReaderPages(chapter: ReaderChapterInput, source: ReaderSourceInput): Promise<ReaderResult> {
    try {
      const response = await fetchWithRetry(chapter.url, {
        headers: this.getHeaders(source.sourceUrl),
        timeoutMs: 10_000,
        retries: 1,
      });
      const html = await response.text();
      const pages = Array.from(html.matchAll(/<img\b[^>]*>/gi))
        .map((match) => getImageSrc(match[0]))
        .filter((url): url is string => Boolean(url))
        .map((url) => toAbsoluteUrl(url, chapter.url))
        .filter(isMangaPillReaderImage);

      if (pages.length === 0) {
        return {
          status: "EXTERNAL_ONLY",
          pages: [],
          externalUrl: chapter.url,
          reason: "MangaPill did not expose public page images for this chapter.",
        };
      }

      return {
        status: "READABLE",
        pages: pages.map((imageUrl, index) => ({
          index,
          imageUrl: getProxyImageUrl(imageUrl, chapter.url),
        })),
        externalUrl: chapter.url,
      };
    } catch (error) {
      const isBlocked = error instanceof ScraperRequestError && error.kind === "blocked";
      return {
        status: isBlocked ? "BLOCKED" : "ERROR",
        pages: [],
        externalUrl: chapter.url,
        reason: isBlocked
          ? "MangaPill blocked Mangateo from loading this chapter directly."
          : "MangaPill reader pages could not be loaded.",
      };
    }
  }
}
