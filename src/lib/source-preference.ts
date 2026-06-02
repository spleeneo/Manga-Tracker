export const DEDICATED_MANGA_SOURCE_NAMES = [
  "witch hat atelier manga",
  "land of the lustrous",
  "bleach live",
  "blue lock manga",
  "fire punch",
];

export function normalizeSourceName(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDedicatedMangaSourceName(sourceName?: string | null) {
  const normalizedName = normalizeSourceName(sourceName);
  return DEDICATED_MANGA_SOURCE_NAMES.includes(normalizedName)
    || /\bmanga$/.test(normalizedName);
}
