import { describe, expect, it } from "vitest";
import { extractClassificationTags, inferContentRating, mergeClassifications } from "@/lib/content-classification";

describe("provider content classification", () => {
  it("extracts linked provider genres and tags", () => {
    expect(extractClassificationTags('<a href="/genres/action">Action</a><a href="/tag/hentai">Hentai</a>')).toEqual(["Action", "Hentai"]);
  });
  it("infers conservative ratings from explicit adult tags", () => {
    expect(inferContentRating(["Romance", "Hentai"])).toBe("pornographic");
    expect(inferContentRating(["Ecchi"])).toBe("suggestive");
  });
  it("unions tags and keeps the strictest provider rating", () => {
    expect(mergeClassifications([
      { title: "A", classificationSource: "MANGADEX", contentRating: "safe", tags: [{ id: "a", name: "Action" }] },
      { title: "A", classificationSource: "MANGAPILL", tags: [{ id: "h", name: "Hentai" }] },
    ])).toEqual({ contentRating: "pornographic", classificationSource: "MANGADEX,MANGAPILL", tags: [{ id: "a", name: "Action" }, { id: "h", name: "Hentai" }] });
  });
  it("maps provider aliases onto the shared tag taxonomy", () => {
    expect(mergeClassifications([
      { title: "A", classificationSource: "MANGADEX", tags: [{ id: "md", name: "Science Fiction", group: "genre" }] },
      { title: "A", classificationSource: "MANGANATO", tags: [{ id: "provider", name: "Sci-Fi", group: "provider" }] },
    ]).tags).toEqual([{ id: "md", name: "Science Fiction", group: "genre" }]);
  });
  it("does not treat providers without classification as safe", () => {
    expect(mergeClassifications([{ title: "A" }])).toEqual({ contentRating: null, classificationSource: null, tags: [] });
  });
});
