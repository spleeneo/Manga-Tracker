import { describe, expect, it, vi } from "vitest";

const { fetchMetadata } = vi.hoisted(() => ({ fetchMetadata: vi.fn() }));

vi.mock("@/lib/scrapers/registry", () => ({ fetchMetadata }));

import { fetchLinkedMangaMetadata } from "@/lib/manga-metadata";

describe("fetchLinkedMangaMetadata", () => {
  it("selects completed status when a later linked source disagrees with ongoing", async () => {
    fetchMetadata
      .mockResolvedValueOnce({ title: "After the Rain", status: "ONGOING" })
      .mockResolvedValueOnce({ title: "After the Rain", status: "completed" });

    const result = await fetchLinkedMangaMetadata([
      { sourceUrl: "mangapill" },
      { sourceUrl: "mangadex" },
    ], "ONGOING");

    expect(fetchMetadata).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("COMPLETED");
  });
});
