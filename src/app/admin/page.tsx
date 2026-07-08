import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Activity, BookOpen, Database, Library, Server, Users } from "lucide-react";
import { auth } from "../../../auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { LegalFooter } from "@/components/legal-footer";
import { ThemeSelector } from "@/components/theme-selector";
import { AdminAccountsTable } from "@/components/admin-accounts-table";
import { accountHealth, sortAdminAccounts } from "@/lib/admin";
import { getLibraryMangaSummaries } from "@/lib/library-summary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
};

const numberFormatter = new Intl.NumberFormat("en");

export default async function AdminPage() {
  const session = await auth();
  if (!isAdmin(session?.user)) notFound();

  const [userCount, mangaCount, chapterCount, sourceCount, activeJobCount, users] = await Promise.all([
    prisma.user.count(),
    prisma.manga.count(),
    prisma.chapter.count(),
    prisma.source.count(),
    prisma.syncJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        library: { select: { syncStatus: true, syncStartedAt: true, lastReadAt: true } },
        parentLinks: { select: { status: true } }, childLink: { select: { status: true } },
        _count: { select: { sessions: true } },
      },
    }),
  ]);

  const accountRows = await Promise.all(users.map(async (user) => {
    const summaries = await getLibraryMangaSummaries(user.id);
    const health = accountHealth({ library: user.library, familyStatuses: [...user.parentLinks.map((link) => link.status), ...(user.childLink ? [user.childLink.status] : [])] });
    const lastReadAt = user.library.map((item) => item.lastReadAt).filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return { id: user.id, name: user.name || "Unnamed user", email: user.email || "No email", role: user.role, health: health.level, issues: health.issues, libraryCount: summaries.length, unreadCount: summaries.reduce((sum, item) => sum + item.unreadChapters, 0), lastReadAt, sessions: user._count.sessions };
  }));

  const stats = [
    { label: "Users", value: userCount, icon: Users },
    { label: "Manga", value: mangaCount, icon: Library },
    { label: "Chapters", value: chapterCount, icon: BookOpen },
    { label: "Sources", value: sourceCount, icon: Server },
    { label: "Active sync jobs", value: activeJobCount, icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="app-header">
        <div className="page-wrap app-header-row">
          <div className="contents md:flex md:min-w-0 md:items-center md:gap-3">
            <BrandLink />
            <AppNav isAdmin />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeSelector />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="page-wrap py-8">
        <div className="mb-8 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Database className="h-6 w-6" /></div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin dashboard</h1>
            <p className="mt-1 text-muted-foreground">System health and account overview.</p>
          </div>
        </div>

        <section aria-label="System totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map(({ label, value, icon: Icon }) => (
            <article key={label} className="surface rounded-lg p-5">
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span className="text-sm font-medium">{label}</span>
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums">{numberFormatter.format(value)}</p>
            </article>
          ))}
        </section>

        <AdminAccountsTable accounts={sortAdminAccounts(accountRows).map((account) => ({ ...account, lastReadAt: account.lastReadAt?.toISOString() ?? null }))} />
      </main>
      <LegalFooter />
    </div>
  );
}
