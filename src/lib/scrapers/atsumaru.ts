import { MangaMetadata, ReaderChapterInput, ReaderPage, ReaderResult, ScrapedChapter, Scraper, SearchResult } from "./types";
import { fetchWithRetry } from "./http";

const ATSUMARU_BASE = "https://atsu.moe";

interface AtsumaruMangaPageResponse {
  mangaPage?: {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    poster?: string | { url?: string };
    cover?: string | { url?: string };
    authors?: Array<{ name?: string; type?: string }>;
  };
}

interface AtsumaruChapter {
  id?: string;
  title?: string;
  number?: number;
  createdAt?: number | string;
}

interface AtsumaruChaptersResponse {
  chapters?: AtsumaruChapter[];
}

interface AtsumaruReadChapterResponse {
  readChapter?: AtsumaruChapter & {
    pages?: Array<{
      image?: string;
      number?: number;
      width?: number;
      height?: number;
    }>;
  };
}

function getAtsumaruIds(url: string): { mangaId: string; chapterId?: string } | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "read" && parts[1]) {
      return { mangaId: parts[1], chapterId: parts[2] };
    }
    if (parts[0] === "manga" && parts[1]) {
      return { mangaId: parts[1] };
    }
    const mangaId = parsed.searchParams.get("mangaId") ?? parsed.searchParams.get("id");
    return mangaId ? { mangaId } : null;
  } catch {
    return null;
  }
}

function getImageUrl(value?: string | { url?: string }) {
  if (!value) return undefined;
  const url = typeof value === "string" ? value : value.url;
  if (!url) return undefined;
  return new URL(url, ATSUMARU_BASE).toString();
}

function parseChapterNumber(chapter: AtsumaruChapter): number | null {
  if (typeof chapter.number === "number" && Number.isFinite(chapter.number)) return chapter.number;
  const match = chapter.title?.match(/(?:chapter|ch\.?|version|punch)?\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const chapterNumber = Number(match[1]);
  return Number.isFinite(chapterNumber) ? chapterNumber : null;
}

function getReleaseDate(value?: number | string) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string" && value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function mapChapter(mangaId: string, chapter: AtsumaruChapter): ScrapedChapter | null {
  if (!chapter.id) return null;
  const chapterNumber = parseChapterNumber(chapter);
  if (chapterNumber === null) return null;

  return {
    providerChapterId: chapter.id,
    chapterNumber,
    title: chapter.title ?? `Chapter ${chapterNumber}`,
    url: `${ATSUMARU_BASE}/read/${mangaId}/${chapter.id}`,
    releaseDate: getReleaseDate(chapter.createdAt),
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchWithRetry(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*",
      "Referer": ATSUMARU_BASE,
    },
    timeoutMs: 12_000,
    retries: 1,
  });
  return response.json() as Promise<T>;
}

export class AtsumaruScraper implements Scraper {
  name = "Atsumaru";
  capabilities = { search: false, metadata: true, chapters: true, reader: true };

  canHandle(url: string): boolean {
    return url.includes("atsu.moe");
  }

  async fetchMetadata(url: string): Promise<MangaMetadata> {
    const ids = getAtsumaruIds(url);
    if (!ids) throw new Error("Invalid Atsumaru URL");

    const data = await fetchJson<AtsumaruMangaPageResponse>(
      `${ATSUMARU_BASE}/api/manga/page?id=${encodeURIComponent(ids.mangaId)}`,
    );
    const page = data.mangaPage;
    if (!page?.title) throw new Error("Atsumaru manga metadata not found");

    const authorNames = page.authors
      ?.filter((author) => author.name)
      .map((author) => author.name)
      .join(", ");

    return {
      title: page.title,
      description: page.description,
      coverUrl: getImageUrl(page.poster) ?? getImageUrl(page.cover),
      status: page.status,
      author: authorNames,
    };
  }

  async fetchChapters(url: string): Promise<ScrapedChapter[]> {
    const ids = getAtsumaruIds(url);
    if (!ids) return [];

    const chapterMap = new Map<string, ScrapedChapter>();
    const addChapter = (chapter: ScrapedChapter | null) => {
      if (!chapter) return;
      chapterMap.set(chapter.providerChapterId ?? String(chapter.chapterNumber), chapter);
    };

    const list = await fetchJson<AtsumaruChaptersResponse>(
      `${ATSUMARU_BASE}/api/manga/allChapters?mangaId=${encodeURIComponent(ids.mangaId)}`,
    );
    for (const chapter of list.chapters ?? []) {
      addChapter(mapChapter(ids.mangaId, chapter));
    }

    if (ids.chapterId) {
      const linkedChapter = await fetchJson<AtsumaruReadChapterResponse>(
        `${ATSUMARU_BASE}/api/read/chapter?mangaId=${encodeURIComponent(ids.mangaId)}&chapterId=${encodeURIComponent(ids.chapterId)}`,
      );
      addChapter(mapChapter(ids.mangaId, linkedChapter.readChapter ?? { id: ids.chapterId }));
    }

    return Array.from(chapterMap.values()).sort((a, b) => b.chapterNumber - a.chapterNumber);
  }

  async search(query: string): Promise<SearchResult[]> {
    void query;
    return [];
  }

  async fetchReaderPages(chapter: ReaderChapterInput): Promise<ReaderResult> {
    const ids = getAtsumaruIds(chapter.url);
    const chapterId = ids?.chapterId ?? chapter.providerChapterId;
    if (!ids?.mangaId || !chapterId) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "Atsumaru chapter URL is missing a manga or chapter id.",
      };
    }

    const data = await fetchJson<AtsumaruReadChapterResponse>(
      `${ATSUMARU_BASE}/api/read/chapter?mangaId=${encodeURIComponent(ids.mangaId)}&chapterId=${encodeURIComponent(chapterId)}`,
    );
    const pages = (data.readChapter?.pages ?? [])
      .filter((page) => page.image)
      .map((page, index): ReaderPage => {
        const readerPage: ReaderPage = {
          index,
          imageUrl: new URL(page.image ?? "", ATSUMARU_BASE).toString(),
        };
        if (typeof page.width === "number") readerPage.width = page.width;
        if (typeof page.height === "number") readerPage.height = page.height;
        return readerPage;
      });

    if (pages.length === 0) {
      return {
        status: "EXTERNAL_ONLY",
        pages: [],
        externalUrl: chapter.url,
        reason: "Atsumaru did not return readable page images for this chapter.",
      };
    }

    return {
      status: "READABLE",
      pages,
      externalUrl: chapter.url,
    };
  }
}
