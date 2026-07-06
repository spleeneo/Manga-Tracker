"use client";

import { FormEvent, useEffect, useState } from "react";
import { canonicalTagKey, canonicalTagName } from "@/lib/content-taxonomy";

type Policy = { enabled: boolean; blockedTagNames: string[] };
type Title = { id: string; title: string; contentRating: string | null; classificationSource: string | null; tags: string[]; decision: string | null };
type Child = { id: string; childId: string | null; email: string; name?: string | null; status: string; policy: Policy; titles: Title[] };
type AvailableTag = { id: string; name: string; group: string | null };

export function ParentalControlsSettings() {
  const [children, setChildren] = useState<Child[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const load = async () => {
    const [response, tagResponse] = await Promise.all([
      fetch("/api/parental-controls", { cache: "no-store" }),
      fetch("/api/explore/tags", { cache: "force-cache" }),
    ]);
    const [data, tagData] = await Promise.all([response.json(), tagResponse.json()]);
    if (!response.ok) throw new Error(data.error || "Could not load parental controls");
    const loadedChildren = (data.children ?? []) as Child[];
    setChildren(loadedChildren);
    setActiveChildId((current) => loadedChildren.some((child) => child.id === current) ? current : loadedChildren[0]?.id ?? null);
    const tags = [...(data.availableTags ?? []), ...(tagData.tags ?? [])] as AvailableTag[];
    setAvailableTags([...new Map(tags.map((tag) => [canonicalTagKey(tag.name), { ...tag, name: canonicalTagName(tag.name) }])).values()]);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch((error) => setMessage(error.message)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const invite = async (event: FormEvent) => {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/parental-controls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Invite failed");
    setEmail(""); setMessage(data.status === "ACTIVE" ? "Child account linked." : "Invitation saved. It will activate when the child signs in."); await load();
  };

  const savePolicy = async (child: Child, policy: Policy) => {
    const response = await fetch("/api/parental-controls", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkId: child.id, ...policy }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "Policy update failed");
    setMessage("Policy saved."); await load();
  };

  const setOverride = async (child: Child, mangaId: string, decision: "ALLOW" | "BLOCK" | null) => {
    if (!child.childId) return;
    const response = await fetch("/api/parental-controls/overrides", { method: decision ? "PUT" : "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ childId: child.childId, mangaId, decision }) });
    if (!response.ok) { const data = await response.json(); return setMessage(data.error || "Override update failed"); }
    setMessage("Title decision saved."); await load();
  };

  const unlinkChild = async (child: Child) => {
    setMessage("");
    const response = await fetch("/api/parental-controls", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkId: child.id }) });
    if (!response.ok) { const data = await response.json(); return setMessage(data.error || "Could not remove child link"); }
    setMessage("Child link removed."); await load();
  };

  const moveChildTab = (currentIndex: number, direction: -1 | 1) => {
    const nextIndex = (currentIndex + direction + children.length) % children.length;
    const nextChild = children[nextIndex];
    setActiveChildId(nextChild.id);
    window.requestAnimationFrame(() => document.getElementById(`child-tab-${nextChild.id}`)?.focus());
  };

  return <div className="space-y-6">
    <section className="surface rounded-lg p-5"><h2 className="text-lg font-semibold">Link a child account</h2><p className="mt-1 text-sm text-muted-foreground">Enter the email used by the child&apos;s Google account.</p>
      <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row"><input className="ui-field flex-1" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="child@example.com"/><button className="ui-button ui-button-primary" type="submit">Send invitation</button></form>
      {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    </section>
    {children.length > 0 && <div>
      {children.length > 1 && <div className="mb-3 inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Child accounts">
        {children.map((child, index) => <button key={child.id} id={`child-tab-${child.id}`} type="button" role="tab" aria-selected={activeChildId === child.id} aria-controls={`child-panel-${child.id}`} tabIndex={activeChildId === child.id ? 0 : -1} className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${activeChildId === child.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`} onClick={() => setActiveChildId(child.id)} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); moveChildTab(index, 1); } else if (event.key === "ArrowLeft") { event.preventDefault(); moveChildTab(index, -1); } }}>{child.name || child.email}</button>)}
      </div>}
      {children.filter((child) => child.id === activeChildId).map((child) => <div key={child.id} id={`child-panel-${child.id}`} role={children.length > 1 ? "tabpanel" : undefined} aria-labelledby={children.length > 1 ? `child-tab-${child.id}` : undefined}><ChildPolicyCard child={child} availableTags={availableTags} onSave={savePolicy} onOverride={setOverride} onUnlink={unlinkChild} /></div>)}
    </div>}
  </div>;
}

function ChildPolicyCard({ child, availableTags, onSave, onOverride, onUnlink }: { child: Child; availableTags: AvailableTag[]; onSave: (child: Child, policy: Policy) => void; onOverride: (child: Child, mangaId: string, decision: "ALLOW" | "BLOCK" | null) => void; onUnlink: (child: Child) => Promise<void> }) {
  const [policy, setPolicy] = useState(child.policy);
  const [tagQuery, setTagQuery] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const blockedKeys = new Set(policy.blockedTagNames.map(canonicalTagKey));
  const toggleTag = (name: string) => setPolicy((current) => ({ ...current, blockedTagNames: blockedKeys.has(canonicalTagKey(name)) ? current.blockedTagNames.filter((tag) => canonicalTagKey(tag) !== canonicalTagKey(name)) : [...current.blockedTagNames, canonicalTagName(name)] }));
  const visibleTags = availableTags.filter((tag) => tag.name.toLowerCase().includes(tagQuery.trim().toLowerCase()));
  const groupedTags = visibleTags.reduce((groups, tag) => {
    const group = tag.group || "other source tags";
    groups.set(group, [...(groups.get(group) ?? []), tag]);
    return groups;
  }, new Map<string, AvailableTag[]>());
  return <section className="surface rounded-lg p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{child.name || child.email}</h2><p className="text-sm text-muted-foreground">{child.status === "ACTIVE" ? "Linked" : "Pending sign-in"}</p></div>{confirmUnlink ? <div className="flex flex-wrap items-center justify-end gap-2"><span className="text-sm text-muted-foreground">Remove this child link?</span><button className="ui-button ui-button-secondary" type="button" onClick={() => setConfirmUnlink(false)} disabled={unlinking}>Cancel</button><button className="ui-button border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90" type="button" disabled={unlinking} onClick={() => { setUnlinking(true); void onUnlink(child).finally(() => setUnlinking(false)); }}>{unlinking ? "Abandoning…" : "Abandon your child"}</button></div> : <button className="ui-button border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90" type="button" onClick={() => setConfirmUnlink(true)}>Abandon your child</button>}</div>
    {child.status === "ACTIVE" && <><label className="mt-5 flex items-center gap-2"><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })}/>Enable parental controls</label>
      <fieldset className="mt-4"><legend className="text-sm font-semibold">Blocked genres and tags</legend><p className="mt-1 text-xs text-muted-foreground">A manga is hidden when any source reports one of the selected tags.</p>
        <input className="ui-field mt-3 w-full" type="search" value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="Search genres, themes, formats, and content tags" aria-label="Search genres and tags" />
        <div className="mt-3 space-y-4 rounded-md border p-3">{[...groupedTags.entries()].map(([group, tags]) => <div key={group}><h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group}</h4><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tags.map((tag) => <label key={tag.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={blockedKeys.has(canonicalTagKey(tag.name))} onChange={() => toggleTag(tag.name)} />{tag.name}</label>)}</div></div>)}</div>
      </fieldset>
      <button className="ui-button ui-button-primary mt-4" onClick={() => void onSave(child, policy)}>Save policy</button>
      {child.titles.length > 0 && <div className="mt-6"><h3 className="font-semibold">Title decisions</h3><div className="mt-3 space-y-3">{child.titles.map((title) => <div key={title.id} className="rounded-md border p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{title.title}</p><p className="text-xs text-muted-foreground">{title.classificationSource ? `${title.contentRating ?? "unrated"} · ${title.tags.join(", ") || "no tags"}` : "Unclassified"}</p></div><select className="ui-field" value={title.decision ?? ""} onChange={(event) => void onOverride(child, title.id, (event.target.value || null) as "ALLOW" | "BLOCK" | null)}><option value="">Use policy</option><option value="ALLOW">Always allow</option><option value="BLOCK">Always block</option></select></div></div>)}</div></div>}
    </>}
  </section>;
}
