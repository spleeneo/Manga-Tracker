const SOURCE_PATTERNS: Array<[string, string[]]> = [
  ["MangaDex", ["mangadex"]],
  ["NeloManga", ["nelomanga"]],
  ["MangaPlus", ["mangaplus"]],
  ["Comikey", ["comikey.com"]],
  ["VIZ", ["viz.com"]],
  ["Urek Mazino", ["urekmazino.com"]],
  ["Bleach Live", ["bleach.live"]],
  ["Witch Hat Atelier Manga", ["witchhatateliermanga.com"]],
  ["Webtoon", ["webtoons"]],
  ["Manganato", ["manganato", "chapmanganato"]],
];

export function inferSourceName(url: string) {
  const normalizedUrl = url.toLowerCase();
  return SOURCE_PATTERNS.find(([, patterns]) => (
    patterns.some((pattern) => normalizedUrl.includes(pattern))
  ))?.[0] ?? "Source";
}
