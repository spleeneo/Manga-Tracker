import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarClock, KeyRound, Library, MessagesSquare, Users } from "lucide-react";
import { auth } from "../../../../../auth";
import { AppNav } from "@/components/app-nav";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { LegalFooter } from "@/components/legal-footer";
import { ThemeSelector } from "@/components/theme-selector";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account | Admin",
};

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin(session?.user)) notFound();

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      accounts: { select: { provider: true } },
      sessions: { select: { expires: true }, orderBy: { expires: "desc" } },
      childLink: {
        select: { status: true, parent: { select: { id: true, name: true, email: true } } },
      },
      parentLinks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          childEmail: true,
          child: { select: { id: true, name: true, email: true } },
        },
      },
      library: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          lastReadChapterNumber: true,
          lastReadAt: true,
          syncStatus: true,
          syncError: true,
          manga: { select: { title: true, slug: true, chapters: { select: { chapterNumber: true }, orderBy: { chapterNumber: "desc" }, take: 1 } } },
          preferredSource: { select: { sourceName: true } },
        },
      },
      _count: { select: { chapters: { where: { isRead: true } }, chatMessages: true, syncJobs: true } },
    },
  });

  if (!user) notFound();

  const activeSessions = user.sessions.filter((item) => item.expires > new Date()).length;
  const providers = [...new Set(user.accounts.map((account) => account.provider))];
  const familyRole = user.childLink ? "Child" : user.parentLinks.length > 0 ? "Parent" : "None";
  const stats = [
    { label: "Library titles", value: user.library.length, icon: Library },
    { label: "Read chapters", value: user._count.chapters, icon: BookOpen },
    { label: "Active sessions", value: activeSessions, icon: KeyRound },
    { label: "Chat messages", value: user._count.chatMessages, icon: MessagesSquare },
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
        <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back to admin</Link>

        <section className="surface mt-5 rounded-lg p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-7 w-7" /></div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold sm:text-3xl">{user.name || "Unnamed user"}</h1>
                <p className="mt-1 truncate text-sm text-muted-foreground">{user.email || "No email address"}</p>
              </div>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${user.role === "ADMIN" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {user.role === "ADMIN" ? "Admin" : "User"}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Sign-in providers</dt><dd className="mt-1 font-medium capitalize">{providers.join(", ") || "None"}</dd></div>
            <div><dt className="text-muted-foreground">Email verified</dt><dd className="mt-1 font-medium">{user.emailVerified ? dateFormatter.format(user.emailVerified) : "Not verified"}</dd></div>
            <div><dt className="text-muted-foreground">Family role</dt><dd className="mt-1 font-medium">{familyRole}</dd></div>
          </dl>
        </section>

        <section aria-label="Account totals" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <article key={label} className="surface rounded-lg p-5">
              <div className="flex items-center justify-between gap-3 text-muted-foreground"><span className="text-sm font-medium">{label}</span><Icon className="h-4 w-4" /></div>
              <p className="mt-3 text-3xl font-bold tabular-nums">{value}</p>
            </article>
          ))}
        </section>

        {(user.childLink || user.parentLinks.length > 0) && (
          <section className="surface mt-6 rounded-lg p-5">
            <h2 className="text-lg font-semibold">Family connections</h2>
            <div className="mt-4 space-y-3 text-sm">
              {user.childLink && <FamilyMember label="Parent" id={user.childLink.parent.id} name={user.childLink.parent.name} email={user.childLink.parent.email} status={user.childLink.status} />}
              {user.parentLinks.map((link) => <FamilyMember key={link.id} label="Child" id={link.child?.id} name={link.child?.name} email={link.child?.email || link.childEmail} status={link.status} />)}
            </div>
          </section>
        )}

        <section className="surface mt-6 overflow-hidden rounded-lg">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold">Library</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tracked titles, reading progress, and synchronization state.</p>
          </div>
          {user.library.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">This account has no tracked manga.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-5 py-3 font-semibold">Title</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Progress</th><th className="px-5 py-3 font-semibold">Source</th><th className="px-5 py-3 font-semibold">Sync</th><th className="px-5 py-3 font-semibold">Last read</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {user.library.map((item) => {
                    const latestChapter = item.manga.chapters[0]?.chapterNumber;
                    return (
                      <tr key={item.id}>
                        <td className="px-5 py-4"><Link href={`/manga/${item.manga.slug}`} className="font-medium hover:text-primary hover:underline">{item.manga.title}</Link></td>
                        <td className="px-5 py-4 capitalize">{item.status.toLowerCase()}</td>
                        <td className="px-5 py-4 tabular-nums">{item.lastReadChapterNumber ?? "—"}{latestChapter != null ? ` / ${latestChapter}` : ""}</td>
                        <td className="px-5 py-4">{item.preferredSource?.sourceName || "Automatic"}</td>
                        <td className="px-5 py-4"><span title={item.syncError || undefined} className={item.syncStatus === "FAILED" ? "font-medium text-red-500" : ""}>{item.syncStatus.toLowerCase()}</span></td>
                        <td className="px-5 py-4 text-muted-foreground">{item.lastReadAt ? dateFormatter.format(item.lastReadAt) : "Never"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> {user._count.syncJobs} sync jobs recorded for this account.</p>
      </main>
      <LegalFooter />
    </div>
  );
}

function FamilyMember({ label, id, name, email, status }: { label: string; id?: string; name?: string | null; email?: string | null; status: string }) {
  const content = <><span className="font-medium">{label}: {name || email || "Pending account"}</span><span className="text-muted-foreground">{email && name ? email : ""} · {status.toLowerCase()}</span></>;
  return id ? <Link href={`/admin/users/${id}`} className="flex flex-col rounded-md border border-border p-3 hover:bg-muted/50">{content}</Link> : <div className="flex flex-col rounded-md border border-border p-3">{content}</div>;
}
