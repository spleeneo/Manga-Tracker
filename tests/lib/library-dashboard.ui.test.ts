// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LibraryDashboard } from "@/components/library-dashboard";
import type { LibraryMangaSummary } from "@/lib/library-summary";

vi.mock("@/components/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/manga-card", () => ({ MangaCard: ({ manga, onProgress, onDelete, onSync }: { manga: LibraryMangaSummary; onProgress: (slug: string, action: string) => void; onDelete: (slug: string) => void; onSync: (slug: string, title: string) => void }) => createElement("article", {}, manga.title, createElement("span", {}, `Unread ${manga.unreadChapters}`), createElement("button", { onClick: () => onProgress(manga.slug, "caught-up") }, `Progress ${manga.title}`), createElement("button", { onClick: () => onDelete(manga.slug) }, `Remove ${manga.title}`), createElement("button", { onClick: () => onSync(manga.slug, manga.title) }, `Sync ${manga.title}`)) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
  expect(screen.getAllByRole("article").map((element) => element.textContent?.split("Unread")[0])).toEqual(["Alpha", "Alpine"]);
});

it.each(["Progress", "Remove", "Sync"])("keeps refreshed titles and progress after a pending %s request fails", async (action) => {
  let reject!: (reason: Error) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((_resolve, fail) => { reject = fail; })));
  const view = render(createElement(LibraryDashboard, { mangas: [manga("Alpha", 1)] }));
  fireEvent.click(screen.getByRole("button", { name: `${action} Alpha` }));
  view.rerender(createElement(LibraryDashboard, { mangas: [manga("Alpha", 5), manga("Beta", 2)] }));
  await act(async () => reject(new Error("Offline")));
  expect(screen.getByRole("button", { name: "Progress Beta" })).toBeTruthy();
  expect(screen.getByText("Unread 5")).toBeTruthy();
});

it("removes only the deleted title when a refresh arrives before successful deletion", async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(done => { resolve = done; })));
  const view = render(createElement(LibraryDashboard, { mangas: [manga("Alpha", 1)] }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Alpha" }));
  view.rerender(createElement(LibraryDashboard, { mangas: [manga("Alpha", 5), manga("Beta", 2)] }));
  await act(async () => resolve({ ok: true }));
  expect(screen.queryByRole("button", { name: "Progress Alpha" })).toBeNull();
  expect(screen.getByRole("button", { name: "Progress Beta" })).toBeTruthy();
});
