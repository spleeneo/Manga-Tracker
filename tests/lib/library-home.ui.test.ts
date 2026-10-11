// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryHome } from "@/components/library-home";

vi.mock("@/components/library-dashboard", () => ({ LibraryDashboard: ({ mangas }: { mangas: Array<{ title: string }> }) => createElement("div", {}, mangas.map((manga) => manga.title).join(", ")) }));
vi.mock("@/components/toast-provider", () => ({ useToast: () => ({ showToast: vi.fn(), updateToast: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("library refresh recovery", () => {
  it("keeps loaded titles visible on a failed refresh and recovers on retry", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ mangas: [{ title: "One Piece" }] }) }).mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => ({ mangas: [{ title: "One Piece", syncStatus: "UPDATED" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(LibraryHome));
    await screen.findByText("One Piece");
    act(() => window.dispatchEvent(new Event("mangateo:library-refresh")));
    await screen.findByRole("alert");
    expect(screen.getByText("One Piece")).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Retry" }).click());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByText("One Piece")).toBeTruthy();
  });
});
