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

export function getPreferredSourceRank(sourceName?: string | null, mangaSlug?: string | null) {
  const name = normalizeSourceName(sourceName);
  const slug = normalizeSourceName(mangaSlug);

  if (slug === "witch hat atelier" && name === "witch hat atelier manga") {
    return 9;
  }

  if (slug === "bleach" && name === "bleach live") {
    return 8;
  }

  switch (name) {
    case "mangapill":
      return 8;
    case "nelomanga":
      return 7;
    case "witch hat atelier manga":
    case "land of the lustrous":
    case "blue lock manga":
    case "fire punch":
      return 6;
    case "urek mazino":
    case "bleach live":
    case "atsumaru":
      return 5;
    case "mangaplus":
      return 4;
    case "mangadex":
      return 3;
    case "webtoon":
      return 2;
    case "manganato":
      return 1;
    default:
      if (isDedicatedMangaSourceName(sourceName)) return 6;
      return 0;
  }
}
