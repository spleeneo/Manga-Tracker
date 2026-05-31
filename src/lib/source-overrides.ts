type MangaIdentity = {
  slug?: string | null;
  title?: string | null;
};

type SourceIdentity = {
  sourceName: string;
  sourceUrl: string;
};

export type MangaSourceOverride = {
  sourceName: string;
  sourceUrl: string;
  allowedSourceNames: string[];
  allowedHostnames: string[];
};

export const HOUSEKI_SOURCE_OVERRIDE: MangaSourceOverride = {
  sourceName: "Land of the Lustrous",
  sourceUrl: "https://w1.land-of-the-lustrous.online/",
  allowedSourceNames: ["land of the lustrous"],
  allowedHostnames: ["w1.land-of-the-lustrous.online", "land-of-the-lustrous.online"],
};

function normalizeValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value?: string | null) {
  return normalizeValue(value).replace(/\s+/g, "-");
}

export function getMangaSourceOverride(manga: MangaIdentity): MangaSourceOverride | null {
  const slug = slugify(manga.slug);
  const title = normalizeValue(manga.title);
  const values = new Set([slug, title]);

  if (
    values.has("houseki-no-kuni")
    || values.has("houseki no kuni")
    || values.has("land-of-the-lustrous")
    || values.has("land of the lustrous")
  ) {
    return HOUSEKI_SOURCE_OVERRIDE;
  }

  return null;
}

export function isAllowedOverrideSource(source: SourceIdentity, override: MangaSourceOverride) {
  const sourceName = normalizeValue(source.sourceName);
  if (override.allowedSourceNames.includes(sourceName)) return true;

  try {
    const hostname = new URL(source.sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    return override.allowedHostnames.includes(hostname);
  } catch {
    return override.allowedHostnames.some((hostname) => source.sourceUrl.toLowerCase().includes(hostname));
  }
}

export function filterSourcesForManga<T extends SourceIdentity>(manga: MangaIdentity, sources: T[]) {
  const override = getMangaSourceOverride(manga);
  return override ? sources.filter((source) => isAllowedOverrideSource(source, override)) : sources;
}

export function applySourceOverrideToInputSources<T extends { name?: string; sourceName?: string; url?: string; sourceUrl?: string }>(
  manga: MangaIdentity,
  sources: T[],
) {
  const override = getMangaSourceOverride(manga);
  if (!override) return sources;

  return [{
    name: override.sourceName,
    url: override.sourceUrl,
  }] as T[];
}
