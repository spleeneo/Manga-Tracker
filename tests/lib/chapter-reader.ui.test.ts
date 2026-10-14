// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChapterReader } from "@/components/chapter-reader";

vi.mock("@/components/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/lib/reader-prefetch", () => ({ prefetchReaderChapter: vi.fn(), prefetchReaderPages: vi.fn(), scheduleReaderPrefetch: () => () => {} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const chapter = (number: number) => ({ id: `c${number}`, chapterNumber: number, title: null, url: `https://mangadex.org/chapter/c${number}`, sourceName: "MangaDex" });

describe("reader recovery", () => {
  it("pairs and unpairs selected pages while preserving source order and selectable spread direction", async () => {
    vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ status: "READABLE", pages: [0, 1, 2].map((index) => ({ index, imageUrl: `https://example.com/${index}.png` })) }) }));
    render(createElement(ChapterReader, { slug: "sample", mangaTitle: "Sample", chapter: chapter(1), previousChapter: null, nextChapters: [] }));
    fireEvent.click(await screen.findByRole("button", { name: "Pair page 1 with next page" }));
    const first = screen.getByRole("img", { name: "Chapter 1 page 1" });
    const second = screen.getByRole("img", { name: "Chapter 1 page 2" });
    const row = first.parentElement!.parentElement!;
    expect(row).toBe(second.parentElement!.parentElement);
    expect(row.className).toContain("flex-row-reverse");
    expect(screen.queryByRole("button", { name: "Pair page 2 with next page" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Spread reading direction" }), { target: { value: "ltr" } });
    expect(row.className).not.toContain("flex-row-reverse");
    expect(Array.from(document.querySelectorAll("img[data-reader-page-index]")).map((image) => image.getAttribute("data-reader-page-index"))).toEqual(["0", "1", "2"]);
    fireEvent.click(screen.getByRole("button", { name: "Unpair pages 1 and 2" }));
    expect(screen.getByRole("img", { name: "Chapter 1 page 1" }).parentElement!.parentElement).not.toBe(screen.getByRole("img", { name: "Chapter 1 page 2" }).parentElement!.parentElement);
    expect(screen.getByRole("button", { name: "Pair page 2 with next page" })).toBeTruthy();
  });

  it("offers source navigation without opening a popup automatically", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ status: "EXTERNAL_ONLY", pages: [], externalUrl: chapter(1).url, reason: "Source unavailable" }) }));
    render(createElement(ChapterReader, { slug: "sample", mangaTitle: "Sample", chapter: chapter(1), previousChapter: null, nextChapters: [] }));
    expect((await screen.findByRole("link", { name: "Open on MangaDex" })).getAttribute("href")).toBe(chapter(1).url);
    expect(open).not.toHaveBeenCalled();
  });

  it("allows a failed next-chapter request to retry and append the recovered chapter", async () => {
    let nextRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/next?")) {
        nextRequests++;
        if (nextRequests === 1) throw new Error("Temporary network failure");
        return { ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ chapters: [chapter(3)], hasMore: false }) };
      }
      return { ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ status: "EXTERNAL_ONLY", pages: [], reason: url.includes("c3") ? "Recovered chapter three" : "External chapter" }) };
    }));
    render(createElement(ChapterReader, { slug: "sample", mangaTitle: "Sample", chapter: chapter(1), previousChapter: null, nextChapters: [chapter(2)] }));
    await waitFor(() => expect(document.querySelector('[data-reader-chapter-id="c2"]')).not.toBeNull());
    fireEvent.scroll(window);
    const retry = await screen.findByRole("button", { name: "Retry next chapter" });
    fireEvent.click(retry);
    await screen.findByText("Recovered chapter three");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Retry next chapter" })).toBeNull());
    expect(nextRequests).toBe(2);
  });
});
