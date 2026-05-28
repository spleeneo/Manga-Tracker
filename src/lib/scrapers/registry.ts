import { Scraper, ScrapedChapter, MangaMetadata, AggregatedSearchResult, ReaderChapterInput, ReaderResult, ReaderSourceInput } from "./types";
import { MangaDexScraper } from "./mangadex";
import { NeloMangaScraper } from "./nelomanga";
import { MangaPlusScraper } from "./mangaplus";
import { ComikeyScraper } from "./comikey";
import { VizScraper } from "./viz";
import { WebtoonScraper } from "./webtoon";
import { UrekMazinoScraper } from "./urek-mazino";
import { ManganatoScraper } from "./manganato";
import { BleachLiveScraper } from "./bleach-live";
import { WitchHatAtelierScraper } from "./witch-hat-atelier";
import { getCanonicalMangaTitle, getMangaAliasGroup } from "@/lib/manga-aliases";

const scrapers: Scraper[] = [
    new WitchHatAtelierScraper(),
    new MangaDexScraper(),
    new NeloMangaScraper(),
    new MangaPlusScraper(),
    new ComikeyScraper(),
    new VizScraper(),
    new UrekMazinoScraper(),
    new BleachLiveScraper(),
    new WebtoonScraper(),
    new ManganatoScraper(),
];

function normalizeSearchTitle(title: string) {
    return title
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/\bmanga\b/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getCanonicalSearchTitle(title: string) {
    const normalized = normalizeSearchTitle(title);
    return getMangaAliasGroup(normalized)?.slug ?? normalized;
}

export function getRegisteredScrapers(): Scraper[] {
    return [...scrapers];
}

export function getScraperStatus() {
    return scrapers.map((scraper) => ({
        name: scraper.name,
        capabilities: scraper.capabilities ?? { search: true, metadata: true, chapters: true },
    }));
}

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

export async function fetchReaderPages(chapter: ReaderChapterInput, source: ReaderSourceInput): Promise<ReaderResult> {
    const scraper = scrapers.find(s => s.canHandle(source.sourceUrl) || s.canHandle(chapter.url));
    if (!scraper?.fetchReaderPages || !scraper.capabilities?.reader) {
        return {
            status: "EXTERNAL_ONLY",
            pages: [],
            externalUrl: chapter.url,
            reason: `${source.sourceName} does not support the Mangateo reader yet.`,
        };
    }

    return scraper.fetchReaderPages(chapter, source);
}

export async function searchScrapers(query: string): Promise<AggregatedSearchResult[]> {
    const allResults = await Promise.all(scrapers.map(s => s.search(query).catch(() => [])));
    const flatResults = allResults.flat();

    const aggregated: Map<string, AggregatedSearchResult> = new Map();
    const sourceUrlToKey: Map<string, string> = new Map();

    for (const result of flatResults) {
        const key = getCanonicalSearchTitle(result.title);
        const existingKey = sourceUrlToKey.get(result.sourceUrl) ?? key;
        const existing = aggregated.get(existingKey);

        if (existing) {
            // Add source to existing entry if not already present
            if (!existing.sources.find(s => s.url === result.sourceUrl)) {
                existing.sources.push({
                    name: result.sourceName,
                    url: result.sourceUrl
                });
            }
            sourceUrlToKey.set(result.sourceUrl, existingKey);
            // Prefer more complete metadata if available
            if (!existing.description && result.description) existing.description = result.description;
            if (!existing.coverUrl && result.coverUrl) existing.coverUrl = result.coverUrl;
            if (!existing.status && result.status) existing.status = result.status;
            if (!existing.author && result.author) existing.author = result.author;
        } else {
            aggregated.set(key, {
                title: getCanonicalMangaTitle(result.title),
                description: result.description,
                coverUrl: result.coverUrl,
                status: result.status,
                author: result.author,
                sources: [{
                    name: result.sourceName,
                    url: result.sourceUrl
                }]
            });
            sourceUrlToKey.set(result.sourceUrl, key);
        }
    }

    return Array.from(aggregated.values());
}
