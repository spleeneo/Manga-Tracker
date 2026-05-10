import { prisma } from "@/lib/db";
import { scrapeChapters } from "./scrapers/registry";

export async function checkForUpdates(specificMangaId?: string) {
    console.log(`Checking updates for: ${specificMangaId || "ALL"}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = specificMangaId
        ? { id: specificMangaId }
        : { status: "ONGOING" };

    const mangas = await prisma.manga.findMany({
        where,
        include: { sources: true }
    });

    const results = [];

    for (const manga of mangas) {
        if (manga.sources.length === 0) {
            results.push({ manga: manga.title, status: "No sources identified" });
            continue;
        }

        let totalNewChapters = 0;

        for (const source of manga.sources) {
            try {
                console.log(`Scraping source: ${source.sourceName} (${source.sourceUrl})`);
                const scrapedChapters = await scrapeChapters(source.sourceUrl);
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
                    totalNewChapters += created.count;
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

            } catch (e) {
                console.error(`Failed to scrape source ${source.sourceName} for ${manga.title}`, e);
                await prisma.source.update({
                    where: { id: source.id },
                    data: {
                        lastCheckedAt: new Date(),
                        lastError: e instanceof Error ? e.message : "Unknown scrape error",
                        failureCount: { increment: 1 },
                    },
                });
            }
        }

        if (totalNewChapters > 0) {
            await prisma.manga.update({
                where: { id: manga.id },
                data: { updatedAt: new Date() }
            });
        }

        results.push({
            manga: manga.title,
            status: totalNewChapters > 0 ? `Added ${totalNewChapters} new chapters` : "No new chapters updates"
        });
    }

    return results;
}
