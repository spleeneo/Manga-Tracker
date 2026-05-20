import { describe, expect, it } from "vitest";
import { getRegisteredScrapers } from "@/lib/scrapers/registry";

describe("scraper provider contract", () => {
  it("registers multiple providers", () => {
    const providers = getRegisteredScrapers();
    expect(providers.length).toBeGreaterThanOrEqual(5);
  });

  it("each provider exposes required contract surface", () => {
    const providers = getRegisteredScrapers();
    for (const provider of providers) {
      expect(typeof provider.name).toBe("string");
      expect(typeof provider.canHandle).toBe("function");
      expect(typeof provider.search).toBe("function");
      expect(typeof provider.fetchMetadata).toBe("function");
      expect(typeof provider.fetchChapters).toBe("function");
    }
  });

  it("new providers are included in registry", () => {
    const names = getRegisteredScrapers().map((p) => p.name);
    expect(names).toContain("Webtoon");
    expect(names).toContain("Manganato");
    expect(names).toContain("VIZ");
  });
});
