import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "../../../../../auth";
import { AppNav } from "@/components/app-nav";
import { AuthButton } from "@/components/auth-button";
import { BrandLink } from "@/components/brand-link";
import { LegalFooter } from "@/components/legal-footer";
import { ThemeSelector } from "@/components/theme-selector";
import { AdminUserDetail, type AdminUserDetailData } from "@/components/admin-user-detail";
import { accountHealth, buildAccountIssues, deriveActivity, isAdmin, isRetryableSync } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getLibraryMangaSummaries } from "@/lib/library-summary";
import { DEFAULT_ALLOWED_CONTENT_RATINGS, DEFAULT_BLOCKED_TAG_NAMES, evaluateMangaAccess } from "@/lib/parental-controls";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account | Admin" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId || !isAdmin(session?.user)) notFound();
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, emailVerified: true,
      accounts: { select: { provider: true } }, sessions: { select: { expires: true } },
      childPolicy: true, childOverrides: { select: { mangaId: true, decision: true } },
      childLink: { select: { id: true, status: true, parent: { select: { id: true, name: true, email: true } } } },
      parentLinks: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, childEmail: true, child: { select: { id: true, name: true, email: true } } } },
      library: { orderBy: { createdAt: "desc" }, select: {
        id: true, mangaId: true, status: true, createdAt: true, syncStatus: true, syncStartedAt: true, syncError: true,
        preferredSource: { select: { sourceName: true, failureCount: true, lastError: true } },
        manga: { select: { title: true, slug: true, contentRating: true, classificationSource: true, tags: { select: { tag: { select: { name: true } } } } } },
      } },
    },
  });
  if (!user) notFound();

  const isChild = user.childLink?.status === "ACTIVE";
  const [summaries, recentReads, readChapterCount, lastChat, chatMessageCount, jobs] = await Promise.all([
    getLibraryMangaSummaries(user.id, isChild),
    prisma.userChapter.findMany({ where: { userId: user.id, isRead: true, readAt: { not: null } }, orderBy: { readAt: "desc" }, take: 12, select: { readAt: true, chapter: { select: { chapterNumber: true, manga: { select: { title: true } } } } } }),
    prisma.userChapter.count({ where: { userId: user.id, isRead: true } }),
    prisma.chatMessage.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.chatMessage.count({ where: { userId: user.id } }),
    prisma.syncJob.findMany({ where: { mangaId: { in: user.library.map((item) => item.mangaId) } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, userId: true, status: true, error: true, createdAt: true, manga: { select: { title: true } } } }),
  ]);
  const summaryByManga = new Map(summaries.map((item) => [item.id, item]));
  const overrideByManga = new Map(user.childOverrides.map((item) => [item.mangaId, item.decision]));
  const policy = isChild ? (user.childPolicy ?? { enabled: true, allowedContentRatings: DEFAULT_ALLOWED_CONTENT_RATINGS, blockedTagNames: DEFAULT_BLOCKED_TAG_NAMES }) : null;
  const health = accountHealth({ library: user.library, familyStatuses: [...user.parentLinks.map((link) => link.status), ...(user.childLink ? [user.childLink.status] : [])] });
  const activity = deriveActivity({ readDates: recentReads.flatMap((item) => item.readAt ? [item.readAt] : []), trackedDates: user.library.map((item) => item.createdAt), chatDates: lastChat ? [lastChat.createdAt] : [] });
  const recentActivity = [
    ...recentReads.map((item) => ({ label: "Chapter read", detail: `${item.chapter.manga.title} · chapter ${item.chapter.chapterNumber}`, at: item.readAt })),
    ...user.library.slice(0, 8).map((item) => ({ label: "Title tracked", detail: item.manga.title, at: item.createdAt })),
    ...(lastChat ? [{ label: "Chat activity", detail: "Message sent (content hidden)", at: lastChat.createdAt }] : []),
  ].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0)).slice(0, 20);
  const familyLinks = [
    ...(user.childLink ? [{ id: user.childLink.id, label: "Parent", accountId: user.childLink.parent.id, name: user.childLink.parent.name || user.childLink.parent.email || "Unnamed", email: user.childLink.parent.email || "No email", status: user.childLink.status }] : []),
    ...user.parentLinks.map((link) => ({ id: link.id, label: "Child", accountId: link.child?.id ?? null, name: link.child?.name || link.child?.email || link.childEmail, email: link.child?.email || link.childEmail, status: link.status })),
  ];
  const issueDetails = buildAccountIssues({
    library: user.library.map((item) => ({ id: item.id, title: item.manga.title, syncStatus: item.syncStatus, syncStartedAt: item.syncStartedAt, syncError: item.syncError })),
    familyLinks: familyLinks.map((link) => ({ label: `${link.label} relationship with ${link.name}`, status: link.status })),
  });

  const data: AdminUserDetailData = {
    id: user.id, actorId, name: user.name || "Unnamed user", email: user.email || "No email", role: user.role,
    providers: [...new Set(user.accounts.map((item) => item.provider))], emailVerified: user.emailVerified?.toISOString() ?? null,
    familyRole: user.childLink ? "Child" : user.parentLinks.length ? "Parent" : "No family role", health: health.level, issues: health.issues,
    issueDetails: issueDetails.map((issue) => ({ ...issue, startedAt: issue.startedAt?.toISOString() ?? null })),
    activeSessions: user.sessions.filter((item) => item.expires > new Date()).length,
    accountFacts: { userId: user.id, totalSessions: user.sessions.length, expiredSessions: user.sessions.filter((item) => item.expires <= new Date()).length, readChapterCount, chatMessageCount, relevantJobCount: jobs.length },
    lastReadAt: activity.lastReadAt?.toISOString() ?? null, lastTrackedAt: activity.lastTrackedAt?.toISOString() ?? null, lastChatAt: activity.lastChatAt?.toISOString() ?? null,
    library: user.library.map((item) => { const summary = summaryByManga.get(item.mangaId); const access = policy ? evaluateMangaAccess(policy, { contentRating: item.manga.contentRating, classificationSource: item.manga.classificationSource, tags: item.manga.tags.map(({ tag }) => tag.name) }, overrideByManga.get(item.mangaId) as "ALLOW" | "BLOCK" | undefined) : { reason: "allowed" }; return {
      id: item.id, title: item.manga.title, slug: item.manga.slug, status: item.status, syncStatus: item.syncStatus, syncStartedAt: item.syncStartedAt?.toISOString() ?? null, syncError: item.syncError,
      retryable: isRetryableSync(item),
      lastReadAt: summary?.lastReadAt?.toISOString() ?? null, lastReadChapterNumber: summary?.lastReadChapterNumber ?? null, latestChapterNumber: summary?.latestChapter?.chapterNumber ?? null, unreadChapters: summary?.unreadChapters ?? 0,
      preferredSource: item.preferredSource?.sourceName ?? null, sourceFailureCount: item.preferredSource?.failureCount ?? 0, sourceError: item.preferredSource?.lastError ?? null, accessReason: access.reason,
    }; }),
    recentActivity: recentActivity.map((item) => ({ ...item, at: item.at?.toISOString() ?? null })),
    jobs: jobs.map((job) => ({ id: job.id, mangaTitle: job.manga.title, status: job.status, error: job.error, createdAt: job.createdAt.toISOString(), userAttributed: job.userId === user.id })),
    familyLinks, policy: policy ? { enabled: policy.enabled, allowedContentRatings: policy.allowedContentRatings ?? DEFAULT_ALLOWED_CONTENT_RATINGS, blockedTagNames: policy.blockedTagNames } : null, overrideCount: user.childOverrides.length,
  };

  return <div className="min-h-screen bg-background"><header className="app-header"><div className="page-wrap app-header-row"><div className="contents md:flex md:min-w-0 md:items-center md:gap-3"><BrandLink /><AppNav isAdmin /></div><div className="flex shrink-0 items-center gap-2 sm:gap-3"><ThemeSelector /><AuthButton /></div></div></header><main className="page-wrap py-8"><Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back to admin</Link><AdminUserDetail data={data} /></main><LegalFooter /></div>;
}
