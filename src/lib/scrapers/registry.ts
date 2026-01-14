import { Scraper, ScrapedChapter, MangaMetadata, AggregatedSearchResult } from "./types";
import { MangaDexScraper } from "./mangadex";
import { NeloMangaScraper } from "./nelomanga";
import { MangaPlusScraper } from "./mangaplus";

const scrapers: Scraper[] = [
    new MangaDexScraper(),
    new NeloMangaScraper(),
    new MangaPlusScraper(),
];

export async function scrapeChapters(url: string): Promise<ScrapedChapter[]> {
    const scraper = scrapers.find(s => s.canHandle(url));
    if (!scraper) {
        throw new Error(`No scraper found for URL: ${url}`);
    }
    return scraper.fetchChapters(url);
}

export async function fetchMetadata(url: string): Promise<MangaMetadata> {
    const scraper = scrapers.find(s => s.canHandle(url));
    if (!scraper) {
        throw new Error(`No scraper found for URL: ${url}`);
    }
    return scraper.fetchMetadata(url);
}

export async function searchScrapers(query: string): Promise<AggregatedSearchResult[]> {
    const allResults = await Promise.all(scrapers.map(s => s.search(query).catch(() => [])));
    const flatResults = allResults.flat();

    const aggregated: Map<string, AggregatedSearchResult> = new Map();

    for (const result of flatResults) {
        // Use normalized title as key for grouping
        const key = result.title.toLowerCase().trim();
        const existing = aggregated.get(key);

        if (existing) {
            // Add source to existing entry if not already present
            if (!existing.sources.find(s => s.url === result.sourceUrl)) {
                existing.sources.push({
                    name: result.sourceName,
                    url: result.sourceUrl
                });
            }
            // Prefer more complete metadata if available
            if (!existing.description && result.description) existing.description = result.description;
            if (!existing.coverUrl && result.coverUrl) existing.coverUrl = result.coverUrl;
            if (!existing.status && result.status) existing.status = result.status;
            if (!existing.author && result.author) existing.author = result.author;
        } else {
            aggregated.set(key, {
                title: result.title,
                description: result.description,
                coverUrl: result.coverUrl,
                status: result.status,
                author: result.author,
                sources: [{
                    name: result.sourceName,
                    url: result.sourceUrl
                }]
            });
        }
    }

    return Array.from(aggregated.values());
}
