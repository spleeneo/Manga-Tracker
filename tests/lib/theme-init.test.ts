import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { themeInitScript } from "@/lib/theme-init";

describe("themeInitScript", () => {
  it("restores the saved dark theme before a route renders", () => {
    const toggle = vi.fn();
    const document = { documentElement: { classList: { toggle }, dataset: {} as Record<string, string> } };
    const window = {
      localStorage: { getItem: () => "dark" },
      matchMedia: vi.fn(() => ({ matches: false })),
    };

    new Function("window", "document", themeInitScript)(window, document);

    expect(toggle).toHaveBeenCalledWith("dark", true);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("tolerates browser extensions mutating the inline script before hydration", () => {
    const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(layout).toMatch(/<script suppressHydrationWarning dangerouslySetInnerHTML=/);
  });
});
