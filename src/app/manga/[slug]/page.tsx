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

    return {
        ...manga,
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
            <div className="relative h-16 w-full overflow-hidden border-b bg-background md:h-60 md:bg-muted">
                {manga.coverUrl && (
                    <div
                        className="absolute inset-0 hidden bg-cover bg-center opacity-25 md:block"
                        style={{ backgroundImage: `url(/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)})` }}
                    />
                )}
                <div className="absolute inset-0 hidden bg-gradient-to-t from-background via-background/70 to-background/20 md:block" />

                <div className="page-wrap relative flex h-full items-center justify-between">
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
                    <div className="flex items-center gap-2 sm:gap-3">
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
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                                    <BookOpen className="h-20 w-20 opacity-20" />
                                </div>
                            )}
                        </div>

                        <div className="surface rounded-lg p-4">
                            <h3 className="mb-3 font-semibold">Sources</h3>
                            {manga.sources.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No sources linked yet.</p>
                            ) : (
                                <ul className="flex flex-wrap gap-2 md:block md:space-y-2">
                                    {manga.sources.map((source: { id: string; sourceUrl: string; sourceName: string }) => (
                                        <li key={source.id}>
                                            <a
                                                href={source.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:border-0 md:bg-transparent md:px-2"
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

                    <div className="order-1 min-w-0 space-y-5 md:order-2 md:pt-28">
                        <div className="grid gap-4 min-[460px]:grid-cols-[96px_1fr] md:block">
                            {manga.coverUrl && (
                                <div className="surface relative hidden aspect-[2/3] overflow-hidden rounded-lg min-[460px]:block md:hidden">
                                    <img
                                        src={`/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)}`}
                                        alt={manga.title}
                                        className="h-full w-full object-cover"
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

                        {manga.description && (
                            <div className="surface-soft rounded-lg p-4 text-sm leading-7 text-muted-foreground md:line-clamp-none">
                                <p>{manga.description}</p>
                            </div>
                        )}

                        <div>
                            <ChapterList
                                mangaId={manga.id}
                                slug={manga.slug}
                                initialSources={manga.sources}
                                initialChapters={[]}
                                initialNextCursor={null}
                                initialLastReadChapterNumber={manga.lastReadChapterNumber}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
