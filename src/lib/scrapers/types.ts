export interface ScrapedChapter {
    providerChapterId?: string;
    chapterNumber: number;
    title?: string;
    url: string;
    releaseDate?: Date;
}

export type ReaderStatus = "READABLE" | "EXTERNAL_ONLY" | "PAYWALLED" | "BLOCKED" | "UNSUPPORTED" | "ERROR";

export interface ReaderPage {
    index: number;
    imageUrl: string;
    width?: number;
    height?: number;
}

export interface ReaderChapterInput {
    id: string;
    providerChapterId?: string | null;
    url: string;
    chapterNumber: number;
    title?: string | null;
}

export interface ReaderSourceInput {
    id: string;
    sourceName: string;
    sourceUrl: string;
}

export interface ReaderResult {
    status: ReaderStatus;
    pages: ReaderPage[];
    externalUrl: string;
    reason?: string;
}

export interface MangaMetadata {
    title: string;
    description?: string;
    coverUrl?: string;
    status?: string;
    author?: string;
    contentRating?: string;
    classificationSource?: string;
    tags?: Array<{ id: string; name: string; group?: string }>;
}

export interface SearchResult extends MangaMetadata {
    sourceUrl: string;
    sourceName: string;
}

export interface SourceInfo {
    name: string;
    url: string;
}

export interface AggregatedSearchResult extends MangaMetadata {
    sources: SourceInfo[];
}

export interface ScraperCapabilities {
    search: boolean;
    metadata: boolean;
    chapters: boolean;
    reader?: boolean;
}

export interface Scraper {
    name: string;
    capabilities?: ScraperCapabilities;
    canHandle(url: string): boolean;
    fetchChapters(url: string, source?: ReaderSourceInput): Promise<ScrapedChapter[]>;
    fetchMetadata(url: string): Promise<MangaMetadata>;
    search(query: string): Promise<SearchResult[]>;
    fetchReaderPages?(chapter: ReaderChapterInput, source: ReaderSourceInput): Promise<ReaderResult>;
}
