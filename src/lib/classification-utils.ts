import { createHash } from "node:crypto";
import type { MangaMetadata } from "@/lib/scrapers/types";
import { canonicalTagKey, canonicalTagName } from "@/lib/content-taxonomy";

const RATING_RANK: Record<string, number> = { safe: 0, suggestive: 1, erotica: 2, pornographic: 3 };
const EXPLICIT_TAG_RATINGS: Record<string, string> = {
  ecchi: "suggestive", suggestive: "suggestive", smut: "erotica", erotica: "erotica",
  adult: "erotica", mature: "erotica", hentai: "pornographic", pornographic: "pornographic",
};

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function extractClassificationTags(html: string) {
  const tags = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["'][^"']*\/(?:genre|genres|tag|tags)\/?[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = decodeHtml(match[1]);
    if (name && name.length <= 60 && !/^(genres?|tags?)$/i.test(name)) tags.add(name);
  }
  for (const match of html.matchAll(/(?:genre|genres|tags?)\s*:\s*<\/[^>]+>\s*([^<]{2,240})/gi)) {
    decodeHtml(match[1]).split(/[,|/]/).map((item) => item.trim()).filter(Boolean).forEach((item) => tags.add(item));
  }
  return [...tags];
}

export function inferContentRating(tags: string[], explicit?: string | null) {
  let rating = explicit?.trim().toLowerCase();
  for (const tag of tags) {
    const inferred = EXPLICIT_TAG_RATINGS[tag.trim().toLowerCase()];
    if (inferred && (rating == null || (RATING_RANK[inferred] ?? -1) > (RATING_RANK[rating] ?? -1))) rating = inferred;
  }
  return rating && rating in RATING_RANK ? rating : null;
}

export function withProviderClassification(provider: string, metadata: MangaMetadata, html: string): MangaMetadata {
  const names = [...new Map([...(metadata.tags ?? []).map((tag) => tag.name), ...extractClassificationTags(html)].map((name) => [canonicalTagKey(name), canonicalTagName(name)])).values()];
  const tags = names.map((name) => ({ id: providerTagId(provider, name), name, group: "provider" }));
  const contentRating = inferContentRating(names, metadata.contentRating);
  if (!tags.length && !contentRating) return metadata;
  return { ...metadata, tags, contentRating: contentRating ?? undefined, classificationSource: provider.toUpperCase() };
}

function providerTagId(provider: string, name: string) {
  return `provider:${createHash("sha256").update(`${provider.toLowerCase()}:${name.toLowerCase()}`).digest("hex").slice(0, 32)}`;
}

export function mergeClassifications(metadata: MangaMetadata[]) {
  const classified = metadata.filter((item) => item.classificationSource && (item.contentRating || item.tags?.length));
  const tagsByName = new Map<string, { id: string; name: string; group?: string }>();
  let contentRating: string | null = null;
  for (const item of classified) {
    for (const tag of item.tags ?? []) {
      const name = canonicalTagName(tag.name);
      const key = canonicalTagKey(name);
      const normalized = { ...tag, name };
      const existing = tagsByName.get(key);
      if (!existing || (existing.group === "provider" && normalized.group !== "provider")) tagsByName.set(key, normalized);
    }
    const rating = inferContentRating((item.tags ?? []).map((tag) => tag.name), item.contentRating);
    if (rating && (contentRating == null || RATING_RANK[rating] > RATING_RANK[contentRating])) contentRating = rating;
  }
  return { contentRating, classificationSource: classified.length ? [...new Set(classified.map((item) => item.classificationSource!))].sort().join(",") : null, tags: [...tagsByName.values()] };
}
