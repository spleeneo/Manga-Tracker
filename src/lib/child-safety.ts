const CHILD_CATALOG_PREFIX = "mangateo:catalog:";

export function createChildCatalogSource(mangaDexId: string) {
  return { name: "Mangateo", url: `${CHILD_CATALOG_PREFIX}${mangaDexId}` };
}

export function parseChildCatalogSource(value: unknown) {
  if (typeof value !== "string" || !value.startsWith(CHILD_CATALOG_PREFIX)) return null;
  const id = value.slice(CHILD_CATALOG_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

export function childInternalChapterUrl(slug: string, chapterId: string) {
  return `/manga/${slug}/chapter/${chapterId}`;
}
