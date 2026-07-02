import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { fetchMetadata } from "@/lib/scrapers/registry";
import { getCurrentUserId } from "@/lib/session";
import { inferSourceName } from "@/lib/source-name";
import { normalizeMangaStatus } from "@/lib/manga-status";
import { enqueueMangaSyncJob, processSyncJob } from "@/lib/sync-jobs";
import { getCanonicalMangaSlug, getCanonicalMangaTitle, getMangaAliasSlugs } from "@/lib/manga-aliases";
import { applySourceOverrideToInputSources } from "@/lib/source-overrides";
import { evaluateMangaAccess, getChildPolicy, getMangaAccess, parentalControlError } from "@/lib/parental-controls";
import { refreshMangaClassification } from "@/lib/content-classification";

export async function POST(request: Request) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const body = await request.json();
        const { title, slug, coverUrl, status, description, sourceUrl, sources = [], contentRating, classificationSource, tags = [] } = body;
        const normalizedTags = Array.isArray(tags) ? tags.filter((tag): tag is { id: string; name: string; group?: string } => Boolean(tag && typeof tag.id === "string" && typeof tag.name === "string")) : [];
        const childPolicy = await getChildPolicy(userId);
        if (childPolicy) {
            const access = evaluateMangaAccess(childPolicy, {
                contentRating: typeof contentRating === "string" ? contentRating : null,
                classificationSource: classificationSource === "MANGADEX" ? classificationSource : null,
                tags: normalizedTags.map((tag) => tag.name),
            });
            if (!access.allowed) return parentalControlError(access.reason);
        }

        // Normalize sources list
        // If a compatibility caller provides a single sourceUrl, fold it into the sources array.
        let sourcesToProcess = [...sources];
        if (sourceUrl && !sourcesToProcess.some(s => s.url === sourceUrl)) {
            sourcesToProcess.push({
                url: sourceUrl,
                name: inferSourceName(sourceUrl),
            });
        }

        let finalMangaData = { title, slug, coverUrl, status, description };

        // If we have sources but no detailed metadata, try to fetch from the first one
        if (sourcesToProcess.length > 0 && (!title || !slug)) {
            const primarySource = sourcesToProcess[0];
            try {
                console.log(`[API] Attempting auto-fetch metadata for: ${primarySource.url}`);
                const meta = await fetchMetadata(primarySource.url);
                console.log(`[API] Auto-fetch success: ${meta.title}`);
                finalMangaData = {
                    title: title || meta.title,
                    slug: slug || meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 50),
                    coverUrl: coverUrl || meta.coverUrl,
                    status: normalizeMangaStatus(status || meta.status, "ONGOING"),
                    description: description || meta.description,
                };
            } catch (e) {
                console.error("[API] Auto-fetch metadata failed:", e);
            }
        }

        if (!finalMangaData.title || !finalMangaData.slug) {
            return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
        }

        finalMangaData = {
            ...finalMangaData,
            title: getCanonicalMangaTitle(finalMangaData.title),
            slug: getCanonicalMangaSlug(finalMangaData.title, finalMangaData.slug),
        };
        sourcesToProcess = applySourceOverrideToInputSources(finalMangaData, sourcesToProcess);
        const sourceUrls = sourcesToProcess
            .map((source) => source.url || source.sourceUrl)
            .filter((url): url is string => Boolean(url));

        // Check for existing manga
        let existingManga = await prisma.manga.findUnique({
            where: { slug: finalMangaData.slug },
            include: {
                _count: {
                    select: { chapters: true },
                },
            },
        });

        if (!existingManga) {
            const aliasSlugs = getMangaAliasSlugs(finalMangaData.title, finalMangaData.slug);
            const aliasManga = aliasSlugs.length > 0 ? await prisma.manga.findFirst({
                where: { slug: { in: aliasSlugs } },
                include: {
                    _count: {
                        select: { chapters: true },
                    },
                },
            }) : null;

            if (aliasManga) {
                existingManga = await prisma.manga.update({
                    where: { id: aliasManga.id },
                    data: {
                        title: finalMangaData.title,
                        slug: finalMangaData.slug,
                    },
                    include: {
                        _count: {
                            select: { chapters: true },
                        },
                    },
                });
            }
        }

        if (!existingManga && sourceUrls.length > 0) {
            const existingSource = await prisma.source.findFirst({
                where: { sourceUrl: { in: sourceUrls } },
                include: {
                    manga: {
                        include: {
                            _count: {
                                select: { chapters: true },
                            },
                        },
                    },
                },
            });

            if (existingSource) {
                existingManga = existingSource.manga;
                finalMangaData = {
                    ...finalMangaData,
                    title: existingManga.title,
                    slug: existingManga.slug,
                    coverUrl: finalMangaData.coverUrl || existingManga.coverUrl,
                    status: finalMangaData.status || existingManga.status,
                    description: finalMangaData.description || existingManga.description,
                };
            }
        }

        if (existingManga && childPolicy) {
            const existingAccess = await getMangaAccess(userId, existingManga.id);
            if (!existingAccess.allowed) return parentalControlError(existingAccess.reason);
        }

        const mangaId = existingManga ? existingManga.id : (await prisma.manga.create({
            data: {
                title: finalMangaData.title,
                slug: finalMangaData.slug,
                coverUrl: finalMangaData.coverUrl,
                status: normalizeMangaStatus(finalMangaData.status, "ONGOING"),
                description: finalMangaData.description,
                contentRating: classificationSource === "MANGADEX" && typeof contentRating === "string" ? contentRating.toLowerCase() : null,
                classificationSource: classificationSource === "MANGADEX" ? "MANGADEX" : null,
                classifiedAt: classificationSource === "MANGADEX" ? new Date() : null,
                tags: normalizedTags.length ? { create: normalizedTags.map((tag) => ({ tag: { connectOrCreate: { where: { id: tag.id }, create: { id: tag.id, name: tag.name, group: tag.group } } } })) } : undefined,
            }
        })).id;

        if (existingManga && classificationSource === "MANGADEX" && typeof contentRating === "string") {
            await prisma.manga.update({
                where: { id: mangaId },
                data: {
                    contentRating: contentRating.toLowerCase(), classificationSource: "MANGADEX", classifiedAt: new Date(),
                    tags: normalizedTags.length ? {
                        deleteMany: {},
                        create: normalizedTags.map((tag) => ({ tag: { connectOrCreate: { where: { id: tag.id }, create: { id: tag.id, name: tag.name, group: tag.group } } } })),
                    } : undefined,
                },
            });
        }

        // Process all sources
        const hasSources = sourcesToProcess.length > 0;
        let addedSource = false;
        if (sourcesToProcess.length > 0) {
            console.log(`[API] Processing ${sourcesToProcess.length} sources for manga ${finalMangaData.title}`);

            for (const source of sourcesToProcess) {
                const url = source.url || source.sourceUrl; // handle different naming
                if (!url) continue;

                const name = source.name || inferSourceName(url);

                try {
                    // Upsert source
                    // We use findUnique first to avoid unique constraint errors if upsert has race conditions or logic issues
                    const existingSource = await prisma.source.findUnique({
                        where: {
                            mangaId_sourceUrl: {
                                mangaId: mangaId,
                                sourceUrl: url
                            }
                        }
                    });

                    if (!existingSource) {
                        await prisma.source.create({
                            data: {
                                mangaId: mangaId,
                                sourceName: name,
                                sourceUrl: url
                            }
                        });
                        addedSource = true;
                        console.log(`[API] Added source ${name}`);
                    }

                } catch (e) {
                    console.error(`[API] Failed to add source ${name}:`, e);
                }
            }
        }

        const shouldScrape = hasSources && (!existingManga || existingManga._count.chapters === 0 || addedSource);
        const syncStartedAt = shouldScrape ? new Date() : null;
        const syncFinishedAt = hasSources && !shouldScrape ? new Date() : null;
        const syncStatus = hasSources ? (shouldScrape ? "SYNCING" : "UPDATED") : "IDLE";

        await prisma.userManga.upsert({
            where: {
                    userId_mangaId: {
                    userId,
                    mangaId,
                },
            },
            update: {
                status: "READING",
                syncStatus,
                syncStartedAt,
                syncFinishedAt,
                syncError: null,
            },
            create: {
                userId,
                mangaId,
                status: "READING",
                syncStatus,
                syncStartedAt,
                syncFinishedAt,
            },
        });

        const job = shouldScrape ? await enqueueMangaSyncJob(userId, mangaId) : null;
        if (shouldScrape) after(async () => {
            if (job) await processSyncJob(job.id);
            await refreshMangaClassification(mangaId);
        });

        return NextResponse.json({
            id: mangaId,
            title: finalMangaData.title,
            slug: finalMangaData.slug,
            syncStatus,
        });

    } catch (error) {
        console.error("Error creating manga:", error);
        return NextResponse.json({ error: "Failed to create manga" }, { status: 500 });
    }
}
