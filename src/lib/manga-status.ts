const STATUS_ALIASES: Array<[string, string[]]> = [
  ["COMPLETED", ["complete", "completed", "end", "ended", "finished", "finish", "complete status"]],
  ["ONGOING", ["ongoing", "publishing", "release", "releasing", "serialization"]],
  ["HIATUS", ["hiatus", "on hiatus", "paused", "suspended"]],
  ["CANCELLED", ["cancelled", "canceled", "dropped", "axed"]],
];

const STATUS_PRIORITY: Record<string, number> = {
  COMPLETED: 50,
  CANCELLED: 45,
  HIATUS: 40,
  SEASON_BREAK: 35,
  ONGOING: 10,
};

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

export function selectMangaPublicationStatus(statuses: Array<string | null | undefined>, fallback?: string | null) {
  const normalizedStatuses = [...statuses, fallback]
    .map((status) => normalizeMangaStatus(status))
    .filter((status): status is string => Boolean(status));

  if (normalizedStatuses.length === 0) return undefined;

  return normalizedStatuses.reduce((best, status) => {
    const bestPriority = STATUS_PRIORITY[best] ?? 20;
    const statusPriority = STATUS_PRIORITY[status] ?? 20;
    return statusPriority > bestPriority ? status : best;
  });
}
