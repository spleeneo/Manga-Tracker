import { describe, expect, it } from "vitest";
import { devFamilyRoleForHost, devFamilySessionCookieName, isDevFamilyEmail, parseDevFamilyRole } from "@/lib/dev-family";

describe("parseDevFamilyRole", () => {
  it("accepts only the two development family roles", () => {
    expect(parseDevFamilyRole("parent")).toBe("parent");
    expect(parseDevFamilyRole("child")).toBe("child");
    expect(parseDevFamilyRole("admin")).toBeNull();
    expect(parseDevFamilyRole(null)).toBeNull();
  });
});

describe("devFamilyRoleForHost", () => {
  it("assigns one unambiguous role to each local origin", () => {
    expect(devFamilyRoleForHost("localhost:3000", null)).toBe("parent");
    expect(devFamilyRoleForHost("localhost:3001", null)).toBe("child");
    expect(devFamilyRoleForHost("localhost:3000", "child")).toBe("child");
    expect(devFamilyRoleForHost("192.168.1.10:3000", null)).toBeNull();
  });
});

describe("devFamilySessionCookieName", () => {
  it("uses distinct cookies for the two same-browser sessions", () => {
    expect(devFamilySessionCookieName("parent")).toBe("authjs.parent-session-token");
    expect(devFamilySessionCookieName("child")).toBe("authjs.child-session-token");
  });
});

describe("isDevFamilyEmail", () => {
  it("recognizes only the two fake family identities", () => {
    expect(isDevFamilyEmail("dev-parent@mangateo.local")).toBe(true);
    expect(isDevFamilyEmail("dev-child@mangateo.local")).toBe(true);
    expect(isDevFamilyEmail("real@example.com")).toBe(false);
  });
});
