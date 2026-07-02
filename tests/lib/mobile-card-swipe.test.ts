import { describe, expect, it } from "vitest";
import { getMobileCardSwipeOffset, shouldSyncFromMobileCardSwipe } from "@/lib/mobile-card-swipe";

describe("mobile manga card swipe", () => {
    it("tracks a deliberate right swipe up to the visual limit", () => {
        expect(getMobileCardSwipeOffset(10, 20, 55, 24)).toBe(45);
        expect(getMobileCardSwipeOffset(10, 20, 150, 24)).toBe(80);
    });

    it("ignores left swipes and primarily vertical gestures", () => {
        expect(getMobileCardSwipeOffset(60, 20, 20, 22)).toBe(0);
        expect(getMobileCardSwipeOffset(10, 20, 35, 70)).toBe(0);
    });

    it("syncs only after crossing the right-swipe threshold", () => {
        expect(shouldSyncFromMobileCardSwipe(63)).toBe(false);
        expect(shouldSyncFromMobileCardSwipe(64)).toBe(true);
    });
});
