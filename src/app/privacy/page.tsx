import type { Metadata } from "next";
import Link from "next/link";
import { BrandLink } from "@/components/brand-link";
import { ThemeSelector } from "@/components/theme-selector";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Mangateo privacy policy for users and Google OAuth review.",
};

const lastUpdated = "May 11, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="app-header">
        <div className="page-wrap flex h-16 items-center justify-between">
          <BrandLink />
          <div className="flex items-center gap-2">
            <ThemeSelector />
          </div>
        </div>
      </header>

      <main className="page-wrap py-8">
        <article className="surface mx-auto max-w-3xl rounded-lg p-5 sm:p-8">
          <p className="text-sm font-semibold uppercase text-muted-foreground">Last updated: {lastUpdated}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-4 leading-7 text-muted-foreground">
            Mangateo is a personal manga tracking application. This policy explains what information Mangateo
            collects, how it is used, and how users can request deletion of their data.
          </p>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">Information We Collect</h2>
            <p className="leading-7 text-muted-foreground">
              When you sign in with Google, Mangateo receives your Google account identifier, email address,
              display name, and profile image if Google provides them. Mangateo also stores the manga you track,
              your reading progress, linked manga sources, global chat messages, and any images you choose to
              upload to chat.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">How We Use Information</h2>
            <p className="leading-7 text-muted-foreground">
              Account information is used to sign you in and keep your library private to your account. Manga
              library and reading progress data is used to show your tracked manga, unread chapters, and reading
              state. Chat data is used to display global chat history to signed-in users.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">Data Sharing</h2>
            <p className="leading-7 text-muted-foreground">
              Mangateo does not sell personal information. Data is processed by the services needed to run the
              app: Google for sign-in, Vercel for hosting and file storage, Neon for the database, and Ably for
              realtime chat delivery. Manga source providers may be contacted when Mangateo searches or updates
              manga metadata and chapters.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">Public And Shared Content</h2>
            <p className="leading-7 text-muted-foreground">
              Your personal manga library and reading progress are private to your signed-in account. Manga
              metadata, sources, and chapter records are shared application data. Global chat messages and chat
              images are visible to other signed-in Mangateo users.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">Retention And Deletion</h2>
            <p className="leading-7 text-muted-foreground">
              Mangateo keeps account, library, progress, and chat data while the service is active or until
              deletion is requested. To request account or data deletion, contact the app owner at{" "}
              <a
                href="mailto:mateo.parache@gmail.com"
                className="font-semibold text-foreground underline underline-offset-4"
              >
                mateo.parache@gmail.com
              </a>
              .
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">Security</h2>
            <p className="leading-7 text-muted-foreground">
              Mangateo uses Google OAuth for authentication and stores application data in hosted services with
              access controls. No method of transmission or storage is perfectly secure, but Mangateo limits data
              access to what is needed for the app to function.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-xl font-bold">Changes</h2>
            <p className="leading-7 text-muted-foreground">
              This policy may be updated as Mangateo changes. The latest version will always be available on this
              page.
            </p>
          </section>

          <div className="mt-8">
            <Link href="/" className="ui-button ui-button-secondary">
              Back to Mangateo
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
