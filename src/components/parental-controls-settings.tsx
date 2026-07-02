"use client";

import { FormEvent, useEffect, useState } from "react";

type Policy = { enabled: boolean; allowedContentRatings: string[]; blockedTagNames: string[] };
type Title = { id: string; title: string; contentRating: string | null; classificationSource: string | null; tags: string[]; decision: string | null };
type Child = { id: string; childId: string | null; email: string; name?: string | null; status: string; policy: Policy; titles: Title[] };

export function ParentalControlsSettings() {
  const [children, setChildren] = useState<Child[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    const response = await fetch("/api/parental-controls", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load parental controls");
    setChildren(data.children ?? []);
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

  return <div className="space-y-6">
    <section className="surface rounded-lg p-5"><h2 className="text-lg font-semibold">Link a child account</h2><p className="mt-1 text-sm text-muted-foreground">Enter the email used by the child&apos;s Google account.</p>
      <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row"><input className="ui-field flex-1" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="child@example.com"/><button className="ui-button ui-button-primary" type="submit">Send invitation</button></form>
      {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    </section>
    {children.map((child) => <ChildPolicyCard key={child.id} child={child} onSave={savePolicy} onOverride={setOverride} />)}
  </div>;
}

function ChildPolicyCard({ child, onSave, onOverride }: { child: Child; onSave: (child: Child, policy: Policy) => void; onOverride: (child: Child, mangaId: string, decision: "ALLOW" | "BLOCK" | null) => void }) {
  const [policy, setPolicy] = useState(child.policy);
  const [blockedTags, setBlockedTags] = useState(child.policy.blockedTagNames.join(", "));
  const toggleRating = (rating: string) => setPolicy((current) => ({ ...current, allowedContentRatings: current.allowedContentRatings.includes(rating) ? current.allowedContentRatings.filter((item) => item !== rating) : [...current.allowedContentRatings, rating] }));
  return <section className="surface rounded-lg p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{child.name || child.email}</h2><p className="text-sm text-muted-foreground">{child.status === "ACTIVE" ? "Linked" : "Pending sign-in"}</p></div></div>
    {child.status === "ACTIVE" && <><label className="mt-5 flex items-center gap-2"><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })}/>Enable parental controls</label>
      <fieldset className="mt-4"><legend className="text-sm font-semibold">Allowed content ratings</legend><div className="mt-2 flex flex-wrap gap-4">{["safe", "suggestive", "erotica", "pornographic"].map((rating) => <label key={rating} className="flex items-center gap-2 capitalize"><input type="checkbox" checked={policy.allowedContentRatings.includes(rating)} onChange={() => toggleRating(rating)}/>{rating}</label>)}</div></fieldset>
      <label className="mt-4 block text-sm font-semibold">Blocked tags<input className="ui-field mt-2 w-full" value={blockedTags} onChange={(event) => setBlockedTags(event.target.value)} /></label>
      <button className="ui-button ui-button-primary mt-4" disabled={!policy.allowedContentRatings.length} onClick={() => void onSave(child, { ...policy, blockedTagNames: blockedTags.split(",").map((tag) => tag.trim()).filter(Boolean) })}>Save policy</button>
      {child.titles.length > 0 && <div className="mt-6"><h3 className="font-semibold">Title decisions</h3><div className="mt-3 space-y-3">{child.titles.map((title) => <div key={title.id} className="rounded-md border p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{title.title}</p><p className="text-xs text-muted-foreground">{title.classificationSource ? `${title.contentRating ?? "unrated"} · ${title.tags.join(", ") || "no tags"}` : "Unclassified"}</p></div><select className="ui-field" value={title.decision ?? ""} onChange={(event) => void onOverride(child, title.id, (event.target.value || null) as "ALLOW" | "BLOCK" | null)}><option value="">Use policy</option><option value="ALLOW">Always allow</option><option value="BLOCK">Always block</option></select></div></div>)}</div></div>}
    </>}
  </section>;
}
