import { describe, expect, it } from "vitest";
import { sameWork, type WorkIdentity } from "@/lib/work-identity";
import { mergeBrowseDisplayResults, normalizeBrowseExploreResult } from "@/lib/explore/ui-results";

const work = (title: string, author: string | undefined, provider: string, alternateTitles?: string[]): WorkIdentity => ({ title, author, alternateTitles, sources: [{ name: provider, url: `https://${provider}.test/${title}` }] });
describe("shared work identity", () => {
  it("recognizes reordered full author names in browse and search policy", () => {
    const a = work("One Piece", "Oda Eiichiro", "MangaPill");
    const b = work("One Piece", "Eiichiro Oda", "MangaDex");
    expect(sameWork(a, b)).toBe(true);
    const browse = (value: WorkIdentity) => normalizeBrowseExploreResult({ ...value, id: value.sources[0].name, slug: "one-piece", tags: [], source: value.sources[0], isTracked: false });
    expect(mergeBrowseDisplayResults([browse(a)], [browse(b)])).toHaveLength(1);
  });
  it("uses alternate titles with independent author or alias evidence", () => {
    expect(sameWork(work("English", "A Writer", "a", ["Japanese"]), work("Japanese", "A Writer", "b"))).toBe(true);
    expect(sameWork(work("Shared", undefined, "a"), work("Shared", undefined, "b"))).toBe(false);
    expect(sameWork(work("Shared", "Ann", "a"), work("Shared", "Joann", "b"))).toBe(false);
  });
  it("keeps different same-provider titles distinct even with identical titles and authors", () => {
    const a = work("Shared", "Same Author", "Webtoon");
    a.sources[0].url = "https://www.webtoons.com/en/canvas/shared/list?title_no=101";
    const b = { ...a, sources: [{ name: "Webtoon", url: "https://www.webtoons.com/en/canvas/shared/list?title_no=202" }] };
    expect(sameWork(a, b)).toBe(false);
  });
});
