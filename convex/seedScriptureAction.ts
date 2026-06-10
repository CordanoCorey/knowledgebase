"use node";

import { v } from "convex/values";
import { createHash } from "node:crypto";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  BIBLE_BOOKS,
  parseBiblePassageReference,
} from "./lib/scriptureReferences";

const STRUCTURE_BATCH_SIZE = 250;
const TEXT_BATCH_SIZE = 200;
const EXPECTED_BOOK_COUNT = 66;
const EXPECTED_CHAPTER_COUNT = 1189;
const EXPECTED_VERSE_COUNT = 31102;

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

type SeedStats = {
  inserted: number;
  skipped: number;
  updated: number;
};

type SeedActionResult = {
  books: SeedStats;
  chapters: SeedStats;
  kjvMetadataAvailable: SeedStats;
  kjvMetadataInitial: SeedStats;
  sourceSha256: string;
  textRange: {
    endOrdinal: number;
    startOrdinal: number;
  };
  verseTexts: SeedStats;
  verses: SeedStats;
};

export const seedKjvFromSourceUrl = internalAction({
  args: {
    endOrdinal: v.optional(v.number()),
    expectedSha256: v.string(),
    markAvailable: v.optional(v.boolean()),
    retrievedDate: v.string(),
    seedStructure: v.optional(v.boolean()),
    sourceRepositoryUrl: v.string(),
    sourceUrl: v.string(),
    startOrdinal: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SeedActionResult> => {
    const sourceJson = await fetchSourceJson(args.sourceUrl);
    const sourceSha256 = createHash("sha256")
      .update(sourceJson)
      .digest("hex")
      .toUpperCase();

    if (sourceSha256 !== args.expectedSha256.toUpperCase()) {
      throw new Error(
        `KJV source hash mismatch. Expected ${args.expectedSha256}, received ${sourceSha256}.`,
      );
    }

    const sourceVerses = parseSourceVerses(sourceJson);
    const seedRows = buildSeedRows(sourceVerses);
    const startOrdinal = Math.max(1, Math.floor(args.startOrdinal ?? 1));
    const endOrdinal = Math.min(
      EXPECTED_VERSE_COUNT,
      Math.floor(args.endOrdinal ?? EXPECTED_VERSE_COUNT),
    );
    if (endOrdinal < startOrdinal) {
      throw new Error(
        `Invalid ordinal range ${startOrdinal}-${endOrdinal} for KJV seed.`,
      );
    }
    const selectedTexts = seedRows.texts.filter(
      (verse) =>
        verse.verseOrdinal >= startOrdinal && verse.verseOrdinal <= endOrdinal,
    );
    if (selectedTexts.length === 0) {
      throw new Error(`No KJV text rows selected for ${startOrdinal}-${endOrdinal}.`);
    }
    const licenseNotes = [
      `Source: ${args.sourceRepositoryUrl}`,
      `File: ${args.sourceUrl}`,
      `Retrieved: ${args.retrievedDate}`,
      `SHA-256: ${sourceSha256}`,
      "License: source repository describes the KJV JSON as Public Domain and uses Unlicense.",
      "Transformation: removed leading paragraph markers (#) and square-bracket italic markers for plain-text storage.",
    ].join(" ");

    const shouldSeedStructure = args.seedStructure ?? true;
    const bookStats: SeedStats = shouldSeedStructure
      ? await ctx.runMutation(internal.seedScripture.upsertBooks, {
          books: seedRows.books,
        })
      : emptyStats();
    const chapterStats: SeedStats = shouldSeedStructure
      ? await runBatches(
          seedRows.chapters,
          STRUCTURE_BATCH_SIZE,
          async (chapters): Promise<SeedStats> =>
            await ctx.runMutation(internal.seedScripture.upsertChapters, {
              chapters,
            }),
        )
      : emptyStats();
    const verseStats: SeedStats = shouldSeedStructure
      ? await runBatches(
          seedRows.verses,
          STRUCTURE_BATCH_SIZE,
          async (verses): Promise<SeedStats> =>
            await ctx.runMutation(internal.seedScripture.upsertVerses, {
              verses,
            }),
        )
      : emptyStats();

    const metadataOnlyStats: SeedStats = await ctx.runMutation(
      internal.seedScripture.upsertTranslationMetadata,
      {
        translation: {
          category: "translation",
          code: "KJV",
          languageCode: "en",
          licenseNotes,
          licenseStatus: "publicDomain",
          name: "King James Version (1769)",
          textStatus: "metadataOnly",
        },
      },
    );

    const textStats: SeedStats = await runBatches(
      selectedTexts,
      TEXT_BATCH_SIZE,
      async (verses): Promise<SeedStats> =>
        await ctx.runMutation(internal.seedScripture.upsertKjvVerseTexts, {
          verses,
        }),
    );

    const availableStats: SeedStats = args.markAvailable
      ? await ctx.runMutation(internal.seedScripture.upsertTranslationMetadata, {
          translation: {
            category: "translation",
            code: "KJV",
            languageCode: "en",
            licenseNotes,
            licenseStatus: "publicDomain",
            name: "King James Version (1769)",
            textStatus: "available",
          },
        })
      : emptyStats();

    return {
      books: bookStats,
      chapters: chapterStats,
      kjvMetadataAvailable: availableStats,
      kjvMetadataInitial: metadataOnlyStats,
      sourceSha256,
      textRange: {
        endOrdinal,
        startOrdinal,
      },
      verseTexts: textStats,
      verses: verseStats,
    };
  },
});

function emptyStats(): SeedStats {
  return { inserted: 0, skipped: 0, updated: 0 };
}

async function fetchSourceJson(sourceUrl: string) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch KJV source: ${response.status}.`);
  }
  return await response.text();
}

function parseSourceVerses(sourceJson: string) {
  const parsedSource = JSON.parse(sourceJson) as Record<string, unknown>;
  const sourceVerses = Object.entries(parsedSource).map(([reference, text]) => {
    if (typeof text !== "string") {
      throw new Error(`KJV source value for ${reference} is not a string.`);
    }
    return { reference, text };
  });

  if (sourceVerses.length !== EXPECTED_VERSE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_VERSE_COUNT} KJV verses, found ${sourceVerses.length}.`,
    );
  }

  return sourceVerses;
}

function buildSeedRows(sourceVerses: { reference: string; text: string }[]) {
  const chapterVerseCountsByBook = new Map<string, Map<number, number>>();
  const sourceTextByVerseKey = new Map<string, string>();

  for (const sourceVerse of sourceVerses) {
    const parsedPassage = parseBiblePassageReference(sourceVerse.reference);
    if (!parsedPassage || parsedPassage.ranges.length !== 1) {
      throw new Error(`Could not parse KJV reference ${sourceVerse.reference}.`);
    }

    const range = parsedPassage.ranges[0];
    if (
      range.startVerse === undefined ||
      range.endVerse === undefined ||
      range.startChapter !== range.endChapter ||
      range.startVerse !== range.endVerse
    ) {
      throw new Error(`KJV reference is not a single verse: ${sourceVerse.reference}.`);
    }

    const chapterCounts =
      chapterVerseCountsByBook.get(range.bookCode) ?? new Map<number, number>();
    chapterCounts.set(
      range.startChapter,
      Math.max(chapterCounts.get(range.startChapter) ?? 0, range.startVerse),
    );
    chapterVerseCountsByBook.set(range.bookCode, chapterCounts);
    sourceTextByVerseKey.set(
      getVerseKey(range.bookCode, range.startChapter, range.startVerse),
      cleanVerseText(sourceVerse.text),
    );
  }

  const books: BookSeed[] = [];
  const chapters: ChapterSeed[] = [];
  const verses: VerseSeed[] = [];
  const texts: VerseTextSeed[] = [];
  let ordinal = 1;

  for (const bookReference of BIBLE_BOOKS) {
    const chapterCounts = chapterVerseCountsByBook.get(bookReference.code);
    if (!chapterCounts) {
      throw new Error(`No KJV source chapters found for ${bookReference.code}.`);
    }

    books.push({
      chapterCount: chapterCounts.size,
      code: bookReference.code,
      name: bookReference.name,
      shortName: bookReference.shortName,
      testament: bookReference.order <= 39 ? "old" : "new",
      bookOrder: bookReference.order,
    });

    for (let chapterNumber = 1; chapterNumber <= chapterCounts.size; chapterNumber += 1) {
      const verseCount = chapterCounts.get(chapterNumber);
      if (verseCount === undefined) {
        throw new Error(`Missing chapter ${chapterNumber} for ${bookReference.code}.`);
      }

      const startOrdinal = ordinal;
      const endOrdinal = startOrdinal + verseCount - 1;
      chapters.push({
        bookCode: bookReference.code,
        chapterNumber,
        endOrdinal,
        startOrdinal,
        verseCount,
      });

      for (let verseNumber = 1; verseNumber <= verseCount; verseNumber += 1) {
        const text = sourceTextByVerseKey.get(
          getVerseKey(bookReference.code, chapterNumber, verseNumber),
        );
        if (text === undefined) {
          throw new Error(
            `Missing KJV source text for ${bookReference.code} ${chapterNumber}:${verseNumber}.`,
          );
        }

        verses.push({
          bookCode: bookReference.code,
          chapterNumber,
          ordinal,
          verseNumber,
        });
        texts.push({
          bookCode: bookReference.code,
          chapterNumber,
          text,
          verseNumber,
          verseOrdinal: ordinal,
        });
        ordinal += 1;
      }
    }
  }

  if (books.length !== EXPECTED_BOOK_COUNT) {
    throw new Error(`Expected ${EXPECTED_BOOK_COUNT} books, found ${books.length}.`);
  }
  if (chapters.length !== EXPECTED_CHAPTER_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_CHAPTER_COUNT} chapters, found ${chapters.length}.`,
    );
  }
  if (verses.length !== EXPECTED_VERSE_COUNT || texts.length !== EXPECTED_VERSE_COUNT) {
    throw new Error(`Expected ${EXPECTED_VERSE_COUNT} verses, found ${verses.length}.`);
  }

  return { books, chapters, texts, verses };
}

function cleanVerseText(text: string) {
  return text
    .replace(/^#\s*/, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .trim();
}

function getVerseKey(bookCode: string, chapterNumber: number, verseNumber: number) {
  return `${bookCode}:${chapterNumber}:${verseNumber}`;
}

async function runBatches<T>(
  rows: T[],
  batchSize: number,
  handler: (batch: T[]) => Promise<SeedStats>,
) {
  const stats: SeedStats = { inserted: 0, skipped: 0, updated: 0 };

  for (let index = 0; index < rows.length; index += batchSize) {
    const batchStats = await handler(rows.slice(index, index + batchSize));
    stats.inserted += batchStats.inserted;
    stats.skipped += batchStats.skipped;
    stats.updated += batchStats.updated;
  }

  return stats;
}
