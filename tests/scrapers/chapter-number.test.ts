import { describe, expect, it } from "vitest";
import { requireChapterNumber, resolveChapterNumber } from "@/lib/scrapers/chapter-number";

describe("provider chapter numbering", () => {
  it.each([0, "0", "0.0", 0.5, "0.5"])("preserves %s", (number) => {
    expect(resolveChapterNumber(number)).toBe(Number(number));
  });
  it.each(["One-shot", "Oneshot", "Special one shot", "ONE SHOT: Story"])("recognizes %s", (label) => {
    expect(resolveChapterNumber(null, label)).toBe(0);
  });
  it("recognizes a sole unnumbered release without parsing title digits", () => {
    expect(resolveChapterNumber(null, "Story of 2024", true)).toBe(0);
    expect(resolveChapterNumber(null, "Story of 2024")).toBeNull();
    expect(resolveChapterNumber("12oops", "One-shot")).toBeNull();
  });
  it("reports ambiguous releases rather than silently omitting them", () => {
    expect(() => requireChapterNumber(null, "Provider")).toThrow("unnumbered release");
    expect(requireChapterNumber(0, "Provider")).toBe(0);
  });
});
