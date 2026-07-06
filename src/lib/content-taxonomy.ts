const TAG_ALIASES: Record<string, string> = {
  "sci fi": "Science Fiction",
  "sci-fi": "Science Fiction",
  scifi: "Science Fiction",
  school: "School Life",
  "slice-of-life": "Slice of Life",
  oneshot: "Oneshot",
  "one shot": "Oneshot",
  "one-shot": "Oneshot",
  doujin: "Doujinshi",
  webcomic: "Web Comic",
  "web-comic": "Web Comic",
};

export function normalizeTagKey(value: string) {
  return value.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export function canonicalTagName(value: string) {
  const trimmed = value.trim();
  return TAG_ALIASES[normalizeTagKey(trimmed)] ?? trimmed;
}

export function canonicalTagKey(value: string) {
  return normalizeTagKey(canonicalTagName(value));
}

const GENERIC_TAG_LABELS = new Set(["category", "categories", "genre", "genres", "tag", "tags"]);

export function isMeaningfulTagName(value: string) {
  return !GENERIC_TAG_LABELS.has(normalizeTagKey(value));
}
