import { isDatabaseConfigured, prisma } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { ChapterList } from "@/components/chapter-list";
import { LegalFooter } from "@/components/legal-footer";
import { MangaDescription } from "@/components/manga-description";
import { MangaSourceList } from "@/components/manga-source-list";
import { ThemeSelector } from "@/components/theme-selector";
import { auth } from "../../../../auth";
import { getLibraryMangaSummary } from "@/lib/library-summary";
import { isExternalReaderSource } from "@/lib/external-reader-sources";
import { filterSourcesForManga } from "@/lib/source-overrides";
import { getSourceRankScore } from "@/lib/source-ranking";

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

async function getManga(slug: string, userId: string) {
    if (!isDatabaseConfigured) return null;

    const manga = await prisma.manga.findUnique({
        where: { slug: slug },
        include: {
            sources: true,
        }
    });

    if (!manga) return null;

    const tracked = await prisma.userManga.findUnique({
        where: {
            userId_mangaId: {
                userId,
                mangaId: manga.id,
            },
        },
        select: {
            lastReadChapterNumber: true,
            disabledSources: {
                select: { sourceId: true },
            },
            sourcePreferences: {
                select: {
                    sourceId: true,
                    position: true,
                },
            },
        },
    });
    if (!tracked) return null;

    const disabledSourceIds = new Set(tracked.disabledSources.map((source) => source.sourceId));
    const sourcePositionById = new Map(tracked.sourcePreferences.map((source) => [source.sourceId, source.position]));
    const sources = filterSourcesForManga(manga, manga.sources).map((source) => ({
        ...source,
        isDisabled: disabledSourceIds.has(source.id),
        position: sourcePositionById.get(source.id) ?? null,
    })).sort((a, b) => {
        const rankDelta = getSourceRankScore(b, manga.slug) - getSourceRankScore(a, manga.slug);
        if (rankDelta !== 0) return rankDelta;
        return a.sourceName.localeCompare(b.sourceName);
    });

    return {
        ...manga,
        sources,
        enabledSources: sources.filter((source) => !source.isDisabled),
        lastReadChapterNumber: tracked.lastReadChapterNumber,
    };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;

    if (!isDatabaseConfigured) {
        return { title: "Manga" };
    }

    const manga = await prisma.manga.findUnique({
        where: { slug },
        select: { title: true },
    });

    return {
        title: manga?.title ?? "Manga",
    };
}

export default async function MangaPage({ params }: PageProps) {
    const session = await auth();
    if (!session?.user?.id) {
        notFound();
    }

    const { slug } = await params;
    const manga = await getManga(slug, session.user.id);

    if (!manga) {
        notFound();
    }

    const summary = await getLibraryMangaSummary(session.user.id, manga.id);
    const primaryReadTarget = summary?.nextUnreadChapter ?? summary?.latestChapter;
    const primaryReadOpensExternally = isExternalReaderSource(primaryReadTarget?.sourceName);
    const latestOpensExternally = isExternalReaderSource(summary?.latestChapter?.sourceName);

    return (
        <div className="min-h-screen bg-background pb-12">
            <div className="relative min-h-16 w-full overflow-hidden border-b bg-background md:h-60 md:bg-muted">
                {manga.coverUrl && (
                    <div
                        className="absolute inset-0 hidden bg-cover bg-center opacity-25 md:block"
                        style={{ backgroundImage: `url(/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)})` }}
                    />
                )}
                <div className="absolute inset-0 hidden bg-gradient-to-t from-background via-background/70 to-background/20 md:block" />

                <div className="page-wrap app-header-row relative h-full">
                    <div className="contents md:flex md:min-w-0 md:items-center md:gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <Link
                                href="/"
                                className="ui-icon-button shrink-0"
                                aria-label="Back to library"
                                title="Back to library"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                            <BrandLink />
                        </div>
                        <AppNav />
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <ThemeSelector />
                        <AuthButton />
                    </div>
                </div>
            </div>

            <div className="page-wrap relative z-10 py-5 md:-mt-20 md:py-0">
                <div className="grid gap-6 md:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr]">
                    <div className="order-2 flex w-full flex-col gap-4 md:order-1 md:mx-0 md:max-w-[260px] xl:max-w-[280px]">
                        <div className="surface relative mx-auto hidden aspect-[2/3] w-full max-w-[220px] overflow-hidden rounded-lg md:block md:max-w-none">
                            {manga.coverUrl ? (
                                <img
                                    src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                                    alt={manga.title}
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                                    <BookOpen className="h-20 w-20 opacity-20" />
                                </div>
                            )}
                        </div>

                        <div className="surface rounded-lg p-4">
                            <h3 className="mb-3 font-semibold">Sources</h3>
                            <MangaSourceList slug={manga.slug} sources={manga.sources} />
                        </div>
                    </div>

                    <div className="order-1 min-w-0 space-y-5 md:order-2 md:pt-28">
                        <div className="grid gap-4 min-[460px]:grid-cols-[96px_1fr] md:block">
                            {manga.coverUrl && (
                                <div className="surface relative hidden aspect-[2/3] overflow-hidden rounded-lg min-[560px]:block md:hidden">
                                    <img
                                        src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                                        alt={manga.title}
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                            )}
                            <div className="min-w-0">
                                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{manga.title}</h1>
                                <div className="mt-2 flex items-center gap-4 text-muted-foreground">
                                    <span className="status-pill border-foreground/40 bg-card text-foreground">
                                        {manga.status || 'Unknown Status'}
                                    </span>
                                    {manga.author && <span>by {manga.author}</span>}
                                </div>
                            </div>
                        </div>

                        {summary?.latestChapter && (
                            <div className="surface rounded-lg p-3 sm:p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase text-muted-foreground">
                                            {summary.isCaughtUp ? "Caught up" : `${summary.unreadChapters} unread`}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-foreground">
                                            Latest chapter: {summary.latestChapter.chapterNumber}
                                            {summary.nextUnreadChapter ? ` · Next unread: ${summary.nextUnreadChapter.chapterNumber}` : ""}
                                        </p>
                                    </div>
                                    <div className="grid gap-2 min-[420px]:grid-cols-2 sm:flex sm:shrink-0">
                                        {primaryReadTarget?.url && (
                                            <a
                                                href={primaryReadOpensExternally ? primaryReadTarget.url : primaryReadTarget.id ? `/manga/${manga.slug}/chapter/${primaryReadTarget.id}` : primaryReadTarget.url}
                                                target={primaryReadOpensExternally ? "_blank" : undefined}
                                                rel={primaryReadOpensExternally ? "noopener noreferrer" : undefined}
                                                className="ui-button ui-button-primary justify-center"
                                            >
                                                <BookOpen className="h-4 w-4" />
                                                {summary.nextUnreadChapter ? `Read ${summary.nextUnreadChapter.chapterNumber}` : `Read latest`}
                                            </a>
                                        )}
                                        <a
                                            href={latestOpensExternally ? summary.latestChapter.url : summary.latestChapter.id ? `/manga/${manga.slug}/chapter/${summary.latestChapter.id}` : summary.latestChapter.url}
                                            target={latestOpensExternally ? "_blank" : undefined}
                                            rel={latestOpensExternally ? "noopener noreferrer" : undefined}
                                            className="ui-button ui-button-secondary justify-center"
                                        >
                                            Latest
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {summary?.syncStatus === "SYNCING" && (
                            <div className="surface rounded-lg border-primary/35 bg-card p-3 shadow-[0_6px_20px_hsl(var(--primary)/0.10)] sm:p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold uppercase text-primary">Syncing chapters</p>
                                        <p className="mt-1 text-sm font-medium text-muted-foreground">
                                            Mangateo is checking this manga&apos;s sources in the background.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {manga.description && (
                            <MangaDescription description={manga.description} />
                        )}

                        <div>
                            <ChapterList
                                mangaId={manga.id}
                                slug={manga.slug}
                                initialSources={manga.enabledSources}
                                initialChapters={[]}
                                initialNextCursor={null}
                                initialLastReadChapterNumber={manga.lastReadChapterNumber}
                            />
                        </div>
                    </div>
                </div>
            </div>
            <LegalFooter />
        </div>
    );
}
