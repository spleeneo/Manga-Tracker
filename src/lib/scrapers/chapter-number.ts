/** Normalize provider numbers without losing zero or guessing numbers from titles. */
import type { ScrapedChapter } from "./types";

export function resolveChapterNumber(
  value: number | string | null | undefined,
  label?: string | null,
  singleRelease = false,
): number | null {
  if (value != null && (typeof value !== "string" || value.trim() !== "")) {
    const number = typeof value === "number" ? value
      : /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  return singleRelease || /\bone[\s-]?shot\b/i.test(label ?? "") ? 0 : null;
}

export class ChapterNumberError extends Error {}

export function requireChapterNumber(number: number | null, provider: string): number {
  if (number === null) {
    throw new ChapterNumberError(`${provider} exposed an unnumbered release that could not be identified safely. Retry or open the source to inspect it.`);
  }
  return number;
}

/** The numeric progress model cannot represent two different releases as zero. */
export function assertUnambiguousChapterZero(chapters: ScrapedChapter[]) {
  const zeroes = chapters.filter((chapter) => chapter.chapterNumber === 0);
  const identities = new Set(zeroes.map((chapter) => chapter.url));
  if (identities.size > 1 && zeroes.some((chapter) => /\bone[\s-]?shot\b/i.test(`${chapter.title ?? ""} ${new URL(chapter.url, "https://provider.invalid").pathname}`))) {
    throw new ChapterNumberError("Multiple distinct releases would become chapter zero. Open the source to inspect these unnumbered chapters.");
  }
}
