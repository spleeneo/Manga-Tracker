// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ExplorePage } from "@/components/explore-page";

vi.mock("@/components/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn(), updateToast: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const response = (body: unknown) => ({ ok: true, json: async () => body });
const manga = (id: string, title: string) => ({ id, title, slug: title.toLowerCase().replaceAll(" ", "-"), tags: [], isTracked: false, source: { name: "MangaPill", url: `https://mangapill.com/manga/${id}` } });

describe("Discovery workflows", () => {
  it("opens previews without navigation and restores the opener on Escape", async () => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 10, height: 10 }] as unknown as DOMRectList);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => response(url.includes("/tags") ? { tags: [] } : { results: [{ title: "Preview Manga", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/preview" }] }] })));
    render(createElement(ExplorePage, { initialFilters: { q: "preview" } }));
    const opener = await screen.findByRole("link", { name: "Preview Preview Manga" });
    const user = userEvent.setup();
    await user.click(opener);
    const close = screen.getByRole("button", { name: "Close preview" });
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Track manga" }));
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
  it("ignores old search responses even when the transport ignores cancellation", async () => {
    let resolveOld!: (value: unknown) => void;
    const old = new Promise((resolve) => { resolveOld = resolve; });
    const fetchMock = vi.fn(async (url: string) => url.includes("/tags") ? response({ tags: [] }) : url.includes("q=old") ? old : response({ results: [{ title: "New title", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/new" }] }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(ExplorePage, { initialFilters: { q: "old" } }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes("q=old"))).toBe(true));
    fireEvent.change(screen.getByLabelText("Search manga titles"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await screen.findByRole("heading", { name: "New title" });
    await act(async () => resolveOld(response({ results: [{ title: "Old title", sources: [] }] })));
    expect(screen.queryByRole("heading", { name: "Old title" })).toBeNull();
    expect(screen.getByRole("heading", { name: "New title" })).toBeTruthy();
  });

  it("paginates providers independently, merges across pages, and preserves results on failure", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/tags")) return response({ tags: [] });
      if (url.includes("/mangapill")) return response({ results: url.includes("offset=24") ? [manga("same", "Same Manga"), manga("next", "Next Manga")] : [manga("same", "Same Manga")], nextOffset: url.includes("offset=24") ? null : 24 });
      throw new Error("MangaDex unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(ExplorePage));
    await screen.findByRole("heading", { name: "Same Manga" });
    expect(screen.getByRole("status").textContent).toContain("MangaDex");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("heading", { name: "Next Manga" });
    expect(screen.getAllByRole("heading", { name: "Same Manga" })).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/explore?")).every(([url]) => url.includes("offset=0"))).toBe(true);
  });

  it("shows tracked search results and hides them without refetching", async () => {
    const fetchMock = vi.fn(async (url: string) => response(url.includes("/tags") ? { tags: [] } : { results: [{ title: "Tracked Manga", isTracked: true, librarySlug: "tracked", sources: [{ name: "MangaDex", url: "https://mangadex.org/title/tracked" }] }] }));
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(ExplorePage, { initialFilters: { q: "tracked" } }));
    await screen.findByRole("heading", { name: "Tracked Manga" });
    expect((screen.getByRole("button", { name: "In library" }) as HTMLButtonElement).disabled).toBe(true);
    const calls = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("checkbox", { name: "Hide titles in my library" }));
    expect(screen.queryByRole("heading", { name: "Tracked Manga" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });
});
