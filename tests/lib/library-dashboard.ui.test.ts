// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LibraryDashboard } from "@/components/library-dashboard";
import type { LibraryMangaSummary } from "@/lib/library-summary";

vi.mock("@/components/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/manga-card", () => ({ MangaCard: ({ manga }: { manga: LibraryMangaSummary }) => createElement("article", {}, manga.title) }));
afterEach(cleanup);
const manga = (title: string, unread: number): LibraryMangaSummary => ({ id: title, slug: title, title, coverUrl: null, status: "ONGOING", syncStatus: "IDLE", syncStartedAt: null, syncFinishedAt: null, syncError: null, lastReadChapterNumber: null, lastReadAt: null, latestChapter: null, latestAvailableAt: null, estimatedNextChapterAt: null, releaseCadenceDays: null, releaseEstimateSampleSize: 0, nextUnreadChapter: null, totalChapters: unread, readChapters: 0, unreadChapters: unread, isCaughtUp: unread === 0 });

it("preserves title, unread filter, and sorting when synchronized library data arrives", () => {
  const initial = [manga("Alpha", 1), manga("Beta", 0)];
  const view = render(createElement(LibraryDashboard, { mangas: initial }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search your library" }), { target: { value: "Al" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Filter library" }), { target: { value: "unread" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Sort library" }), { target: { value: "title" } });
  view.rerender(createElement(LibraryDashboard, { mangas: [...initial, manga("Alpine", 2), manga("Also caught up", 0)] }));
  expect((screen.getByRole("textbox", { name: "Search your library" }) as HTMLInputElement).value).toBe("Al");
  expect((screen.getByRole("combobox", { name: "Sort library" }) as HTMLSelectElement).value).toBe("title");
  expect(screen.getAllByRole("article").map((element) => element.textContent)).toEqual(["Alpha", "Alpine"]);
});
