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

                for (const ch of scrapedChapters) {
                    // Check if chapter already exists for this source
                    const existing = await prisma.chapter.findFirst({
                        where: {
                            sourceId: source.id,
                            chapterNumber: ch.chapterNumber
                        }
                    });

                    if (!existing) {
                        await prisma.chapter.create({
                            data: {
                                mangaId: manga.id,
                                sourceId: source.id,
                                chapterNumber: ch.chapterNumber,
                                title: ch.title,
                                url: ch.url,
                                releaseDate: ch.releaseDate,
                            }
                        });
                        totalNewChapters++;
                    }
                }

            } catch (e) {
                console.error(`Failed to scrape source ${source.sourceName} for ${manga.title}`, e);
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
