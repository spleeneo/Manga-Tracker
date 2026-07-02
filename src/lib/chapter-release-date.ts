const RELEASE_DATE_FORMAT = {
  year: "numeric",
  month: "short",
  day: "numeric",
} as const;

export function formatChapterReleaseDate(
  releaseDate: Date | string | null,
  locale?: string,
): string | null {
  if (!releaseDate) return null;

  const date = releaseDate instanceof Date ? releaseDate : new Date(releaseDate);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, RELEASE_DATE_FORMAT).format(date);
}
