"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Health</th><th className="px-5 py-3 text-right">Library</th><th className="px-5 py-3 text-right">Unread</th><th className="px-5 py-3">Last read</th><th className="px-5 py-3 text-right">Sessions</th></tr></thead>
        <tbody className="divide-y divide-border">{filtered.map((account) => <tr key={account.id}>
          <td className="px-5 py-4"><Link href={`/admin/users/${account.id}`} className="font-medium hover:text-primary hover:underline">{account.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">{account.email} · {account.role === "ADMIN" ? "Admin" : "User"}</p></td>
          <td className="px-5 py-4"><span title={account.issues.join("; ")} className={`rounded-full px-2 py-1 text-xs font-semibold ${account.health === "attention" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"}`}>{account.health === "attention" ? `${account.issues.length} issue${account.issues.length === 1 ? "" : "s"}` : "Healthy"}</span></td>
          <td className="px-5 py-4 text-right tabular-nums">{account.libraryCount}</td><td className="px-5 py-4 text-right tabular-nums">{account.unreadCount}</td>
          <td className="px-5 py-4 text-muted-foreground">{account.lastReadAt ? dateFormatter.format(new Date(account.lastReadAt)) : "Never"}</td><td className="px-5 py-4 text-right tabular-nums">{account.sessions}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No accounts match these filters.</p>}
    </div>
  </section>;
}
