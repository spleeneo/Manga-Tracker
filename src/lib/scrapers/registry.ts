import { Scraper, ScrapedChapter, MangaMetadata, AggregatedSearchResult, ReaderChapterInput, ReaderResult, ReaderSourceInput } from "./types";
import { MangaDexScraper } from "./mangadex";
import { NeloMangaScraper } from "./nelomanga";
import { MangaPlusScraper } from "./mangaplus";
import { ComikeyScraper } from "./comikey";
import { VizScraper } from "./viz";
import { WebtoonScraper } from "./webtoon";
import { UrekMazinoScraper } from "./urek-mazino";
import { ManganatoScraper } from "./manganato";
import { MangaPillScraper } from "./mangapill";
import { BleachLiveScraper } from "./bleach-live";
import { WitchHatAtelierScraper } from "./witch-hat-atelier";
import { LandOfTheLustrousScraper } from "./land-of-the-lustrous";
import { SingleMangaSiteScraper } from "./single-manga-sites";
import { AtsumaruScraper } from "./atsumaru";
import { getCanonicalMangaTitle, getMangaAliasGroup } from "@/lib/manga-aliases";
import { applySourceOverrideToInputSources } from "@/lib/source-overrides";
import { getPreferredSourceRank } from "@/lib/source-preference";

const scrapers: Scraper[] = [
    new SingleMangaSiteScraper(),
    new WitchHatAtelierScraper(),
    new LandOfTheLustrousScraper(),
    new MangaDexScraper(),
    new NeloMangaScraper(),
    new MangaPlusScraper(),
    new ComikeyScraper(),
    new VizScraper(),
    new UrekMazinoScraper(),
    new BleachLiveScraper(),
    new WebtoonScraper(),
    new ManganatoScraper(),
    new MangaPillScraper(),
    new AtsumaruScraper(),
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

export async function scrapeChapters(url: string, source?: ReaderSourceInput): Promise<ScrapedChapter[]> {
    const scraper = scrapers.find(s => s.canHandle(url));
    if (!scraper) {
        throw new Error(`No scraper found for URL: ${url}`);
    }
    return scraper.fetchChapters(url, source);
}

export function supportsInternalReader(url: string) {
    const scraper = scrapers.find((candidate) => candidate.canHandle(url));
    return Boolean(scraper?.capabilities?.reader && scraper.fetchReaderPages);
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
    const metadataRankByKey: Map<string, number> = new Map();

    for (const result of flatResults) {
        const key = getCanonicalSearchTitle(result.title);
        const existingKey = sourceUrlToKey.get(result.sourceUrl) ?? key;
        const existing = aggregated.get(existingKey);
        const resultRank = getPreferredSourceRank(result.sourceName, result.title);

        if (existing) {
            // Add source to existing entry if not already present
            if (!existing.sources.find(s => s.url === result.sourceUrl)) {
                existing.sources.push({
                    name: result.sourceName,
                    url: result.sourceUrl
                });
            }
            sourceUrlToKey.set(result.sourceUrl, existingKey);
            const metadataRank = metadataRankByKey.get(existingKey) ?? 0;
            const preferIncomingMetadata = resultRank > metadataRank;
            if ((!existing.description || preferIncomingMetadata) && result.description) existing.description = result.description;
            if ((!existing.coverUrl || preferIncomingMetadata) && result.coverUrl) existing.coverUrl = result.coverUrl;
            if ((!existing.status || preferIncomingMetadata) && result.status) existing.status = result.status;
            if ((!existing.author || preferIncomingMetadata) && result.author) existing.author = result.author;
            if (preferIncomingMetadata) metadataRankByKey.set(existingKey, resultRank);
        } else {
            const canonicalTitle = getCanonicalMangaTitle(result.title);
            aggregated.set(key, {
                title: canonicalTitle,
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
            metadataRankByKey.set(key, resultRank);
        }
    }

    return Array.from(aggregated.values()).map((result) => {
        const sources = applySourceOverrideToInputSources(
            { title: result.title },
            result.sources.map((source) => ({ name: source.name, url: source.url })),
        ).sort((a, b) => getPreferredSourceRank(b.name, result.title) - getPreferredSourceRank(a.name, result.title));

        return {
            ...result,
            sources,
        };
    }).sort((a, b) => {
        const aRank = Math.max(0, ...a.sources.map((source) => getPreferredSourceRank(source.name, a.title)));
        const bRank = Math.max(0, ...b.sources.map((source) => getPreferredSourceRank(source.name, b.title)));
        return bRank - aRank;
    });
}
