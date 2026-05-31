const MANGA_ALIAS_GROUPS = [
  {
    title: "Witch Hat Atelier",
    slug: "witch-hat-atelier",
    aliases: [
      "witch hat atelier",
      "tongari booshi no atorie",
      "tongari boushi no atelier",
      "tongari boshi no atelier",
    ],
  },
  {
    title: "Houseki no Kuni",
    slug: "houseki-no-kuni",
    aliases: [
      "houseki no kuni",
      "land of the lustrous",
      "land-of-the-lustrous",
      "houseki no kuni land of the lustrous",
    ],
  },
  {
    title: "Blue Lock",
    slug: "blue-lock",
    aliases: [
      "blue lock",
      "blue lock manga",
      "bluelock",
    ],
  },
];

function normalizeAliasValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bmanga\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyMangaTitle(title: string) {
  return normalizeAliasValue(title).replace(/\s+/g, "-");
}

export function getMangaAliasGroup(titleOrSlug?: string | null) {
  if (!titleOrSlug) return null;
  const normalized = normalizeAliasValue(titleOrSlug);
  const slug = slugifyMangaTitle(titleOrSlug);

  return MANGA_ALIAS_GROUPS.find((group) => (
    group.slug === slug || group.aliases.includes(normalized)
  )) ?? null;
}

export function getCanonicalMangaTitle(title: string) {
  return getMangaAliasGroup(title)?.title ?? title;
}

export function getCanonicalMangaSlug(title?: string | null, slug?: string | null) {
  return getMangaAliasGroup(title)?.slug
    ?? getMangaAliasGroup(slug)?.slug
    ?? slug
    ?? (title ? slugifyMangaTitle(title) : "");
}

export function getMangaAliasSlugs(title?: string | null, slug?: string | null) {
  const group = getMangaAliasGroup(title) ?? getMangaAliasGroup(slug);
  if (!group) return [];
  return Array.from(new Set([group.slug, ...group.aliases.map(slugifyMangaTitle)]));
}
