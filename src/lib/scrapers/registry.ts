import { Scraper, ScrapedChapter, MangaMetadata, AggregatedSearchResult, ReaderChapterInput, ReaderResult, ReaderSourceInput, SearchResult } from "./types";
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
import { applySourceOverrideToInputSources, getMangaSourceOverride, isAllowedOverrideSource } from "@/lib/source-overrides";
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

function getAuthorParts(value?: string) {
    const normalized = normalizeSearchTitle(value ?? "");
    if (!normalized) return [];

    const parts = normalized
        .split(/\s+(?:and)\s+|[|/;,]/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);

    return parts.length > 0 ? parts : [normalized];
}

function getSortedTokens(value: string) {
    return value.split(/\s+/).filter(Boolean).sort().join(" ");
}

function authorsMatch(left?: string, right?: string) {
    const leftParts = getAuthorParts(left);
    const rightParts = getAuthorParts(right);

    if (leftParts.length === 0 || rightParts.length === 0) return null;

    return leftParts.some((leftPart) => rightParts.some((rightPart) => (
        leftPart === rightPart
        || leftPart.includes(rightPart)
        || rightPart.includes(leftPart)
        || getSortedTokens(leftPart) === getSortedTokens(rightPart)
    )));
}

function isAmbiguousSearchKey(key: string) {
    if (getMangaAliasGroup(key)) return false;
    return key.length <= 6 || !key.includes(" ");
}

function sourceIsAllowedByOverride(title: string, source: { name: string; url: string }) {
    const override = getMangaSourceOverride({ title });
    return Boolean(override && isAllowedOverrideSource({
        sourceName: source.name,
        sourceUrl: source.url,
    }, override));
}

function shouldMergeSearchResult(existing: AggregatedSearchResult, result: SearchResult, key: string) {
    const authorMatch = authorsMatch(existing.author, result.author);
    if (authorMatch === false) return false;
    if (authorMatch === true) return true;

    const resultSource = { name: result.sourceName, url: result.sourceUrl };
    const allSourcesAllowedByOverride = sourceIsAllowedByOverride(existing.title, resultSource)
        && existing.sources.some((source) => sourceIsAllowedByOverride(existing.title, source));
    if (allSourcesAllowedByOverride) return true;

    return !isAmbiguousSearchKey(key);
}

function getQueryMatchRank(query: string, title: string) {
    const normalizedQuery = normalizeSearchTitle(query);
    const normalizedTitle = normalizeSearchTitle(title);

    if (normalizedTitle === normalizedQuery) return 3;
    if (normalizedTitle.startsWith(`${normalizedQuery} `)) return 2;
    if (normalizedTitle.includes(normalizedQuery)) return 1;
    return 0;
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
        const candidateKeys = [key, ...Array.from(aggregated.keys()).filter((candidateKey) => candidateKey.startsWith(`${key}|`))];
        const matchingKey = candidateKeys.find((candidateKey) => {
            const candidate = aggregated.get(candidateKey);
            return candidate ? shouldMergeSearchResult(candidate, result, key) : false;
        });
        const existingKey = sourceUrlToKey.get(result.sourceUrl) ?? matchingKey ?? (aggregated.has(key) ? `${key}|${result.sourceUrl}` : key);
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
            aggregated.set(existingKey, {
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
            sourceUrlToKey.set(result.sourceUrl, existingKey);
            metadataRankByKey.set(existingKey, resultRank);
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
        const matchDelta = getQueryMatchRank(query, b.title) - getQueryMatchRank(query, a.title);
        if (matchDelta !== 0) return matchDelta;

        const aRank = Math.max(0, ...a.sources.map((source) => getPreferredSourceRank(source.name, a.title)));
        const bRank = Math.max(0, ...b.sources.map((source) => getPreferredSourceRank(source.name, b.title)));
        return bRank - aRank;
    });
}
