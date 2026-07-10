import { describe, expect, it } from "vitest";
import { groupLibrarySections } from "@/lib/library-sections";

type Item = {
  id: string;
  status: string | null;
  unreadChapters: number;
};

function sectionIds(sections: ReturnType<typeof groupLibrarySections<Item>>, id: string) {
  return sections.find((section) => section.id === id)?.items.map((item) => item.id) ?? [];
}

describe("groupLibrarySections", () => {
  it("places completed titles in the completed section even when unread chapters remain", () => {
    const sections = groupLibrarySections<Item>([
      { id: "completed-unread", status: "COMPLETED", unreadChapters: 3 },
      { id: "ongoing-unread", status: "ONGOING", unreadChapters: 1 },
    ]);

    expect(sectionIds(sections, "completed")).toEqual(["completed-unread"]);
    expect(sectionIds(sections, "updates")).toEqual(["ongoing-unread"]);
  });

  it("recognizes provider status aliases when grouping completed titles", () => {
    const sections = groupLibrarySections<Item>([
      { id: "finished", status: "Finished", unreadChapters: 0 },
      { id: "caught-up", status: "ONGOING", unreadChapters: 0 },
    ]);

    expect(sectionIds(sections, "completed")).toEqual(["finished"]);
    expect(sectionIds(sections, "caught-up")).toEqual(["caught-up"]);
  });
});
