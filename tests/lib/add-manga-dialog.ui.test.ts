// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AddMangaDialog } from "@/components/add-manga-dialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn(), updateToast: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const response = (body: unknown) => ({ ok: true, json: async () => body });

it("restores keyboard focus to the persistent trigger on Escape", () => {
  render(createElement(AddMangaDialog));
  const trigger = screen.getByRole("button", { name: "Track new manga" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search manga" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("ignores a superseded retry even when its transport ignores cancellation", async () => {
  let finishRetry!: (value: unknown) => void;
  const retryResponse = new Promise((resolve) => { finishRetry = resolve; });
  const fetchMock = vi.fn(async (url: string) => url.includes("retry=1") && url.includes("q=old") ? retryResponse : response({ results: [{ title: url.includes("q=new") ? "New manga" : "Old manga", sources: [] }], failedProviders: url.includes("q=old") ? ["MangaDex"] : [] }));
  vi.stubGlobal("fetch", fetchMock);
  render(createElement(AddMangaDialog));
  fireEvent.click(screen.getByRole("button", { name: "Track new manga" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Search manga" }), { target: { value: "old" } });
  await screen.findByRole("button", { name: "Track Old manga" });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes("retry=1"))).toBe(true));
  fireEvent.change(screen.getByRole("textbox", { name: "Search manga" }), { target: { value: "new" } });
  await screen.findByRole("button", { name: "Track New manga" });
  await act(async () => finishRetry(response({ results: [{ title: "Stale manga", sources: [] }] })));
  expect(screen.queryByRole("button", { name: "Track Stale manga" })).toBeNull();
});
