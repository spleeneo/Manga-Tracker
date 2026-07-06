import { prisma } from "@/lib/db";
import { scrapeChapters, supportsInternalReader } from "./scrapers/registry";
import { filterSourcesForManga, getMangaSourceOverride } from "@/lib/source-overrides";
import { isDedicatedMangaSourceName } from "@/lib/source-preference";
import { discoverSingleMangaSiteSources } from "@/lib/scrapers/single-manga-sites";
import { discoverMissingSourcesForManga } from "@/lib/source-discovery";
import { refreshMangaClassification } from "@/lib/content-classification";

function hasSingleMangaSiteSource(sources: Array<{ sourceName: string }>) {
    return sources.some((source) => isDedicatedMangaSourceName(source.sourceName));
}

type MangaForUpdate = Awaited<ReturnType<typeof prisma.manga.findMany<{ include: { sources: true } }>>>[number];

export async function updateSingleManga(mangaId: string) {
    const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: { sources: true },
    });

    if (!manga) {
        return { manga: mangaId, status: "Manga not found", allSourcesFailed: true };
    }

    return updateMangaRecord(manga);
}

async function updateMangaRecord(manga: MangaForUpdate) {
    const override = getMangaSourceOverride(manga);
    let sources = filterSourcesForManga(manga, manga.sources);

    if (override && sources.length === 0) {
        const source = await prisma.source.upsert({
            where: {
                mangaId_sourceUrl: {
                    mangaId: manga.id,
                    sourceUrl: override.sourceUrl,
                },
            },
            update: {
                sourceName: override.sourceName,
            },
            create: {
                mangaId: manga.id,
                sourceName: override.sourceName,
                sourceUrl: override.sourceUrl,
            },
        });
        sources = [source];
    }

    if (!override) {
        const discoveredSources = await discoverMissingSourcesForManga(manga, sources);
        for (const discoveredSource of discoveredSources) {
            const source = await prisma.source.upsert({
                where: {
                    mangaId_sourceUrl: {
                        mangaId: manga.id,
                        sourceUrl: discoveredSource.sourceUrl,
                    },
                },
                update: {
                    sourceName: discoveredSource.sourceName,
                },
                create: {
                    mangaId: manga.id,
                    sourceName: discoveredSource.sourceName,
                    sourceUrl: discoveredSource.sourceUrl,
                },
            });
            sources = filterSourcesForManga(manga, [source, ...sources]);
        }
    }

    if (!override && sources.length > 0 && !hasSingleMangaSiteSource(sources)) {
        const [discoveredSource] = await discoverSingleMangaSiteSources(manga.title);
        if (discoveredSource && !sources.some((source) => source.sourceUrl === discoveredSource.sourceUrl)) {
            const source = await prisma.source.upsert({
                where: {
                    mangaId_sourceUrl: {
                        mangaId: manga.id,
                        sourceUrl: discoveredSource.sourceUrl,
                    },
                },
                update: {
                    sourceName: discoveredSource.sourceName,
                },
                create: {
                    mangaId: manga.id,
                    sourceName: discoveredSource.sourceName,
                    sourceUrl: discoveredSource.sourceUrl,
                },
            });
            sources = filterSourcesForManga(manga, [source, ...sources]);
        }
    }

    if (sources.length === 0) {
        return { manga: manga.title, status: "No sources identified" };
    }

    const sourceResults = await Promise.all(sources.map(async (source) => {
        try {
            console.log(`Scraping source: ${source.sourceName} (${source.sourceUrl})`);
            const scrapedChapters = await scrapeChapters(source.sourceUrl, source);
            const existingChapters = await prisma.chapter.findMany({
                where: { sourceId: source.id },
                select: {
                    providerChapterId: true,
                    chapterNumber: true,
                },
            });
            const existingProviderIds = new Set(
                existingChapters
                    .map((chapter) => chapter.providerChapterId)
                    .filter((providerChapterId): providerChapterId is string => Boolean(providerChapterId))
            );
            const existingChapterNumbers = new Set(existingChapters.map((chapter) => chapter.chapterNumber));
            const seenProviderIds = new Set<string>();
            const seenChapterNumbers = new Set<number>();
            const newChapters = [];
            let createdCount = 0;

            for (const ch of scrapedChapters) {
                const hasProviderMatch = ch.providerChapterId
                    ? existingProviderIds.has(ch.providerChapterId) || seenProviderIds.has(ch.providerChapterId)
                    : false;
                const hasChapterNumberMatch = existingChapterNumbers.has(ch.chapterNumber) || seenChapterNumbers.has(ch.chapterNumber);

                if (!hasProviderMatch && !hasChapterNumberMatch) {
                    newChapters.push({
                        mangaId: manga.id,
                        sourceId: source.id,
                        providerChapterId: ch.providerChapterId,
                        chapterNumber: ch.chapterNumber,
                        title: ch.title,
                        url: ch.url,
                        releaseDate: ch.releaseDate,
                    });
                    if (ch.providerChapterId) seenProviderIds.add(ch.providerChapterId);
                    seenChapterNumbers.add(ch.chapterNumber);
                }
            }

            if (newChapters.length > 0) {
                const created = await prisma.chapter.createMany({
                    data: newChapters,
                    skipDuplicates: true,
                });
                createdCount = created.count;
            }

            if (supportsInternalReader(source.sourceUrl)) {
                await prisma.chapter.updateMany({
                    where: { sourceId: source.id, readerStatus: null },
                    data: { readerStatus: "READABLE", readerError: null },
                });
            }

            await prisma.source.update({
                where: { id: source.id },
                data: {
                    lastCheckedAt: new Date(),
                    lastSuccessAt: new Date(),
                    lastError: null,
                    failureCount: 0,
                    disabledUntil: null,
                },
            });
            return { createdCount };

        } catch (e) {
            console.error(`Failed to scrape source ${source.sourceName} for ${manga.title}`, e);
            const errorMessage = e instanceof Error ? e.message : "Unknown scrape error";
            await prisma.source.update({
                where: { id: source.id },
                data: {
                    lastCheckedAt: new Date(),
                    lastError: errorMessage,
                    failureCount: { increment: 1 },
                },
            });
            return { createdCount: 0, error: errorMessage };
        }
    }));

    const totalNewChapters = sourceResults.reduce((total, result) => total + result.createdCount, 0);
    const failedSources = sourceResults.filter((result) => result.error);
    const allSourcesFailed = failedSources.length === sourceResults.length;

    try {
        await refreshMangaClassification(manga.id);
    } catch (error) {
        console.error(`Failed to refresh provider classifications for ${manga.title}`, error);
    }

    if (totalNewChapters > 0) {
        await prisma.manga.update({
            where: { id: manga.id },
            data: { updatedAt: new Date() }
        });
    }

    return {
        manga: manga.title,
        status: allSourcesFailed
            ? `All sources failed: ${failedSources.map((source) => source.error).join("; ")}`
            : totalNewChapters > 0 ? `Added ${totalNewChapters} new chapters` : "No new chapters updates",
        failedSources: failedSources.length,
        allSourcesFailed,
    };
}

export async function checkForUpdates(specificMangaId?: string) {
    console.log(`Checking updates for: ${specificMangaId || "ALL"}`);

    const where = specificMangaId
        ? { id: specificMangaId }
        : { userManga: { some: {} } };

    const mangas = await prisma.manga.findMany({
        where,
        include: { sources: true }
    });

    const results = [];

    for (const manga of mangas) {
        results.push(await updateMangaRecord(manga));
    }

    return results;
}
