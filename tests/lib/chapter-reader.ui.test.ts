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
