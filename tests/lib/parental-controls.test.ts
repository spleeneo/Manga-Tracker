import { describe, expect, it } from "vitest";
import { evaluateMangaAccess } from "@/lib/parental-controls";

const policy = { enabled: true, allowedContentRatings: ["safe"], blockedTagNames: ["gore", "sexual violence"] };
const classified = { contentRating: "safe", classificationSource: "MANGADEX", tags: ["Action"] };

describe("evaluateMangaAccess", () => {
  it("allows adults and disabled policies", () => expect(evaluateMangaAccess(null, classified).allowed).toBe(true));
  it("allows safe classified manga", () => expect(evaluateMangaAccess(policy, classified)).toEqual({ allowed: true, reason: "allowed" }));
  it("does not use legacy rating selections when tags are allowed", () => expect(evaluateMangaAccess(policy, { ...classified, contentRating: "suggestive" })).toEqual({ allowed: true, reason: "allowed" }));
  it("blocks normalized tag names", () => expect(evaluateMangaAccess(policy, { ...classified, tags: ["Gore"] }).reason).toBe("blocked_tag"));
  it("matches source aliases to canonical policy tags", () => expect(evaluateMangaAccess({ ...policy, blockedTagNames: ["Science Fiction"] }, { ...classified, tags: ["Sci-Fi"] }).reason).toBe("blocked_tag"));
  it("fails closed for unclassified manga", () => expect(evaluateMangaAccess(policy, { ...classified, classificationSource: null }).reason).toBe("unclassified"));
  it("gives explicit block precedence over allow rules", () => expect(evaluateMangaAccess(policy, classified, "BLOCK").reason).toBe("title_blocked"));
  it("lets explicit allow override all classification rules", () => expect(evaluateMangaAccess(policy, { contentRating: null, classificationSource: null, tags: ["Gore"] }, "ALLOW").allowed).toBe(true));
});
