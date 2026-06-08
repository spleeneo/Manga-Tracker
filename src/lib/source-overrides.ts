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

export function getMangaSourceOverride(manga: MangaIdentity): MangaSourceOverride | null {
  void manga;
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
  if (override) return sources.filter((source) => isAllowedOverrideSource(source, override));

  return sources;
}

export function applySourceOverrideToInputSources<T extends { name?: string; sourceName?: string; url?: string; sourceUrl?: string }>(
  manga: MangaIdentity,
  sources: T[],
) {
  const override = getMangaSourceOverride(manga);
  if (override) {
    return [{
      name: override.sourceName,
      url: override.sourceUrl,
    }] as T[];
  }

  return sources;
}
