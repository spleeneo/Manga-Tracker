import { beforeEach, expect, it, vi } from "vitest";
const { fetchMetadata } = vi.hoisted(() => ({ fetchMetadata: vi.fn() }));
vi.mock("@/lib/scrapers/mangapill", () => ({ MangaPillScraper: class { fetchMetadata = fetchMetadata; } }));
const url = "https://mangapill.com/manga/10387/yankee-juku-e-iku";
beforeEach(() => { vi.resetModules(); fetchMetadata.mockReset(); });
it("caches successful synopses and canonicalizes only allowed title URLs", async () => {
  const { getMangaPillSynopsis } = await import("@/lib/explore/mangapill-metadata");
  fetchMetadata.mockResolvedValue({ title: "Yankee Juku e Iku", description: "A synopsis" });
  expect(await getMangaPillSynopsis(url)).toEqual({ description: "A synopsis" });
  expect(await getMangaPillSynopsis(`${url}?utm_source=test`)).toEqual({ description: "A synopsis" });
  expect(fetchMetadata).toHaveBeenCalledTimes(1);
  expect(fetchMetadata).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: "error", retries: 0, timeoutMs: 5000 }));
});
it("does not cache failures and preserves genuine missing descriptions", async () => {
  const { getMangaPillSynopsis } = await import("@/lib/explore/mangapill-metadata");
  fetchMetadata.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ title: "Yankee Juku e Iku" });
  await expect(getMangaPillSynopsis(url)).rejects.toThrow("Offline");
  expect(await getMangaPillSynopsis(url)).toEqual({ description: null });
  expect(fetchMetadata).toHaveBeenCalledTimes(2);
});
