import { describe, expect, it } from "vitest";
import { groupLibrarySections } from "@/lib/library-sections";

type Item = {
  id: string;
  status: string | null;
  unreadChapters: number;
  isCaughtUp: boolean;
};

function sectionIds(sections: ReturnType<typeof groupLibrarySections<Item>>, id: string) {
  return sections.find((section) => section.id === id)?.items.map((item) => item.id) ?? [];
}

describe("groupLibrarySections", () => {
  it("keeps completed titles with unread chapters in updates", () => {
    const sections = groupLibrarySections<Item>([
      { id: "completed-unread", status: "COMPLETED", unreadChapters: 3, isCaughtUp: false },
      { id: "ongoing-unread", status: "ONGOING", unreadChapters: 1, isCaughtUp: false },
    ]);

    expect(sectionIds(sections, "completed")).toEqual([]);
    expect(sectionIds(sections, "updates")).toEqual(["completed-unread", "ongoing-unread"]);
  });

  it("recognizes provider status aliases when grouping caught-up completed titles", () => {
    const sections = groupLibrarySections<Item>([
      { id: "finished", status: "Finished", unreadChapters: 0, isCaughtUp: true },
      { id: "caught-up", status: "ONGOING", unreadChapters: 0, isCaughtUp: true },
    ]);

    expect(sectionIds(sections, "completed")).toEqual(["finished"]);
    expect(sectionIds(sections, "caught-up")).toEqual(["caught-up"]);
  });
});
