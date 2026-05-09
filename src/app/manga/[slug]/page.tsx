import { isDatabaseConfigured, prisma } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";
import { AddSourceDialog } from "@/components/add-source-dialog";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { ChapterList } from "@/components/chapter-list";
import { ThemeSelector } from "@/components/theme-selector";
import { CHAPTER_PAGE_SIZE, getMangaChapterPage, type ChapterView } from "@/lib/chapters";
import { auth } from "../../../../auth";

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
        select: { lastReadChapterNumber: true },
    });
    if (!tracked) return null;

    const chapterPage = await getMangaChapterPage({
        mangaId: manga.id,
        limit: CHAPTER_PAGE_SIZE,
        lastReadChapterNumber: tracked.lastReadChapterNumber,
    });

    return {
        ...manga,
        chapters: chapterPage.chapters,
        nextChapterCursor: chapterPage.nextCursor,
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

    return (
        <div className="min-h-screen bg-background pb-12">
            {/* Header / Banner Area */}
            <div className="relative h-60 w-full overflow-hidden border-b bg-muted">
                {manga.coverUrl && (
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-25"
                        style={{ backgroundImage: `url(/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)})` }}
                    />
                )}
                {/* Dark gradient overlay for text readability if needed, though mostly decorative here */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />

                <div className="page-wrap relative h-full">
                    <div className="absolute left-4 top-5">
                        <div className="flex items-center gap-2">
                            <Link
                                href="/"
                                className="ui-icon-button"
                                aria-label="Back to library"
                                title="Back to library"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                            <BrandLink />
                        </div>
                    </div>
                    <div className="absolute right-4 top-6 flex items-center gap-3">
                        <ThemeSelector />
                        <AuthButton />
                    </div>
                </div>
            </div>

            <div className="page-wrap relative z-10 -mt-28">
                <div className="grid gap-6 md:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr]">
                    {/* Sidebar / Cover */}
                    <div className="mx-auto flex w-full max-w-[260px] flex-col gap-4 md:mx-0 xl:max-w-[280px]">
                        <div className="surface group relative aspect-[2/3] overflow-hidden rounded-lg">
                            {manga.coverUrl ? (
                                <img
                                    src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                                    alt={manga.title}
                                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                                    <BookOpen className="h-20 w-20 opacity-20" />
                                </div>
                            )}
                        </div>

                        <div className="surface rounded-lg p-4">
                            <h3 className="font-semibold mb-3">Sources</h3>
                            {manga.sources.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No sources linked yet.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {manga.sources.map((source: { id: string; sourceUrl: string; sourceName: string }) => (
                                        <li key={source.id}>
                                            <a
                                                href={source.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                {source.sourceName}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Add Source Button */}
                            <AddSourceDialog mangaId={manga.id} />
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="min-w-0 space-y-6 pt-8 md:pt-28">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight">{manga.title}</h1>
                            <div className="mt-2 flex items-center gap-4 text-muted-foreground">
                                <span className="status-pill border-foreground/40 bg-card text-foreground">
                                    {manga.status || 'Unknown Status'}
                                </span>
                                {manga.author && <span>by {manga.author}</span>}
                            </div>
                        </div>

                        {manga.description && (
                            <div className="surface-soft rounded-lg p-4 text-sm leading-7 text-muted-foreground">
                                <p>{manga.description}</p>
                            </div>
                        )}

                        <div>
                            <ChapterList
                                mangaId={manga.id}
                                slug={manga.slug}
                                initialSources={manga.sources}
                                initialChapters={manga.chapters as ChapterView[]}
                                initialNextCursor={manga.nextChapterCursor}
                                initialLastReadChapterNumber={manga.lastReadChapterNumber}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
