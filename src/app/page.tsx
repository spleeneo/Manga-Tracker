import { isDatabaseConfigured } from "@/lib/db";
import { AddMangaDialog } from "@/components/add-manga-dialog";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { LibraryHome } from "@/components/library-home";
import { ThemeSelector } from "@/components/theme-selector";
import { UpdateLibraryButton } from "@/components/update-library-button";
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

  return (
    <div className="min-h-screen bg-background">
      <header className="app-header">
        <div className="page-wrap flex h-16 items-center justify-between">
          <BrandLink />
          <div className="flex min-w-0 items-center gap-3">
            {session?.user && <AddMangaDialog />}
            {session?.user && <UpdateLibraryButton />}
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
        ) : (
          <LibraryHome />
        )}
      </main>
    </div>
  );
}
