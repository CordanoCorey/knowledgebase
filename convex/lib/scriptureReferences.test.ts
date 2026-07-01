import { describe, expect, test } from "vitest";
import {
  BIBLE_BOOKS,
  parseBiblePassageReference,
} from "./scriptureReferences";

describe("Bible passage reference parsing", () => {
  test("keeps the complete canonical book list in order", () => {
    expect(BIBLE_BOOKS).toHaveLength(66);
    expect(BIBLE_BOOKS[0]).toMatchObject({
      code: "GEN",
      name: "Genesis",
      order: 1,
    });
    expect(BIBLE_BOOKS.at(-1)).toMatchObject({
      code: "REV",
      name: "Revelation",
      order: 66,
    });
  });

  test("parses aliases, punctuation, en dashes, and verse ranges", () => {
    expect(parseBiblePassageReference("Jn. 3:16-18")).toEqual({
      label: "John 3:16-18",
      ranges: [
        expect.objectContaining({
          bookCode: "JHN",
          endChapter: 3,
          endVerse: 18,
          startChapter: 3,
          startVerse: 16,
        }),
      ],
      slug: "john-3-16-18",
    });

    expect(parseBiblePassageReference("Romans 8:28–30")?.label).toBe(
      "Romans 8:28-30",
    );
  });

  test("parses slug-style references and numbered books", () => {
    expect(parseBiblePassageReference("1-corinthians-13-4-7")).toMatchObject({
      label: "1 Corinthians 13:4-7",
      slug: "1-corinthians-13-4-7",
    });
    expect(parseBiblePassageReference("ii tim 1:6")).toMatchObject({
      label: "2 Timothy 1:6",
      slug: "2-timothy-1-6",
    });
  });

  test("sorts multi-book references into canonical order", () => {
    expect(parseBiblePassageReference("John 1:1; Genesis 1-2")).toMatchObject({
      label: "Genesis 1-2; John 1:1",
      slug: "genesis-1-to-2--john-1-1",
    });
  });

  test("rejects empty, unknown, and zero-valued references", () => {
    expect(parseBiblePassageReference("")).toBeNull();
    expect(parseBiblePassageReference("Hezekiah 4:1")).toBeNull();
    expect(parseBiblePassageReference("John 0")).toBeNull();
    expect(parseBiblePassageReference("John")).toBeNull();
  });

  test("bounds pasted reference lists to the first eight valid segments", () => {
    const parsed = parseBiblePassageReference(
      [
        "Genesis 1",
        "Exodus 1",
        "Leviticus 1",
        "Numbers 1",
        "Deuteronomy 1",
        "Joshua 1",
        "Judges 1",
        "Ruth 1",
        "1 Samuel 1",
      ].join("; "),
    );

    expect(parsed?.ranges).toHaveLength(8);
    expect(parsed?.label).not.toContain("1 Samuel");
  });
});
