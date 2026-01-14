import { prisma } from "@/lib/db";
import { MangaCard } from "@/components/manga-card";
import { AddMangaDialog } from "@/components/add-manga-dialog";

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Use try-catch to handle the case where database might not be set up yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mangas: any[] = [];
  try {
    mangas = await prisma.manga.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        chapters: {
          orderBy: { chapterNumber: 'desc' },
        }
      }
    });
  } catch (e) {
    console.error("Failed to load mangas - database might not be initialized", e);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Manga Tracker
          </h1>
          <AddMangaDialog />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {mangas.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
            <h2 className="text-xl font-semibold">No manga tracked yet</h2>
            <p className="mt-2 text-muted-foreground">
              Add your first manga to start tracking releases.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {mangas.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
