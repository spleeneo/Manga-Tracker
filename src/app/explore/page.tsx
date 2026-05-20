import { notFound } from "next/navigation";
import { AddMangaDialog } from "@/components/add-manga-dialog";
import { AppNav } from "@/components/app-nav";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { ChatDrawer } from "@/components/chat-drawer";
import { ExplorePage } from "@/components/explore-page";
import { LegalFooter } from "@/components/legal-footer";
import { ThemeSelector } from "@/components/theme-selector";
import { UpdateLibraryButton } from "@/components/update-library-button";
import { auth } from "../../../auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="app-header">
        <div className="page-wrap app-header-row">
          <BrandLink />
          <AppNav />
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <AddMangaDialog />
            <UpdateLibraryButton />
            <ChatDrawer
              currentUser={{
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }}
            />
            <ThemeSelector />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="page-wrap py-8">
        <ExplorePage />
      </main>
      <LegalFooter />
    </div>
  );
}
