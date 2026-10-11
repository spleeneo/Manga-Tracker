import { MangaPillScraper } from "@/lib/scrapers/mangapill";

export interface MangaPillSynopsis { description: string | null }
const cache = new Map<string, { expiresAt: number; value: MangaPillSynopsis }>();
const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 200;

export function canonicalMangaPillDetailUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["mangapill.com", "www.mangapill.com"].includes(url.hostname)
    || url.username || url.password || (url.port && url.port !== "443")
    || !/^\/manga\/\d+\/[a-z0-9-]+\/?$/i.test(url.pathname)) throw new Error("Unsupported MangaPill title URL");
  return `https://mangapill.com${url.pathname.replace(/\/$/, "")}`;
}

export async function getMangaPillSynopsis(value: string): Promise<MangaPillSynopsis> {
  const url = canonicalMangaPillDetailUrl(value);
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const metadata = await new MangaPillScraper().fetchMetadata(url, { timeoutMs: 5000, retries: 0, redirect: "error" });
  const synopsis = { description: metadata.description?.trim() || null };
  // Public provider metadata only. Never cache account state or failed requests.
  cache.delete(url);
  for (const [key, entry] of cache) if (entry.expiresAt <= Date.now()) cache.delete(key);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(url, { expiresAt: Date.now() + TTL_MS, value: synopsis });
  return synopsis;
}
