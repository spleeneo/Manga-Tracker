import { describe, expect, it } from "vitest";
import { selectContinueReadingManga } from "@/lib/continue-reading";

type Candidate = {
  id: string;
  unreadChapters: number;
  lastReadAt: Date | null;
  nextUnreadChapter: { releaseDate: Date | null } | null;
};

function candidate(
  id: string,
  unreadChapters: number,
  lastReadAt: string | null,
  nextReleaseDate: string | null = null,
): Candidate {
  return {
    id,
    unreadChapters,
    lastReadAt: lastReadAt ? new Date(lastReadAt) : null,
    nextUnreadChapter: nextReleaseDate ? { releaseDate: new Date(nextReleaseDate) } : null,
  };
}

describe("selectContinueReadingManga", () => {
  it("skips the most recently read manga when it is already caught up", () => {
    const caughtUp = candidate("caught-up", 0, "2026-07-04T12:00:00Z");
    const stillReading = candidate("still-reading", 2, "2026-07-03T12:00:00Z");

    expect(selectContinueReadingManga([caughtUp, stillReading], [caughtUp, stillReading])).toBe(stillReading);
  });

  it("falls back to the newest unread release when unread manga have no reading history", () => {
    const older = candidate("older", 1, null, "2026-07-01T12:00:00Z");
    const newer = candidate("newer", 1, null, "2026-07-03T12:00:00Z");

    expect(selectContinueReadingManga([older, newer], [older, newer])).toBe(newer);
  });
});
