import type { Metadata } from "next";
import Link from "next/link";
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
        _count: { select: { library: true, sessions: true } },
      },
    }),
  ]);

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

        <section className="surface mt-8 overflow-hidden rounded-lg">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold">Accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">Up to 50 accounts, with access and activity at a glance.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 text-right font-semibold">Library</th>
                  <th className="px-5 py-3 text-right font-semibold">Sessions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4">
                      <Link href={`/admin/users/${user.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {user.name || "Unnamed user"}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{user.email || "No email"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${user.role === "ADMIN" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {user.role === "ADMIN" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{user._count.library}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{user._count.sessions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
