import { Scraper, SearchResult, ScrapedChapter, MangaMetadata } from "./types";
import { fetchWithRetry, ScraperRequestError } from "./http";

const API_BASE = "https://jumpg-webapi.tokyo-cdn.com/api";

interface MangaPlusTitle {
    titleId?: number;
    name?: string;
    author?: string;
    portraitImageUrl?: string;
    language?: string;
}

interface MangaPlusTitleGroup {
    titles?: MangaPlusTitle[];
}

interface MangaPlusChapter {
    chapterId?: number;
    name?: string;
    subTitle?: string;
    startTimeStamp?: number;
}

interface MangaPlusChapterGroup {
    firstChapterList?: MangaPlusChapter[];
    midChapterList?: MangaPlusChapter[];
    lastChapterList?: MangaPlusChapter[];
}

interface MangaPlusTitleDetailView {
    title?: MangaPlusTitle;
    overview?: string;
    chapterListGroup?: MangaPlusChapterGroup[];
}

interface MangaPlusJsonResponse {
    success?: {
        allTitlesViewV2?: {
            AllTitlesGroup?: MangaPlusTitleGroup[];
            allTitlesGroup?: MangaPlusTitleGroup[];
        };
        titleDetailView?: MangaPlusTitleDetailView;
    };
}

interface MangaPlusNamedTitle extends MangaPlusTitle {
    titleId: number;
    name: string;
}

export class MangaPlusScraper implements Scraper {
    name = "MangaPlus";
    capabilities = { search: true, metadata: true, chapters: true };
    baseUrl = "https://mangaplus.shueisha.co.jp";

    canHandle(url: string): boolean {
        return url.includes("mangaplus.shueisha.co.jp");
    }

    private async fetchJson(url: string): Promise<MangaPlusJsonResponse> {
        try {
            const separator = url.includes("?") ? "&" : "?";
            const res = await fetchWithRetry(`${url}${separator}format=json`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                    "Accept": "application/json, text/plain, */*"
                }
            });

            return await res.json() as MangaPlusJsonResponse;
        } catch (e) {
            if (e instanceof ScraperRequestError) {
                throw new ScraperRequestError(`MangaPlus request failed (${e.kind})`, e.kind, e.status, { cause: e });
            }
            throw new ScraperRequestError("MangaPlus response parse failed", "parsing", undefined, { cause: e as Error });
        }
    }

    async search(query: string): Promise<SearchResult[]> {
        const url = `${API_BASE}/title_list/allV2`;
        try {
            const data = await this.fetchJson(url);
            const groups = data.success?.allTitlesViewV2?.AllTitlesGroup
                ?? data.success?.allTitlesViewV2?.allTitlesGroup
                ?? [];
            const titles = groups.flatMap((group) => group.titles ?? []);

            const matchingTitles = titles.filter((title): title is MangaPlusNamedTitle =>
                typeof title.titleId === "number"
                && typeof title.name === "string"
                && title.name.toLowerCase().includes(query.toLowerCase())
                && (!title.language || title.language === "ENGLISH")
            );

            return matchingTitles
                .slice(0, 5)
                .map((title) => ({
                    title: title.name,
                    sourceUrl: `${this.baseUrl}/titles/${title.titleId}`,
                    sourceName: "MangaPlus",
                    coverUrl: title.portraitImageUrl,
                    status: "ONGOING",
                    author: title.author,
                    description: "",
                }));

        } catch (e) {
            console.error("MangaPlus search failed:", e);
            return [];
        }
    }

    async fetchChapters(mangaUrl: string): Promise<ScrapedChapter[]> {
        const match = mangaUrl.match(/titles\/(\d+)/);
        if (!match) return [];
        const titleId = match[1];

        const url = `${API_BASE}/title_detailV3?title_id=${titleId}`;

        try {
            const data = await this.fetchJson(url);
            const detail = data.success?.titleDetailView;

            if (!detail) return [];

            const allChapters = (detail.chapterListGroup ?? []).flatMap((group) => [
                ...(group.firstChapterList ?? []),
                ...(group.midChapterList ?? []),
                ...(group.lastChapterList ?? []),
            ]);

            return allChapters
                .filter((chapter) => typeof chapter.chapterId === "number")
                .map((chapter) => {
                    const header = chapter.name || "";
                    const sub = chapter.subTitle || "";
                    const title = header && sub ? `${header}: ${sub}` : header || sub || `Chapter ${chapter.chapterId}`;
                    const num = parseFloat(header.replace("#", "")) || chapter.chapterId || 0;
                    const releaseDate = chapter.startTimeStamp
                        ? new Date(chapter.startTimeStamp * 1000)
                        : undefined;

                    return {
                        providerChapterId: String(chapter.chapterId),
                        chapterNumber: num,
                        title,
                        url: `${this.baseUrl}/viewer/${chapter.chapterId}`,
                        releaseDate,
                    };
                });
        } catch (e) {
            console.error("MangaPlus chapters failed:", e);
            return [];
        }
    }

    async fetchMetadata(mangaUrl: string): Promise<MangaMetadata> {
        const match = mangaUrl.match(/titles\/(\d+)/);
        if (!match) throw new Error("Invalid MangaPlus URL");
        const titleId = match[1];

        const url = `${API_BASE}/title_detailV3?title_id=${titleId}`;
        const data = await this.fetchJson(url);
        const detail = data.success?.titleDetailView;

        if (!detail?.title?.name) throw new Error("Manga not found");

        return {
            title: detail.title.name,
            coverUrl: detail.title.portraitImageUrl,
            description: detail.overview,
            status: "ONGOING",
            author: detail.title.author || ""
        };
    }
}
