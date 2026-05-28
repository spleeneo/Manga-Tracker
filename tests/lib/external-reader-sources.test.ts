import { describe, expect, it } from "vitest";
import { isExternalReaderSource } from "@/lib/external-reader-sources";

describe("isExternalReaderSource", () => {
  it("matches sources that should open outside Mangateo", () => {
    expect(isExternalReaderSource("MangaDex")).toBe(true);
    expect(isExternalReaderSource("Manganato")).toBe(true);
    expect(isExternalReaderSource("MangaDex English")).toBe(true);
  });

  it("does not match embeddable sources", () => {
    expect(isExternalReaderSource("Viz")).toBe(false);
    expect(isExternalReaderSource(null)).toBe(false);
  });
});
