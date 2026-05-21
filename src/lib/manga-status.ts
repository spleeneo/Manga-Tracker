const STATUS_ALIASES: Array<[string, string[]]> = [
  ["COMPLETED", ["complete", "completed", "end", "ended", "finished", "finish", "complete status"]],
  ["ONGOING", ["ongoing", "publishing", "release", "releasing", "serialization"]],
  ["HIATUS", ["hiatus", "on hiatus", "paused", "suspended"]],
  ["CANCELLED", ["cancelled", "canceled", "dropped", "axed"]],
];

export function normalizeMangaStatus(status?: string | null, fallback?: string | null) {
  const value = status?.trim() || fallback?.trim();
  if (!value) return undefined;

  const normalized = value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [canonical, aliases] of STATUS_ALIASES) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return canonical;
    }
  }

  return value.toUpperCase().replace(/[\s-]+/g, "_");
}
