import { describe, expect, it } from "vitest";
import { parseDevFamilyRole } from "@/lib/dev-family";

describe("parseDevFamilyRole", () => {
  it("accepts only the two development family roles", () => {
    expect(parseDevFamilyRole("parent")).toBe("parent");
    expect(parseDevFamilyRole("child")).toBe("child");
    expect(parseDevFamilyRole("admin")).toBeNull();
    expect(parseDevFamilyRole(null)).toBeNull();
  });
});
