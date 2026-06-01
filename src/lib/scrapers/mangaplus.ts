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

interface MangaPlusViewerView {
    currentChapter?: MangaPlusChapter;
}

interface MangaPlusJsonResponse {
    success?: {
        allTitlesViewV2?: {
            AllTitlesGroup?: MangaPlusTitleGroup[];
            allTitlesGroup?: MangaPlusTitleGroup[];
        };
        titleDetailView?: MangaPlusTitleDetailView;
        mangaViewer?: MangaPlusViewerView;
    };
    error?: unknown;
}

interface MangaPlusNamedTitle extends MangaPlusTitle {
    titleId: number;
    name: string;
}

function parseChapterNumber(name?: string): number | null {
    const match = name?.match(/#?\s*(\d+(?:\.\d+)?)/);
    if (!match) return null;

    const chapterNumber = Number(match[1]);
    return Number.isFinite(chapterNumber) ? chapterNumber : null;
}

function getPublicWindowChapters(groups: MangaPlusChapterGroup[]): MangaPlusChapter[] {
    return groups.flatMap((group) => [
        ...(group.firstChapterList ?? []),
        ...(group.lastChapterList ?? []),
    ]);
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

    private getTitleIdFromUrl(url: string): string | null {
        return url.match(/titles\/(\d+)/)?.[1] ?? null;
    }

    private getViewerChapterIdFromUrl(url: string): string | null {
        return url.match(/viewer\/(\d+)/)?.[1] ?? null;
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
        const viewerChapterId = this.getViewerChapterIdFromUrl(mangaUrl);
        if (viewerChapterId) {
            return this.fetchSingleViewerChapter(viewerChapterId);
        }

        const titleId = this.getTitleIdFromUrl(mangaUrl);
        if (!titleId) return [];

        const url = `${API_BASE}/title_detailV3?title_id=${titleId}`;

        try {
            const data = await this.fetchJson(url);
            const detail = data.success?.titleDetailView;

            if (!detail) return [];

            const publicChapters = getPublicWindowChapters(detail.chapterListGroup ?? []);

            return publicChapters
                .filter((chapter) => typeof chapter.chapterId === "number")
                .filter((chapter) => parseChapterNumber(chapter.name) !== null)
                .map((chapter) => {
                    const header = chapter.name || "";
                    const sub = chapter.subTitle || "";
                    const title = header && sub ? `${header}: ${sub}` : header || sub || `Chapter ${chapter.chapterId}`;
                    const num = parseChapterNumber(header) ?? 0;
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

    private async fetchSingleViewerChapter(chapterId: string): Promise<ScrapedChapter[]> {
        const url = `${API_BASE}/manga_viewer_v3?chapter_id=${chapterId}&split=yes&img_quality=high`;

        try {
            const data = await this.fetchJson(url);
            const chapter = data.success?.mangaViewer?.currentChapter;
            const chapterNumber = parseChapterNumber(chapter?.name);
            if (typeof chapter?.chapterId !== "number" || chapterNumber === null) return [];

            const header = chapter.name || "";
            const sub = chapter.subTitle || "";
            const title = header && sub ? `${header}: ${sub}` : header || sub || `Chapter ${chapter.chapterId}`;
            const releaseDate = chapter.startTimeStamp
                ? new Date(chapter.startTimeStamp * 1000)
                : undefined;

            return [{
                providerChapterId: String(chapter.chapterId),
                chapterNumber,
                title,
                url: `${this.baseUrl}/viewer/${chapter.chapterId}`,
                releaseDate,
            }];
        } catch (e) {
            console.error("MangaPlus viewer chapter failed:", e);
            return [];
        }
    }

    async fetchMetadata(mangaUrl: string): Promise<MangaMetadata> {
        const titleId = this.getTitleIdFromUrl(mangaUrl);
        if (!titleId) {
            const viewerChapterId = this.getViewerChapterIdFromUrl(mangaUrl);
            if (viewerChapterId) {
                return {
                    title: "MangaPlus",
                    description: `MangaPlus viewer chapter ${viewerChapterId}`,
                    status: "ONGOING",
                    author: "SHUEISHA",
                };
            }
            throw new Error("Invalid MangaPlus URL");
        }

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
