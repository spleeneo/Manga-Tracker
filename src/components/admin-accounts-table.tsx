"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export type AdminAccountRow = {
  id: string; name: string; email: string; role: "USER" | "ADMIN"; health: "healthy" | "attention";
  issues: string[]; libraryCount: number; unreadCount: number; lastReadAt: string | null; sessions: number;
};

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function AdminAccountsTable({ accounts }: { accounts: AdminAccountRow[] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("ALL");
  const [health, setHealth] = useState("ALL");
  const filtered = useMemo(() => accounts.filter((account) => {
    const haystack = `${account.name} ${account.email}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (role === "ALL" || account.role === role) && (health === "ALL" || account.health === health);
  }), [accounts, health, query, role]);

  return <section className="surface mt-8 overflow-hidden rounded-lg">
    <div className="border-b border-border p-5">
      <h2 className="text-lg font-semibold">Accounts</h2>
      <p className="mt-1 text-sm text-muted-foreground">Find accounts and surface support issues quickly.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_180px]">
        <input className="ui-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" aria-label="Search accounts" />
        <select className="ui-field" value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filter by role"><option value="ALL">All roles</option><option value="ADMIN">Admins</option><option value="USER">Users</option></select>
        <select className="ui-field" value={health} onChange={(event) => setHealth(event.target.value)} aria-label="Filter by health"><option value="ALL">All health states</option><option value="attention">Needs attention</option><option value="healthy">Healthy</option></select>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-5 py-3">Account</th>
            <th className="px-5 py-3">Health</th>
            <th className="px-5 py-3">Library overview</th>
            <th className="px-5 py-3">Last read</th>
            <th className="px-5 py-3 text-right">Sessions</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{filtered.map((account) => <AccountRow key={account.id} account={account} />)}</tbody>
      </table>
      {!filtered.length && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No accounts match these filters.</p>}
    </div>
  </section>;
}

function AccountRow({ account }: { account: AdminAccountRow }) {
  const issueSummary = summarizeIssues(account.issues);
  return <tr className={account.health === "attention" ? "bg-amber-500/5" : ""}>
    <td className="px-5 py-4 align-top">
      <Link href={`/admin/users/${account.id}`} className="font-semibold hover:text-primary hover:underline">{account.name}</Link>
      <p className="mt-1 text-xs text-muted-foreground">{account.email}</p>
      <p className="mt-2 w-fit rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">{account.role === "ADMIN" ? "Admin" : "User"}</p>
    </td>
    <td className="px-5 py-4 align-top">
      <div className="max-w-[32rem]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${account.health === "attention" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
            {account.health === "attention" ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {account.health === "attention" ? `${account.issues.length} issues` : "Healthy"}
          </span>
          {account.issues.length > 0 && <span className="text-xs font-medium text-muted-foreground">{issueSummary}</span>}
        </div>
        {account.issues.length > 0 && <IssueMeter issues={account.issues} />}
        {account.issues.length > 0 && <p className="mt-2 max-w-[30rem] truncate text-xs text-muted-foreground" title={account.issues.join("; ")}>{account.issues[0]}</p>}
      </div>
    </td>
    <td className="px-5 py-4 align-top">
      <div className="min-w-52">
        <div className="flex items-end justify-between gap-4">
          <Metric label="titles" value={account.libraryCount} />
          <Metric label="unread" value={account.unreadCount} />
        </div>
        <div className="mt-3 h-2 rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${libraryLoadPercent(account.unreadCount, account.libraryCount)}%` }} />
        </div>
      </div>
    </td>
    <td className="px-5 py-4 align-top text-muted-foreground">{account.lastReadAt ? dateFormatter.format(new Date(account.lastReadAt)) : "Never"}</td>
    <td className="px-5 py-4 text-right align-top tabular-nums">{account.sessions}</td>
    <td className="px-5 py-4 align-top">
      <Link href={`/admin/users/${account.id}`} className={`ui-button ${account.health === "attention" ? "ui-button-primary" : "ui-button-secondary"}`}>
        Diagnostics
        <ArrowRight className="h-4 w-4" />
      </Link>
    </td>
  </tr>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><p className="text-lg font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

function IssueMeter({ issues }: { issues: string[] }) {
  const width = `${Math.min(100, Math.max(12, issues.length * 8))}%`;
  return <div className="mt-3" aria-label={`${issues.length} account issues`}>
    <div className="h-2 rounded-full bg-muted">
      <div className="h-full rounded-full bg-amber-500" style={{ width }} />
    </div>
  </div>;
}

function summarizeIssues(issues: string[]) {
  const summaries = issues.map((issue) => (issue.split("—")[0] ?? issue).toLowerCase());
  const failed = summaries.filter((issue) => issue.includes("synchronization failed")).length;
  const stale = summaries.filter((issue) => issue.includes("appears stuck") || issue.includes("stale")).length;
  if (stale > 0 && failed > 0) return `${stale} stuck / ${failed} failed`;
  if (stale > 0) return `${stale} stuck sync${stale === 1 ? "" : "s"}`;
  if (failed > 0) return `${failed} failed sync${failed === 1 ? "" : "s"}`;
  return `${issues.length} issue${issues.length === 1 ? "" : "s"}`;
}

function libraryLoadPercent(unread: number, titles: number) {
  if (titles <= 0) return 0;
  return Math.min(100, Math.round((unread / Math.max(titles, unread)) * 100));
}
