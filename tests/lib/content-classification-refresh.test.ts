import { describe, expect, it, vi } from "vitest";

const { mangaFindUnique, mangaUpdate, fetchMetadata } = vi.hoisted(() => ({ mangaFindUnique: vi.fn(), mangaUpdate: vi.fn(), fetchMetadata: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { manga: { findUnique: mangaFindUnique, update: mangaUpdate } } }));
vi.mock("@/lib/scrapers/registry", () => ({ fetchMetadata }));

import { refreshMangaClassification } from "@/lib/content-classification";

describe("refreshMangaClassification", () => {
  it("consults every linked provider and persists the strictest merged classification", async () => {
    mangaFindUnique.mockResolvedValue({ sources: [{ sourceUrl: "provider-a" }, { sourceUrl: "provider-b" }] });
    fetchMetadata
      .mockResolvedValueOnce({ title: "A", classificationSource: "MANGADEX", contentRating: "safe", tags: [{ id: "action", name: "Action" }] })
      .mockResolvedValueOnce({ title: "A", classificationSource: "MANGAPILL", tags: [{ id: "hentai", name: "Hentai" }] });

    const merged = await refreshMangaClassification("m1");

    expect(fetchMetadata).toHaveBeenCalledTimes(2);
    expect(fetchMetadata).toHaveBeenNthCalledWith(1, "provider-a");
    expect(fetchMetadata).toHaveBeenNthCalledWith(2, "provider-b");
    expect(merged).toMatchObject({ contentRating: "pornographic", classificationSource: "MANGADEX,MANGAPILL" });
    expect(mangaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "m1" },
      data: expect.objectContaining({ contentRating: "pornographic", classificationSource: "MANGADEX,MANGAPILL" }),
    }));
  });
});
