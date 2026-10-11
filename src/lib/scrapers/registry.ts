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
import { getCanonicalMangaTitle } from "@/lib/manga-aliases";
import { normalizeSearchTitle, getCanonicalSearchTitle, sameWork } from "@/lib/work-identity";
import { getPreferredSourceRank } from "@/lib/source-preference";
import { sourceIdentity } from "@/lib/search-library";
import { assertUnambiguousChapterZero } from "./chapter-number";

const scrapers: Scraper[] = [
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
    new SingleMangaSiteScraper(),
];

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

function findScraper(url: string) {
    return scrapers.find((scraper) => scraper.canHandle(url));
}

export async function scrapeChapters(url: string, source?: ReaderSourceInput): Promise<ScrapedChapter[]> {
    const scraper = findScraper(url);
    if (!scraper) {
        throw new Error(`No scraper found for URL: ${url}`);
    }
    const chapters = await scraper.fetchChapters(url, source);
    if (chapters.some((chapter) => !Number.isFinite(chapter.chapterNumber) || chapter.chapterNumber < 0)) {
        throw new Error(`${scraper.name} returned an invalid chapter number`);
    }
    assertUnambiguousChapterZero(chapters);
    return chapters;
}

export function supportsInternalReader(url: string) {
    const scraper = findScraper(url);
    return Boolean(scraper?.capabilities?.reader && scraper.fetchReaderPages);
}

export async function fetchMetadata(url: string): Promise<MangaMetadata> {
    const scraper = findScraper(url);
    if (!scraper) {
        throw new Error(`No scraper found for URL: ${url}`);
    }
    return scraper.fetchMetadata(url);
}

export async function fetchReaderPages(chapter: ReaderChapterInput, source: ReaderSourceInput): Promise<ReaderResult> {
    const scraper = findScraper(source.sourceUrl) ?? findScraper(chapter.url);
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
    return (await searchScrapersDetailed(query)).results;
}

export async function searchScrapersDetailed(query: string) {
    const providers = scrapers.filter((s) => s.capabilities?.search !== false);
    const settled = await Promise.allSettled(providers.map(async (s) => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                s.search(query, { signal: controller.signal }),
                new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Provider search timed out")); }, 8_000); }),
            ]);
        } finally { if (timer) clearTimeout(timer); }
    }));
    const failedProviders = settled.flatMap((result, index) => result.status === "rejected" ? [providers[index].name] : []);
    const allResults = settled.map((result) => result.status === "fulfilled" ? result.value : []);
    const flatResults = allResults.flat();

    const aggregated: Map<string, AggregatedSearchResult> = new Map();
    const sourceUrlToKey: Map<string, string> = new Map();
    const metadataRankByKey: Map<string, number> = new Map();

    for (const result of flatResults) {
        const key = getCanonicalSearchTitle(result.title);
        const candidateKeys = Array.from(aggregated.keys());
        const matchingKey = candidateKeys.find((candidateKey) => {
            const candidate = aggregated.get(candidateKey);
            return candidate ? sameWork(candidate, { ...result, sources: [{ name: result.sourceName, url: result.sourceUrl }] }) : false;
        });
        const identity = sourceIdentity(result.sourceUrl);
        const existingKey = sourceUrlToKey.get(identity) ?? matchingKey ?? (aggregated.has(key) ? `${key}|${result.sourceUrl}` : key);
        const existing = aggregated.get(existingKey);
        const resultRank = getPreferredSourceRank(result.sourceName, result.title);

        if (existing) {
            existing.alternateTitles = Array.from(new Set([...(existing.alternateTitles ?? []), ...(result.alternateTitles ?? []), result.title]));
            // Add source to existing entry if not already present
            if (!existing.sources.find(s => sourceIdentity(s.url) === identity)) {
                existing.sources.push({
                    ...(result.providerId ? { providerId: result.providerId } : {}),
                    name: result.sourceName,
                    url: result.sourceUrl
                });
            }
            sourceUrlToKey.set(identity, existingKey);
            const metadataRank = metadataRankByKey.get(existingKey) ?? 0;
            const preferIncomingMetadata = resultRank > metadataRank;
            if ((!existing.description || preferIncomingMetadata) && result.description) existing.description = result.description;
            if ((!existing.coverUrl || preferIncomingMetadata) && result.coverUrl) existing.coverUrl = result.coverUrl;
            if ((!existing.status || preferIncomingMetadata) && result.status) existing.status = result.status;
            if ((!existing.author || preferIncomingMetadata) && result.author) existing.author = result.author;
            if (result.tags?.length) existing.tags = Array.from(new Map([...(existing.tags ?? []), ...result.tags].map((tag) => [tag.id, tag])).values());
            if (result.classificationSource === "MANGADEX") { existing.contentRating = result.contentRating; existing.classificationSource = result.classificationSource; }
            if (preferIncomingMetadata) metadataRankByKey.set(existingKey, resultRank);
        } else {
            const canonicalTitle = getCanonicalMangaTitle(result.title);
            aggregated.set(existingKey, {
                title: canonicalTitle,
                description: result.description,
                coverUrl: result.coverUrl,
                status: result.status,
                author: result.author,
                tags: result.tags,
                contentRating: result.contentRating,
                classificationSource: result.classificationSource,
                alternateTitles: result.alternateTitles,
                sources: [{
                    ...(result.providerId ? { providerId: result.providerId } : {}),
                    name: result.sourceName,
                    url: result.sourceUrl
                }]
            });
            sourceUrlToKey.set(identity, existingKey);
            metadataRankByKey.set(existingKey, resultRank);
        }
    }

    const results = Array.from(aggregated.values()).map((result) => {
        const sources = result.sources
            .map((source) => ({ ...source }))
            .sort((a, b) => getPreferredSourceRank(b.name, result.title) - getPreferredSourceRank(a.name, result.title));

        return {
            ...result,
            sources,
        };
    }).sort((a, b) => {
        const rank = (result: AggregatedSearchResult) => Math.max(...[result.title, ...(result.alternateTitles ?? [])].map((title) => getQueryMatchRank(query, title)));
        const matchDelta = rank(b) - rank(a);
        if (matchDelta !== 0) return matchDelta;

        const aRank = Math.max(0, ...a.sources.map((source) => getPreferredSourceRank(source.name, a.title)));
        const bRank = Math.max(0, ...b.sources.map((source) => getPreferredSourceRank(source.name, b.title)));
        return bRank - aRank;
    });
    return { results, failedProviders, allFailed: settled.length > 0 && settled.every((result) => result.status === "rejected") };
}
