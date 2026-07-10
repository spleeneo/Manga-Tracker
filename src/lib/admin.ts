export function isAdmin(user: { role?: string | null } | null | undefined) {
  return user?.role === "ADMIN";
}

export const STALE_SYNC_MS = 10 * 60_000;

export type SyncDiagnostic = { syncStatus: string; syncStartedAt: Date | null };
export type AccountHealthLevel = "healthy" | "attention";

export function isRetryableSync(sync: SyncDiagnostic, now = new Date()) {
  return sync.syncStatus === "FAILED" || (sync.syncStatus === "SYNCING" && Boolean(sync.syncStartedAt && now.getTime() - sync.syncStartedAt.getTime() > STALE_SYNC_MS));
}

export function accountHealth(input: { library: SyncDiagnostic[]; familyStatuses: string[] }, now = new Date()) {
  const issues: string[] = [];
  if (input.library.some((item) => item.syncStatus === "FAILED")) issues.push("Failed synchronization");
  if (input.library.some((item) => item.syncStatus === "SYNCING" && isRetryableSync(item, now))) issues.push("Stale synchronization");
  if (input.familyStatuses.some((status) => status !== "ACTIVE")) issues.push("Incomplete family setup");
  return { level: (issues.length ? "attention" : "healthy") as AccountHealthLevel, issues };
}

export type AccountIssue = { kind: "failed_sync" | "stale_sync" | "family_setup"; title: string; summary: string; detail: string; startedAt: Date | null; userMangaId: string | null };

export function buildAccountIssues(input: {
  library: Array<SyncDiagnostic & { id: string; title: string; syncError: string | null }>;
  familyLinks: Array<{ label: string; status: string }>;
}, now = new Date()): AccountIssue[] {
  const syncIssues = input.library.flatMap((item): AccountIssue[] => {
    if (item.syncStatus === "FAILED") return [{ kind: "failed_sync", title: item.title, summary: "Synchronization failed", detail: item.syncError || "No error detail was stored for this failure.", startedAt: item.syncStartedAt, userMangaId: item.id }];
    if (item.syncStatus === "SYNCING" && isRetryableSync(item, now)) {
      const minutes = item.syncStartedAt ? Math.floor((now.getTime() - item.syncStartedAt.getTime()) / 60_000) : 0;
      return [{ kind: "stale_sync", title: item.title, summary: "Synchronization appears stuck", detail: `Running for ${minutes} minutes${item.syncError ? `. Last recorded error: ${item.syncError}` : " without finishing."}`, startedAt: item.syncStartedAt, userMangaId: item.id }];
    }
    return [];
  });
  return [...syncIssues, ...input.familyLinks.filter((link) => link.status !== "ACTIVE").map((link): AccountIssue => ({ kind: "family_setup", title: link.label, summary: "Family setup is incomplete", detail: `This relationship is currently ${link.status.toLowerCase()} and is not enforcing an active child policy.`, startedAt: null, userMangaId: null }))];
}

export function deriveActivity(input: { readDates: Date[]; trackedDates: Date[]; chatDates: Date[] }) {
  const latest = (dates: Date[]) => dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
  return { lastReadAt: latest(input.readDates), lastTrackedAt: latest(input.trackedDates), lastChatAt: latest(input.chatDates) };
}

export function sortAdminAccounts<T extends { name: string | null; health: AccountHealthLevel; lastReadAt: Date | null }>(accounts: T[]) {
  return [...accounts].sort((a, b) => {
    if (a.health !== b.health) return a.health === "attention" ? -1 : 1;
    const byRead = (b.lastReadAt?.getTime() ?? 0) - (a.lastReadAt?.getTime() ?? 0);
    return byRead || (a.name ?? "").localeCompare(b.name ?? "");
  });
}
