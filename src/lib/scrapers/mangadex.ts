import { ScrapedChapter, Scraper, MangaMetadata, SearchResult, ReaderChapterInput, ReaderResult, ReaderSourceInput } from "./types";
import { fetchWithRetry, ScraperRequestError } from "./http";

interface MangaDexRelationship {
    type: string;
    attributes?: {
        fileName?: string;
        name?: string;
    };
}

interface MangaDexTitleItem {
    id: string;
    attributes: {
        title: Record<string, string>;
        description: Record<string, string>;
        status?: string;
    };
    relationships: MangaDexRelationship[];
}

interface MangaDexChapterItem {
    id: string;
    attributes: {
        chapter: string;
        title?: string;
        publishAt: string;
    };
}

interface MangaDexFeedResponse {
    data: MangaDexChapterItem[];
    limit?: number;
    offset?: number;
    total?: number;
}

interface MangaDexAtHomeResponse {
    baseUrl: string;
    chapter: {
        hash: string;
        data: string[];
        dataSaver?: string[];
    };
}

export class MangaDexScraper implements Scraper {
    name = "MangaDex";
    capabilities = { search: true, metadata: true, chapters: true, reader: true };

    canHandle(url: string): boolean {
        return url.includes("mangadex.org");
    }

    private extractId(url: string): string | null {
        const match = url.match(/title\/([0-9a-fA-F-]{36})/);
        return match ? match[1] : null;
    }

    private async getCoverUrl(mangaId: string, coverRelId: string | undefined): Promise<string | undefined> {
        if (!coverRelId) return undefined;
        try {
            const res = await fetchWithRetry(`https://api.mangadex.org/cover/${coverRelId}`);
            if (!res.ok) return undefined;
            const data = await res.json();
            const fileName = data.data.attributes.fileName;
            return `https://uploads.mangadex.org/covers/${mangaId}/${fileName}`;
        } catch {
            return undefined;
        }
    }

    async fetchChapters(url: string): Promise<ScrapedChapter[]> {
        const mangaId = this.extractId(url);
        if (!mangaId) throw new Error("Could not extract MangaDex ID from URL");

        const limit = 100;
        let offset = 0;
        const chapters: ScrapedChapter[] = [];

        while (true) {
            const feedUrl = `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=${limit}&offset=${offset}`;
            const res = await fetchWithRetry(feedUrl);
            const data = await res.json() as MangaDexFeedResponse;
            const page = data.data ?? [];

            chapters.push(...page.map((item) => ({
                providerChapterId: item.id,
                chapterNumber: parseFloat(item.attributes.chapter),
                title: item.attributes.title || `Chapter ${item.attributes.chapter}`,
                url: `https://mangadex.org/chapter/${item.id}`,
                releaseDate: new Date(item.attributes.publishAt),
            })).filter((chapter) => Number.isFinite(chapter.chapterNumber)));

            const nextOffset = offset + (data.limit ?? limit);
            const total = data.total ?? chapters.length;
            if (page.length === 0 || nextOffset >= total) break;
            offset = nextOffset;
        }

        return chapters;
    }

    async fetchMetadata(url: string): Promise<MangaMetadata> {
        const mangaId = this.extractId(url);
        if (!mangaId) throw new Error("Invalid MangaDex URL");

        const res = await fetchWithRetry(`https://api.mangadex.org/manga/${mangaId}?includes[]=cover_art&includes[]=author`);
        const data = await res.json();
        const manga = data.data;

        const coverArt = (manga.relationships as MangaDexRelationship[]).find((r) => r.type === "cover_art");
        const fileName = coverArt?.attributes?.fileName;
        const author = (manga.relationships as MangaDexRelationship[]).find((r) => r.type === "author")?.attributes?.name;

        return {
            title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
            description: manga.attributes.description.en || Object.values(manga.attributes.description)[0],
            coverUrl: fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : undefined,
            status: manga.attributes.status?.toUpperCase(),
            author: author
        };
    }

    async fetchReaderPages(chapter: ReaderChapterInput, _sourceInput: ReaderSourceInput): Promise<ReaderResult> {
        void _sourceInput;
        if (!chapter.providerChapterId) {
            return {
                status: "UNSUPPORTED",
                pages: [],
                externalUrl: chapter.url,
                reason: "This MangaDex chapter is missing its provider chapter id.",
            };
        }

        try {
            const res = await fetchWithRetry(`https://api.mangadex.org/at-home/server/${chapter.providerChapterId}`);
            if (!res.ok) {
                return {
                    status: res.status === 403 ? "BLOCKED" : "ERROR",
                    pages: [],
                    externalUrl: chapter.url,
                    reason: `MangaDex reader returned ${res.status}.`,
                };
            }

            const data = await res.json() as MangaDexAtHomeResponse;
            const files = data.chapter?.data ?? [];
            if (!data.baseUrl || !data.chapter?.hash || files.length === 0) {
                return {
                    status: "EXTERNAL_ONLY",
                    pages: [],
                    externalUrl: chapter.url,
                    reason: "MangaDex did not return readable page images for this chapter.",
                };
            }

            return {
                status: "READABLE",
                externalUrl: chapter.url,
                pages: files.map((fileName, index) => ({
                    index,
                    imageUrl: `${data.baseUrl}/data/${data.chapter.hash}/${fileName}`,
                })),
            };
        } catch (error) {
            return {
                status: "ERROR",
                pages: [],
                externalUrl: chapter.url,
                reason: error instanceof Error ? error.message : "MangaDex reader failed.",
            };
        }
    }

    async search(query: string): Promise<SearchResult[]> {
        try {
            const res = await fetchWithRetry(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=5&includes[]=cover_art`);
            const data = await res.json();

            return (data.data as MangaDexTitleItem[]).map((manga) => {
                const coverArt = manga.relationships.find((r) => r.type === "cover_art");
                const fileName = coverArt?.attributes?.fileName;

                return {
                    title: manga.attributes.title.en || Object.values(manga.attributes.title)[0],
                    description: manga.attributes.description.en?.split('\n')[0],
                    coverUrl: fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : undefined,
                    status: manga.attributes.status?.toUpperCase(),
                    sourceUrl: `https://mangadex.org/title/${manga.id}`,
                    sourceName: "MangaDex"
                };
            });
        } catch (error) {
            if (error instanceof ScraperRequestError) {
                console.error(`[MangaDex] Search failed (${error.kind})`);
            }
            return [];
        }
    }
}
