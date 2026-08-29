"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, BookOpen, CheckCircle2, Clock3, RefreshCw, Shield, Users } from "lucide-react";

type LibraryItem = { id: string; title: string; slug: string; status: string; syncStatus: string; syncStartedAt: string | null; syncError: string | null; retryable: boolean; lastReadAt: string | null; lastReadChapterNumber: number | null; latestChapterNumber: number | null; unreadChapters: number; preferredSource: string | null; sourceFailureCount: number; sourceError: string | null; accessReason: string };
type ActivityItem = { label: string; detail: string; at: string | null };
type Job = { id: string; mangaTitle: string; status: string; error: string | null; createdAt: string; userAttributed: boolean };
type FamilyLink = { id: string; label: string; accountId: string | null; name: string; email: string; status: string };
type IssueDetail = { kind: "failed_sync" | "stale_sync" | "family_setup"; title: string; summary: string; detail: string; startedAt: string | null; userMangaId: string | null };
type InsightSegment = { label: string; value: number; className: string };

export type AdminUserDetailData = {
  id: string; actorId: string; name: string; email: string; role: "USER" | "ADMIN"; providers: string[]; emailVerified: string | null; familyRole: string;
  health: "healthy" | "attention"; issues: string[]; activeSessions: number; library: LibraryItem[];
  issueDetails: IssueDetail[]; accountFacts: { userId: string; totalSessions: number; expiredSessions: number; readChapterCount: number; chatMessageCount: number; relevantJobCount: number };
  lastReadAt: string | null; lastTrackedAt: string | null; lastChatAt: string | null; recentActivity: ActivityItem[]; jobs: Job[];
  familyLinks: FamilyLink[]; policy: { enabled: boolean; blockedTagNames: string[]; allowedContentRatings: string[] } | null; overrideCount: number;
};

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value: string | null) => value ? dateFormatter.format(new Date(value)) : "Never";

export function AdminUserDetail({ data }: { data: AdminUserDetailData }) {
  const router = useRouter();
  const [tab, setTab] = useState<"library" | "activity" | "family">("library");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [syncFilter, setSyncFilter] = useState(data.issueDetails.length > 0 ? "PROBLEM" : "ALL");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const unread = data.library.reduce((sum, item) => sum + item.unreadChapters, 0);
  const retryable = useMemo(() => data.library.filter((item) => item.retryable), [data.library]);
  const retryableIssueIds = useMemo(() => data.issueDetails.flatMap((issue) => issue.userMangaId ? [issue.userMangaId] : []), [data.issueDetails]);
  const syncSegments = useMemo(() => buildSyncSegments(data.library), [data.library]);
  const issueSegments = useMemo(() => buildIssueSegments(data.issueDetails), [data.issueDetails]);
  const readTotal = data.accountFacts.readChapterCount + unread;
  const readPercent = percent(data.accountFacts.readChapterCount, readTotal);
  const library = useMemo(() => data.library
    .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => statusFilter === "ALL" || item.status === statusFilter)
    .filter((item) => syncFilter === "ALL" || (syncFilter === "PROBLEM" ? item.retryable : item.syncStatus === syncFilter))
    .sort((a, b) => Number(b.retryable) - Number(a.retryable)), [data.library, query, statusFilter, syncFilter]);

  const act = (request: () => Promise<Response>, success: (body: Record<string, unknown>) => string) => startTransition(async () => {
    setMessage("");
    const response = await request();
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(String(body.error ?? "Action failed"));
      return;
    }
    setMessage(success(body));
    router.refresh();
  });

  const retry = (ids?: string[]) => act(
    () => fetch(`/api/admin/users/${data.id}/sync-retries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ids ? { userMangaIds: ids } : {}),
    }),
    (body) => `${body.queued ?? 0} synchronization${body.queued === 1 ? "" : "s"} queued.`,
  );
  const changeRole = () => {
    const next = data.role === "ADMIN" ? "USER" : "ADMIN";
    if (!confirm(`Change ${data.name}'s role to ${next.toLowerCase()}?`)) return;
    act(() => fetch(`/api/admin/users/${data.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: next }) }), () => "Role updated.");
  };
  const revokeSessions = () => {
    if (!confirm(`Sign ${data.name} out of every active session?`)) return;
    act(() => fetch(`/api/admin/users/${data.id}/sessions`, { method: "DELETE" }), (body) => `${body.revoked ?? 0} session${body.revoked === 1 ? "" : "s"} revoked.`);
  };
  const unlink = (link: FamilyLink) => {
    if (!confirm(`Unlink ${link.name}? The child policy and title overrides for this relationship will be removed.`)) return;
    act(() => fetch(`/api/admin/users/${data.id}/family-links/${link.id}`, { method: "DELETE" }), () => "Family relationship removed.");
  };
  return (
    <>
      <section className="surface mt-5 rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-6 w-6" /></div>
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">{data.name}</h1>
                <p className="text-sm text-muted-foreground">{data.email}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{data.role === "ADMIN" ? "Admin" : "User"}</Badge>
              <Badge>{data.familyRole}</Badge>
              {data.providers.map((provider) => <Badge key={provider}>{provider}</Badge>)}
            </div>
          </div>
          <div className={`rounded-lg border p-4 lg:w-96 ${data.health === "attention" ? "border-amber-500/40 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}>
            <div className="flex items-center gap-2 font-semibold">
              {data.health === "attention" ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {data.health === "attention" ? "Needs attention" : "Account healthy"}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {retryable.length > 0 ? `${retryable.length} sync ${retryable.length === 1 ? "job needs" : "jobs need"} recovery.` : "No retryable syncs detected."}
            </p>
            {retryableIssueIds.length > 0 && (
              <button disabled={pending} onClick={() => retry(retryableIssueIds)} className="ui-button ui-button-primary mt-4 w-full">
                <RefreshCw className="h-4 w-4" />
                Retry problem syncs
              </button>
            )}
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-4">
          <Fact label="Email verified" value={formatDate(data.emailVerified)} />
          <Fact label="Last chapter read" value={formatDate(data.lastReadAt)} />
          <Fact label="Last title tracked" value={formatDate(data.lastTrackedAt)} />
          <Fact label="Last chat message" value={formatDate(data.lastChatAt)} />
        </dl>
      </section>

      <section aria-label="Quick insights" className="mt-6">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Quick insights</h2>
          <p className="text-sm text-muted-foreground">Visual triage for sync health, issue type, and reading load.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <InsightPanel title="Sync health" icon={<RefreshCw className="h-4 w-4" />}>
            <StackedBar segments={syncSegments} total={data.library.length} />
            <Legend segments={syncSegments} totalLabel={`${data.library.length} titles`} />
          </InsightPanel>
          <InsightPanel title="Issue mix" icon={data.health === "attention" ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}>
            <IssueBars segments={issueSegments} />
          </InsightPanel>
          <InsightPanel title="Reading load" icon={<BookOpen className="h-4 w-4" />}>
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-3xl font-bold tabular-nums">{unread}</p><p className="text-sm text-muted-foreground">unread chapters</p></div>
              <div className="text-right"><p className="text-3xl font-bold tabular-nums">{data.library.length}</p><p className="text-sm text-muted-foreground">titles</p></div>
            </div>
            <ProgressMeter label="Read progress" value={readPercent} detail={`${data.accountFacts.readChapterCount} read of ${readTotal || 0} known chapters`} />
          </InsightPanel>
        </div>
      </section>

      <section className="surface mt-6 rounded-lg p-5">
        <h2 className="text-lg font-semibold">Account facts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Stored identity and usage totals; no tokens or message contents are exposed.</p>
        <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="User ID" value={data.accountFacts.userId} mono />
          <Fact label="Authentication" value={data.providers.join(", ") || "No provider"} />
          <Fact label="Sessions" value={`${data.activeSessions} active / ${data.accountFacts.expiredSessions} expired / ${data.accountFacts.totalSessions} total`} />
          <Fact label="Read chapters" value={String(data.accountFacts.readChapterCount)} />
          <Fact label="Chat messages" value={String(data.accountFacts.chatMessageCount)} />
          <Fact label="Relevant sync jobs" value={String(data.accountFacts.relevantJobCount)} />
        </dl>
      </section>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {([["library", "Library"], ["activity", "Activity & sync"], ["family", "Family & access"]] as const).map(([id, label]) => (
          <button key={id} className={`px-4 py-3 text-sm font-semibold ${tab === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {message && <p role="status" className="mt-4 rounded-md bg-muted p-3 text-sm">{message}</p>}

      {tab === "library" && <LibraryDiagnostics library={library} pending={pending} query={query} retry={retry} setQuery={setQuery} setStatusFilter={setStatusFilter} setSyncFilter={setSyncFilter} statusFilter={statusFilter} syncFilter={syncFilter} allLibrary={data.library} />}
      {tab === "activity" && <ActivityAndJobs activity={data.recentActivity} jobs={data.jobs} />}
      {tab === "family" && <FamilyAndControls data={data} pending={pending} changeRole={changeRole} revokeSessions={revokeSessions} unlink={unlink} />}
    </>
  );
}

function LibraryDiagnostics({ allLibrary, library, pending, query, retry, setQuery, setStatusFilter, setSyncFilter, statusFilter, syncFilter }: { allLibrary: LibraryItem[]; library: LibraryItem[]; pending: boolean; query: string; retry: (ids?: string[]) => void; setQuery: (value: string) => void; setStatusFilter: (value: string) => void; setSyncFilter: (value: string) => void; statusFilter: string; syncFilter: string }) {
  return (
    <section className="surface mt-4 overflow-hidden rounded-lg">
      <div className="border-b border-border p-5">
        <h2 className="text-lg font-semibold">Library diagnostics</h2>
        <p className="text-sm text-muted-foreground">Detailed progress, access, source health, and synchronization state.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_170px_180px]">
          <input className="ui-field" aria-label="Search library" placeholder="Search titles" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="ui-field" aria-label="Filter reading status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All reading states</option>
            {[...new Set(allLibrary.map((item) => item.status))].map((status) => <option key={status} value={status}>{status.toLowerCase()}</option>)}
          </select>
          <select className="ui-field" aria-label="Filter sync state" value={syncFilter} onChange={(event) => setSyncFilter(event.target.value)}>
            <option value="ALL">All sync states</option>
            <option value="PROBLEM">Problem syncs</option>
            <option value="FAILED">Failed</option>
            <option value="SYNCING">Syncing</option>
            <option value="UPDATED">Updated</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="px-5 py-3">Title</th><th className="px-5 py-3">Progress</th><th className="px-5 py-3">Access</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Sync</th><th className="px-5 py-3">Last read</th><th className="px-5 py-3"></th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {library.map((item) => (
              <tr key={item.id} className={item.retryable ? "bg-amber-500/5" : ""}>
                <td className="px-5 py-4"><Link href={`/manga/${item.slug}`} className="font-medium hover:underline">{item.title}</Link><p className="text-xs capitalize text-muted-foreground">{item.status.toLowerCase()}</p></td>
                <td className="px-5 py-4">{item.lastReadChapterNumber ?? "-"} / {item.latestChapterNumber ?? "-"}<p className="text-xs text-muted-foreground">{item.unreadChapters} unread</p></td>
                <td className="px-5 py-4 capitalize">{item.accessReason.replaceAll("_", " ")}</td>
                <td className="px-5 py-4">{item.preferredSource || "Automatic"}{item.sourceFailureCount > 0 && <p title={item.sourceError || undefined} className="text-xs text-amber-500">{item.sourceFailureCount} source failures</p>}</td>
                <td className="px-5 py-4"><span className={syncStatusClass(item.syncStatus, item.retryable)}>{item.syncStatus.toLowerCase()}</span>{item.syncError && <p className="mt-2 max-w-[22rem] break-words text-xs leading-5 text-muted-foreground">{item.syncError}</p>}</td>
                <td className="px-5 py-4 text-muted-foreground">{formatDate(item.lastReadAt)}</td>
                <td className="px-5 py-4">{item.retryable && <button disabled={pending} className="ui-button ui-button-secondary" onClick={() => retry([item.id])}><RefreshCw className="h-4 w-4" /> Retry</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!library.length && <p className="p-8 text-center text-sm text-muted-foreground">No titles match these filters.</p>}
      </div>
    </section>
  );
}

function ActivityAndJobs({ activity, jobs }: { activity: ActivityItem[]; jobs: Job[] }) {
  return <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="surface rounded-lg p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5" /> Explicit activity</h2><div className="mt-4 space-y-4">{activity.map((item) => <div key={`${item.label}-${item.at}`} className="border-l-2 border-border pl-4"><p className="font-medium">{item.label}</p><p className="text-sm text-muted-foreground">{item.detail}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.at)}</p></div>)}{!activity.length && <p className="text-sm text-muted-foreground">No explicit activity recorded.</p>}</div></section><section className="surface rounded-lg p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="h-5 w-5" /> Relevant sync jobs</h2><div className="mt-4 space-y-3">{jobs.map((job) => <div key={job.id} className="rounded-md border border-border p-3"><div className="flex justify-between gap-3"><span className="font-medium">{job.mangaTitle}</span><Badge>{job.status.toLowerCase()}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{job.userAttributed ? "User-attributed" : "Shared manga job"} / {formatDate(job.createdAt)}</p>{job.error && <p className="mt-2 text-sm text-red-500">{job.error}</p>}</div>)}{!jobs.length && <p className="text-sm text-muted-foreground">No relevant jobs recorded.</p>}</div></section></div>;
}

function FamilyAndControls({ data, pending, changeRole, revokeSessions, unlink }: { data: AdminUserDetailData; pending: boolean; changeRole: () => void; revokeSessions: () => void; unlink: (link: FamilyLink) => void }) {
  return <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="surface rounded-lg p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Shield className="h-5 w-5" /> Family & access</h2>{data.policy ? <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted-foreground">Policy</dt><dd className="font-medium">{data.policy.enabled ? "Enabled" : "Disabled"}</dd></div><div><dt className="text-muted-foreground">Allowed ratings</dt><dd>{data.policy.allowedContentRatings.join(", ")}</dd></div><div><dt className="text-muted-foreground">Blocked tags</dt><dd>{data.policy.blockedTagNames.join(", ") || "None"}</dd></div><div><dt className="text-muted-foreground">Title overrides</dt><dd>{data.overrideCount}</dd></div></dl> : <p className="mt-3 text-sm text-muted-foreground">No child policy applies to this account.</p>}<div className="mt-5 space-y-3">{data.familyLinks.map((link) => <div key={link.id} className="rounded-md border border-border p-3"><Link href={link.accountId ? `/admin/users/${link.accountId}` : "#"} className="font-medium hover:underline">{link.label}: {link.name}</Link><p className="text-xs text-muted-foreground">{link.email} / {link.status.toLowerCase()}</p><button disabled={pending} onClick={() => unlink(link)} className="mt-3 text-xs font-semibold text-red-500 hover:underline">Unlink relationship</button></div>)}{!data.familyLinks.length && <p className="text-sm text-muted-foreground">No family relationships.</p>}</div></section><section className="surface rounded-lg p-5"><h2 className="text-lg font-semibold">Account controls</h2><p className="mt-1 text-sm text-muted-foreground">Sensitive changes are confirmed and protected against self-lockout.</p><div className="mt-5 space-y-3"><button disabled={pending || data.id === data.actorId} onClick={changeRole} className="ui-button ui-button-secondary w-full justify-center">Change role to {data.role === "ADMIN" ? "user" : "admin"}</button><button disabled={pending || data.id === data.actorId} onClick={revokeSessions} className="ui-button w-full justify-center border-red-500 text-red-500">Revoke all sessions</button>{data.id === data.actorId && <p className="text-xs text-muted-foreground">Self-demotion and self-session revocation are disabled to prevent lockout.</p>}</div></section></div>;
}

function InsightPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <article className="surface rounded-lg p-5"><div className="flex items-center justify-between text-sm font-semibold text-muted-foreground"><span>{title}</span>{icon}</div><div className="mt-4">{children}</div></article>;
}

function StackedBar({ segments, total }: { segments: InsightSegment[]; total: number }) {
  return <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-label={`Sync health across ${total} titles`}>{segments.map((segment) => <span key={segment.label} className={segment.className} style={{ width: `${percent(segment.value, total)}%` }} title={`${segment.label}: ${segment.value}`} />)}</div>;
}

function Legend({ segments, totalLabel }: { segments: InsightSegment[]; totalLabel: string }) {
  return <div className="mt-4 grid gap-2 text-sm"><p className="font-medium">{totalLabel}</p>{segments.map((segment) => <div key={segment.label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${segment.className}`} />{segment.label}</span><span className="font-semibold tabular-nums">{segment.value}</span></div>)}</div>;
}

function IssueBars({ segments }: { segments: InsightSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">No open issues</div>;
  return <div className="space-y-3">{segments.map((segment) => <div key={segment.label}><div className="mb-1 flex items-center justify-between text-sm"><span className="text-muted-foreground">{segment.label}</span><span className="font-semibold tabular-nums">{segment.value}</span></div><div className="h-2 rounded-full bg-muted"><div className={`h-full rounded-full ${segment.className}`} style={{ width: `${percent(segment.value, total)}%` }} /></div></div>)}</div>;
}

function ProgressMeter({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="mt-4"><div className="mb-1 flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}%</span></div><div className="h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></div>;
}

function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold capitalize text-muted-foreground">{children}</span>; }
function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className={`mt-1 break-words font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd></div>; }
function syncStatusClass(syncStatus: string, canRetry: boolean) {
  const base = "inline-flex rounded-full px-2 py-1 text-xs font-bold capitalize";
  if (canRetry) return `${base} bg-amber-500/15 text-amber-700 dark:text-amber-300`;
  if (syncStatus === "UPDATED") return `${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`;
  return `${base} bg-muted text-muted-foreground`;
}
function buildSyncSegments(library: LibraryItem[]): InsightSegment[] {
  return [
    { label: "Updated", value: library.filter((item) => item.syncStatus === "UPDATED").length, className: "bg-emerald-500" },
    { label: "Failed", value: library.filter((item) => item.syncStatus === "FAILED").length, className: "bg-red-500" },
    { label: "Syncing", value: library.filter((item) => item.syncStatus === "SYNCING").length, className: "bg-amber-500" },
    { label: "Other", value: library.filter((item) => !["UPDATED", "FAILED", "SYNCING"].includes(item.syncStatus)).length, className: "bg-muted-foreground" },
  ];
}
function buildIssueSegments(issues: IssueDetail[]): InsightSegment[] {
  return [
    { label: "Failed syncs", value: issues.filter((issue) => issue.kind === "failed_sync").length, className: "bg-red-500" },
    { label: "Stale syncs", value: issues.filter((issue) => issue.kind === "stale_sync").length, className: "bg-amber-500" },
    { label: "Family setup", value: issues.filter((issue) => issue.kind === "family_setup").length, className: "bg-sky-500" },
  ];
}
function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}
