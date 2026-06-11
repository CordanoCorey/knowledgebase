/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import bibleStructureSource from "../data/scripture/bible-structure.json";
import kjvSource from "../data/scripture/kjv-verses-1769.json";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./scripture.ts": () => import("./scripture"),
  "./seedScripture.ts": () => import("./seedScripture"),
};

type BibleStructure = {
  books: Array<{
    chapterVerseCounts: number[];
    code: string;
    name: string;
    shortName: string;
    sourceName?: string;
    testament: "old" | "new";
    bookOrder: number;
  }>;
  totalBooks: number;
  totalChapters: number;
  totalVerses: number;
  versification: string;
};

type BookSeed = {
  chapterCount: number;
  code: string;
  name: string;
  shortName: string;
  testament: "old" | "new";
  bookOrder: number;
};

type ChapterSeed = {
  bookCode: string;
  chapterNumber: number;
  endOrdinal: number;
  startOrdinal: number;
  verseCount: number;
};

type VerseSeed = {
  bookCode: string;
  chapterNumber: number;
  ordinal: number;
  verseNumber: number;
};

type VerseTextSeed = {
  bookCode: string;
  chapterNumber: number;
  text: string;
  verseNumber: number;
  verseOrdinal: number;
};

const bibleStructure = bibleStructureSource as BibleStructure;
const kjvVerses = kjvSource as Record<string, string>;

describe("KJV Scripture seed data", () => {
  test("bundles complete canonical Protestant Bible structure and KJV source text", () => {
    expect(bibleStructure.versification).toBe("protestant-66-kjv-1769");
    expect(bibleStructure.totalBooks).toBe(66);
    expect(bibleStructure.totalChapters).toBe(1189);
    expect(bibleStructure.totalVerses).toBe(31102);
    expect(bibleStructure.books).toHaveLength(66);
    expect(bibleStructure.books[0]).toMatchObject({
      code: "GEN",
      name: "Genesis",
      bookOrder: 1,
    });
    expect(bibleStructure.books.at(-1)).toMatchObject({
      code: "REV",
      name: "Revelation",
      bookOrder: 66,
    });
    expect(Object.keys(kjvVerses)).toHaveLength(31102);
    expect(cleanVerseText(kjvVerses["John 3:16"])).toBe(
      "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    );
    expect(cleanVerseText(kjvVerses["Romans 8:1"])).toBe(
      "There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.",
    );
    expect(cleanVerseText(kjvVerses["Revelation 22:21"])).toBe(
      "The grace of our Lord Jesus Christ be with you all. Amen.",
    );
  });

  test("seeds idempotent canonical rows and resolves KJV text through getPassage", async () => {
    const t = convexTest({ schema, modules });
    const seedRows = buildFocusedSeedRows(["JHN:3", "ROM:8"]);

    await expect(
      t.mutation(internal.seedScripture.upsertBooks, {
        books: seedRows.books,
      }),
    ).resolves.toEqual({ inserted: 2, skipped: 0, updated: 0 });
    await expect(
      t.mutation(internal.seedScripture.upsertChapters, {
        chapters: seedRows.chapters,
      }),
    ).resolves.toEqual({ inserted: 2, skipped: 0, updated: 0 });
    await expect(
      t.mutation(internal.seedScripture.upsertVerses, {
        verses: seedRows.verses,
      }),
    ).resolves.toEqual({ inserted: 75, skipped: 0, updated: 0 });
    await expect(
      t.mutation(internal.seedScripture.upsertTranslationMetadata, {
        translation: kjvMetadata("metadataOnly"),
      }),
    ).resolves.toEqual({ inserted: 1, skipped: 0, updated: 0 });
    await expect(
      t.mutation(internal.seedScripture.upsertKjvVerseTexts, {
        verses: seedRows.texts,
      }),
    ).resolves.toEqual({ inserted: 40, skipped: 0, updated: 0 });
    await expect(
      t.mutation(internal.seedScripture.upsertTranslationMetadata, {
        translation: kjvMetadata("available"),
      }),
    ).resolves.toEqual({ inserted: 0, skipped: 0, updated: 1 });

    await expect(
      t.mutation(internal.seedScripture.upsertBooks, {
        books: seedRows.books,
      }),
    ).resolves.toEqual({ inserted: 0, skipped: 2, updated: 0 });
    await expect(
      t.mutation(internal.seedScripture.upsertKjvVerseTexts, {
        verses: seedRows.texts,
      }),
    ).resolves.toEqual({ inserted: 0, skipped: 40, updated: 0 });

    const john316 = await t.query(api.scripture.getPassage, {
      passageString: "John 3:16",
    });
    expect(john316.status).toBe("resolved");
    if (john316.status !== "resolved") {
      throw new Error("Expected John 3:16 to resolve.");
    }
    expect(john316.hasText).toBe(true);
    expect(john316.translation).toEqual({
      code: "KJV",
      name: "King James Version (1769)",
      textStatus: "available",
    });
    expect(john316.verses).toHaveLength(1);
    expect(john316.verses[0]).toMatchObject({
      bookCode: "JHN",
      chapterNumber: 3,
      ordinal: 26137,
      text: cleanVerseText(kjvVerses["John 3:16"]),
      verseNumber: 16,
    });

    const romans8 = await t.query(api.scripture.getPassage, {
      passageString: "Romans 8",
    });
    expect(romans8.status).toBe("resolved");
    if (romans8.status !== "resolved") {
      throw new Error("Expected Romans 8 to resolve.");
    }
    expect(romans8.hasText).toBe(true);
    expect(romans8.verses).toHaveLength(39);
    expect(romans8.verses[0]).toMatchObject({
      ordinal: 28118,
      text: cleanVerseText(kjvVerses["Romans 8:1"]),
      verseNumber: 1,
    });
    expect(romans8.verses.at(-1)).toMatchObject({
      ordinal: 28156,
      text: cleanVerseText(kjvVerses["Romans 8:39"]),
      verseNumber: 39,
    });
  });
});

function buildFocusedSeedRows(chapterKeys: string[]) {
  const requestedChapterKeys = new Set(chapterKeys);
  const requestedBookCodes = new Set(
    chapterKeys.map((chapterKey) => chapterKey.split(":")[0]),
  );
  const books: BookSeed[] = [];
  const chapters: ChapterSeed[] = [];
  const verses: VerseSeed[] = [];
  const texts: VerseTextSeed[] = [];
  const booksByCode = new Map(
    bibleStructure.books.map((book) => [book.code, book]),
  );
  let ordinal = 1;

  for (const book of bibleStructure.books) {
    if (requestedBookCodes.has(book.code)) {
      books.push({
        chapterCount: book.chapterVerseCounts.length,
        code: book.code,
        name: book.name,
        shortName: book.shortName,
        testament: book.testament,
        bookOrder: book.bookOrder,
      });
    }

    for (
      let chapterIndex = 0;
      chapterIndex < book.chapterVerseCounts.length;
      chapterIndex += 1
    ) {
      const chapterNumber = chapterIndex + 1;
      const verseCount = book.chapterVerseCounts[chapterIndex];
      const startOrdinal = ordinal;
      const endOrdinal = startOrdinal + verseCount - 1;

      if (requestedChapterKeys.has(`${book.code}:${chapterNumber}`)) {
        chapters.push({
          bookCode: book.code,
          chapterNumber,
          endOrdinal,
          startOrdinal,
          verseCount,
        });

        for (let verseNumber = 1; verseNumber <= verseCount; verseNumber += 1) {
          verses.push({
            bookCode: book.code,
            chapterNumber,
            ordinal,
            verseNumber,
          });

          if (
            book.code === "ROM" ||
            (book.code === "JHN" && chapterNumber === 3 && verseNumber === 16)
          ) {
            const sourceBook = booksByCode.get(book.code);
            const sourceKey = `${sourceBook?.sourceName ?? book.name} ${chapterNumber}:${verseNumber}`;
            texts.push({
              bookCode: book.code,
              chapterNumber,
              text: cleanVerseText(kjvVerses[sourceKey]),
              verseNumber,
              verseOrdinal: ordinal,
            });
          }

          ordinal += 1;
        }
      } else {
        ordinal += verseCount;
      }
    }
  }

  return { books, chapters, texts, verses };
}

function kjvMetadata(textStatus: "metadataOnly" | "available") {
  return {
    category: "translation" as const,
    code: "KJV",
    languageCode: "en",
    licenseNotes: "Test KJV metadata.",
    licenseStatus: "publicDomain" as const,
    name: "King James Version (1769)",
    textStatus,
  };
}

function cleanVerseText(text: string) {
  return text
    .replace(/^#\s*/, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .trim();
}
