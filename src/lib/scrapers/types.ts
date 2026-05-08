export interface ScrapedChapter {
    providerChapterId?: string;
    chapterNumber: number;
    title?: string;
    url: string;
    releaseDate?: Date;
}

export interface MangaMetadata {
    title: string;
    description?: string;
    coverUrl?: string;
    status?: string;
    author?: string;
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
}

export interface Scraper {
    name: string;
    capabilities?: ScraperCapabilities;
    canHandle(url: string): boolean;
    fetchChapters(url: string): Promise<ScrapedChapter[]>;
    fetchMetadata(url: string): Promise<MangaMetadata>;
    search(query: string): Promise<SearchResult[]>;
}
