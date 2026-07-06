const CHILD_CATALOG_PREFIX = "mangateo:catalog:";

export function createChildCatalogSource(mangaDexId: string) {
  return { name: "Mangateo", url: `${CHILD_CATALOG_PREFIX}${mangaDexId}` };
}

export function parseChildCatalogSource(value: unknown) {
  if (typeof value !== "string" || !value.startsWith(CHILD_CATALOG_PREFIX)) return null;
  const id = value.slice(CHILD_CATALOG_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export function legacySourceUrlForTracking(value: string) {
  return parseChildCatalogSource(value) ? "" : value;
}

export function childInternalChapterUrl(slug: string, chapterId: string) {
  return `/manga/${slug}/chapter/${chapterId}`;
}

export function childCatalogCoverUrl(mangaDexId: string, coverUrl?: string) {
  if (!coverUrl) return undefined;
  try {
    const parsed = new URL(coverUrl);
    const prefix = `/covers/${mangaDexId}/`;
    if (parsed.hostname !== "uploads.mangadex.org" || !parsed.pathname.startsWith(prefix)) return undefined;
    const file = parsed.pathname.slice(prefix.length);
    if (!file || file.includes("/")) return undefined;
    return `/api/manga/catalog/${mangaDexId}/cover?file=${encodeURIComponent(file)}`;
  } catch {
    return undefined;
  }
}
