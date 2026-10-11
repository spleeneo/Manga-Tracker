// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ExplorePage } from "@/components/explore-page";

vi.mock("@/components/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn(), updateToast: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const response = (body: unknown) => ({ ok: true, json: async () => body });
const manga = (id: string, title: string) => ({ id, title, slug: title.toLowerCase().replaceAll(" ", "-"), tags: [], isTracked: false, source: { name: "MangaPill", url: `https://mangapill.com/manga/${id}` } });

describe("Discovery workflows", () => {
  it("retries a failed synopsis without claiming it is absent", async () => {
    let fail = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/metadata")) { if (fail) throw new Error("Offline"); return response({ description: "Recovered synopsis" }); }
      if (url.includes("/tags")) return response({ tags: [] });
      return response({ results: url.includes("/mangapill") ? [manga("123/title", "Retry Work")] : [], nextOffset: null });
    }));
    render(createElement(ExplorePage));
    fireEvent.click(await screen.findByRole("link", { name: "Preview Retry Work" }));
    await screen.findByRole("button", { name: "Retry synopsis" });
    expect(within(screen.getByRole("dialog")).queryByText("No synopsis available.")).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry synopsis" }));
    await within(screen.getByRole("dialog")).findByText("Recovered synopsis");
  });
  it("ignores a closed preview's response even when cancellation is ignored", async () => {
    let finish!: (value: unknown) => void;
    const old = new Promise(resolve => { finish = resolve; });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/metadata")) return url.includes("first") ? old : response({ description: "Second synopsis" });
      if (url.includes("/tags")) return response({ tags: [] });
      return response({ results: url.includes("/mangapill") ? [manga("1/first", "First Preview"), manga("2/second", "Second Preview")] : [], nextOffset: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(ExplorePage));
    fireEvent.click(await screen.findByRole("link", { name: "Preview First Preview" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes("/metadata"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    fireEvent.click(screen.getByRole("link", { name: "Preview Second Preview" }));
    await within(screen.getByRole("dialog")).findByText("Second synopsis");
    await act(async () => finish(response({ description: "Stale synopsis" })));
    expect(screen.queryByText("Stale synopsis")).toBeNull();
    expect(within(screen.getByRole("dialog")).getByText("Second synopsis")).toBeTruthy();
  });
  it("loads MangaPill synopsis on preview, updates the card, and reuses it on reopening", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/metadata")) return response({ description: "Ikariishi is the strong, silent type." });
      if (url.includes("/tags")) return response({ tags: [] });
      return response({ results: url.includes("/mangapill") ? [manga("10387/yankee-juku-e-iku", "Yankee Juku e Iku")] : [], nextOffset: null });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(ExplorePage));
    const opener = await screen.findByRole("link", { name: "Preview Yankee Juku e Iku" });
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/metadata"))).toBe(false);
    fireEvent.click(opener);
    await within(screen.getByRole("dialog")).findByText("Ikariishi is the strong, silent type.");
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(screen.getByText("Ikariishi is the strong, silent type.")).toBeTruthy();
    fireEvent.click(opener);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/metadata"))).toHaveLength(1);
  });
  it("retains a newly tracked badge when another browse page arrives", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/manga") return response({ slug: "tracked-work" });
      if (url.includes("/tags")) return response({ tags: [] });
      if (!url.includes("/mangapill")) return response({ results: [], nextOffset: null });
      const next = url.includes("offset=24");
      return response({ results: [manga(next ? "second" : "first", next ? "Second Work" : "First Work")], nextOffset: next ? null : 24 });
    }));
    render(createElement(ExplorePage));
    const title = await screen.findByRole("heading", { name: "First Work" });
    fireEvent.click(within(title.closest("article")!).getByRole("button", { name: /^Track$/ }));
    await screen.findByRole("button", { name: "In library" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("heading", { name: "Second Work" });
    expect((screen.getByRole("button", { name: "In library" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("retries only a failed provider page while retaining all loaded pages", async () => {
    let failDexPage = true;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/tags")) return response({ tags: [] });
      const pill = url.includes("/mangapill");
      const offset = new URL(url, "http://localhost").searchParams.get("offset");
      if (!pill && offset === "24" && failDexPage) throw new Error("Temporary outage");
      return response({ results: [manga(`${pill ? "pill" : "dex"}-${offset}`, `${pill ? "Pill" : "Dex"} ${offset}`)], nextOffset: offset === "0" ? 24 : null });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(ExplorePage));
    await screen.findByRole("heading", { name: "Dex 0" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("heading", { name: "Pill 24" });
    failDexPage = false;
    const before = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Retry sources" }));
    await screen.findByRole("heading", { name: "Dex 24" });
    for (const title of ["Pill 0", "Dex 0", "Pill 24"]) expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(fetchMock.mock.calls.slice(before).map(([url]) => url)).toEqual([expect.stringContaining("offset=24")]);
  });
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
