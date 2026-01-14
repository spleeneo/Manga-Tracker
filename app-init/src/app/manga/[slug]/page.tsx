import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { BookOpen, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AddSourceDialog } from "@/components/add-source-dialog";
import { ChapterList } from "@/components/chapter-list";
import { ChapterItem } from "@/components/chapter-item";

interface PageProps {
    params: Promise<{
        slug: string;
    }>;
}

async function getManga(slug: string) {
    const manga = await prisma.manga.findUnique({
        where: { slug: slug },
        include: {
            sources: true,
            chapters: {
                orderBy: { chapterNumber: 'desc' },
            }
        }
    });

    if (!manga) return null;
    return manga;
}

export default async function MangaPage({ params }: PageProps) {
    const { slug } = await params;
    const manga = await getManga(slug);

    if (!manga) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-background pb-12">
            {/* Header / Banner Area */}
            <div className="relative h-64 w-full overflow-hidden bg-muted">
                {manga.coverUrl && (
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-30"
                        style={{ backgroundImage: `url(/api/proxy/image?url=${encodeURIComponent(manga.coverUrl)})` }}
                    />
                )}
                {/* Dark gradient overlay for text readability if needed, though mostly decorative here */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

                <div className="container mx-auto relative h-full px-4">
                    <Link
                        href="/"
                        className="absolute top-6 left-4 inline-flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm font-bold shadow-md hover:bg-muted transition-colors border"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Library
                    </Link>
                </div>
            </div>

            <div className="container mx-auto -mt-32 px-4 relative z-10">
                <div className="grid gap-8 md:grid-cols-[300px_1fr]">
                    {/* Sidebar / Cover */}
                    <div className="flex flex-col gap-4">
                        <div className="aspect-[2/3] overflow-hidden rounded-xl border bg-card shadow-2xl relative group">
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

                        <div className="rounded-xl border bg-card p-4 shadow-sm">
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
                                                className="flex items-center gap-2 text-sm text-primary hover:underline hover:text-primary/80"
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
                    <div className="space-y-8 pt-8 md:pt-32">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight">{manga.title}</h1>
                            <div className="mt-2 flex items-center gap-4 text-muted-foreground">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${manga.status === 'ONGOING' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                                    manga.status === 'COMPLETED' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                        'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                    }`}>
                                    {manga.status || 'Unknown Status'}
                                </span>
                                {manga.author && <span>by {manga.author}</span>}
                            </div>
                        </div>

                        {manga.description && (
                            <div className="prose prose-stone dark:prose-invert max-w-none">
                                <p>{manga.description}</p>
                            </div>
                        )}

                        <div>
                            <ChapterList
                                mangaId={manga.id}
                                slug={manga.slug}
                                initialSources={manga.sources}
                                initialChapters={manga.chapters as any}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Client component wrapper might be needed if using hooks, but date-fns is fine in server components if used carefully. 
// However, formatDistanceToNow returns a string.
// Let's just use a simple helper here to avoid hydration errors if dates mismatch, 
// though for this static generation it might be fine.
// Actually, let's keep it simple.
function useTimeAgo(date: Date) {
    // This is a naive implementation for server rendering. 
    // Ideally use a client component for relative time to avoid hydration mismatch.
    return date.toLocaleDateString();
}
