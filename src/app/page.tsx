import { isDatabaseConfigured } from "@/lib/db";
import { AddMangaDialog } from "@/components/add-manga-dialog";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { LibraryDashboard } from "@/components/library-dashboard";
import { ThemeSelector } from "@/components/theme-selector";
import { getLibraryMangaSummaries, type LibraryMangaSummary } from "@/lib/library-summary";
import { auth } from "../../auth";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();

  if (!isDatabaseConfigured) {
    return (
      <div className="min-h-screen bg-background">
        <header className="app-header">
          <div className="page-wrap flex h-16 items-center justify-between">
            <BrandLink />
            <div className="flex min-w-0 items-center gap-3">
              <ThemeSelector />
              <AuthButton />
            </div>
          </div>
        </header>

        <main className="page-wrap py-8">
          <div className="empty-state">
            <h2 className="text-xl font-semibold">Database setup needed</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Create a free Neon Postgres database, copy `.env.example` to `.env`, fill `DATABASE_URL` and `DIRECT_URL`, then run `npm run db:migrate`.
            </p>
          </div>
        </main>
      </div>
    );
  }

  let mangas: LibraryMangaSummary[] = [];
  if (session?.user?.id) {
    try {
      mangas = await getLibraryMangaSummaries(session.user.id);
    } catch (e) {
      console.error("Failed to load mangas - database might not be initialized", e);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="app-header">
        <div className="page-wrap flex h-16 items-center justify-between">
          <BrandLink />
          <div className="flex min-w-0 items-center gap-3">
            {session?.user && <AddMangaDialog />}
            <ThemeSelector />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="page-wrap py-8">
        {!session?.user ? (
          <div className="empty-state">
            <h2 className="text-xl font-semibold">Sign in to view your library</h2>
            <p className="mt-2 max-w-lg text-muted-foreground">
              Manga, sources, and chapters are shared in the background, but your tracked library and read progress are private to your account.
            </p>
          </div>
        ) : mangas.length === 0 ? (
          <div className="empty-state">
            <h2 className="text-xl font-semibold">No manga tracked yet</h2>
            <p className="mt-2 text-muted-foreground">
              Add your first manga to start tracking releases.
            </p>
          </div>
        ) : (
          <LibraryDashboard mangas={mangas} />
        )}
      </main>
    </div>
  );
}
