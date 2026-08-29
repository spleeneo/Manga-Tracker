import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(path, "utf8");
}

describe("admin diagnostics UI invariants", () => {
  it("keeps retry controls discoverable near quick diagnostics", () => {
    const detail = readSource("src/components/admin-user-detail.tsx");

    expect(detail).toContain("Quick insights");
    expect(detail).toContain("Retry problem syncs");
    expect(detail).toContain("Diagnostic detail");
  });
});
