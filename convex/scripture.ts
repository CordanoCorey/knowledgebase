import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import {
  parseBiblePassageReference,
  type ParsedPassageRange,
} from "./lib/scriptureReferences";

const DEFAULT_TRANSLATION_CODE = "KJV";
const MAX_PASSAGE_VERSES = 300;

type ResolvedRange = {
  endOrdinal: number;
  startOrdinal: number;
};

type TranslationSummary = {
  code: string;
  name: string;
  textStatus: "metadataOnly" | "available";
};

export const getPassage = query({
  args: {
    passageString: v.string(),
    translationCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const parsedPassage = parseBiblePassageReference(args.passageString);
    if (!parsedPassage) {
      return {
        message: "The passage reference could not be recognized.",
        passageString: args.passageString,
        status: "invalid" as const,
      };
    }

    const resolvedRanges = [];
    for (const parsedRange of parsedPassage.ranges) {
      const resolvedRange = await resolveRange(ctx, parsedRange);
      if (!resolvedRange) {
        return {
          label: parsedPassage.label,
          message: "Bible structure for this passage is not available yet.",
          passageString: args.passageString,
          slug: parsedPassage.slug,
          status: "missingStructure" as const,
        };
      }
      resolvedRanges.push(resolvedRange);
    }

    const normalizedRanges = normalizeRanges(resolvedRanges);
    const canonicalKey = normalizedRanges
      .map((range) => `${range.startOrdinal}-${range.endOrdinal}`)
      .join(";");
    const label = await formatResolvedPassageLabel(ctx, normalizedRanges);
    const translation = await selectTranslation(ctx, args.translationCode);
    const { isTruncated, verses } = await getVersesForRanges(ctx, normalizedRanges);
    const textByOrdinal = translation
      ? await getVerseTextByOrdinal(ctx, translation._id, verses)
      : new Map<number, string>();
    const verseRows = await buildVerseRows(ctx, verses, textByOrdinal);
    const hasText = verseRows.some((verse) => verse.text !== null);

    return {
      canonicalKey,
      hasText,
      isTruncated,
      label,
      passageString: args.passageString,
      ranges: normalizedRanges,
      slug: parsedPassage.slug,
      status: "resolved" as const,
      translation: summarizeTranslation(translation),
      verses: verseRows,
    };
  },
});

async function resolveRange(
  ctx: QueryCtx,
  range: ParsedPassageRange,
): Promise<ResolvedRange | null> {
  const book = await getBookByCode(ctx, range.bookCode);
  if (!book) {
    return null;
  }

  const startOrdinal =
    range.startVerse === undefined
      ? await getChapterStartOrdinal(ctx, range.bookCode, range.startChapter)
      : await getVerseOrdinal(ctx, range.bookCode, range.startChapter, range.startVerse);
  if (startOrdinal === null) {
    return null;
  }

  const endVerse = range.endVerse ?? range.startVerse;
  const endOrdinal =
    endVerse === undefined
      ? await getChapterEndOrdinal(ctx, range.bookCode, range.endChapter)
      : await getVerseOrdinal(ctx, range.bookCode, range.endChapter, endVerse);
  if (endOrdinal === null || endOrdinal < startOrdinal) {
    return null;
  }

  return { endOrdinal, startOrdinal };
}

async function getBookByCode(ctx: QueryCtx, bookCode: string) {
  return await ctx.db
    .query("bibleBooks")
    .withIndex("by_code", (q) => q.eq("code", bookCode))
    .unique();
}

async function getChapterStartOrdinal(
  ctx: QueryCtx,
  bookCode: string,
  chapterNumber: number,
) {
  const chapter = await getChapter(ctx, bookCode, chapterNumber);
  return chapter?.startOrdinal ?? null;
}

async function getChapterEndOrdinal(
  ctx: QueryCtx,
  bookCode: string,
  chapterNumber: number,
) {
  const chapter = await getChapter(ctx, bookCode, chapterNumber);
  return chapter?.endOrdinal ?? null;
}

async function getChapter(
  ctx: QueryCtx,
  bookCode: string,
  chapterNumber: number,
) {
  return await ctx.db
    .query("bibleChapters")
    .withIndex("by_bookCode_and_chapterNumber", (q) =>
      q.eq("bookCode", bookCode).eq("chapterNumber", chapterNumber),
    )
    .unique();
}

async function getVerseOrdinal(
  ctx: QueryCtx,
  bookCode: string,
  chapterNumber: number,
  verseNumber: number,
) {
  const verse = await ctx.db
    .query("bibleVerses")
    .withIndex("by_bookCode_and_chapterNumber_and_verseNumber", (q) =>
      q
        .eq("bookCode", bookCode)
        .eq("chapterNumber", chapterNumber)
        .eq("verseNumber", verseNumber),
    )
    .unique();
  return verse?.ordinal ?? null;
}

function normalizeRanges(ranges: ResolvedRange[]) {
  const sortedRanges = [...ranges].sort(
    (left, right) => left.startOrdinal - right.startOrdinal,
  );
  const mergedRanges: ResolvedRange[] = [];

  for (const range of sortedRanges) {
    const previousRange = mergedRanges.at(-1);
    if (previousRange && range.startOrdinal <= previousRange.endOrdinal + 1) {
      previousRange.endOrdinal = Math.max(previousRange.endOrdinal, range.endOrdinal);
    } else {
      mergedRanges.push({ ...range });
    }
  }

  return mergedRanges;
}

async function formatResolvedPassageLabel(
  ctx: QueryCtx,
  ranges: ResolvedRange[],
) {
  const labels = [];
  for (const range of ranges) {
    labels.push(await formatResolvedRangeLabel(ctx, range));
  }
  return labels.join("; ");
}

async function formatResolvedRangeLabel(ctx: QueryCtx, range: ResolvedRange) {
  const startVerse = await getVerseByOrdinal(ctx, range.startOrdinal);
  const endVerse = await getVerseByOrdinal(ctx, range.endOrdinal);
  if (!startVerse || !endVerse) {
    return `${range.startOrdinal}-${range.endOrdinal}`;
  }

  const startBook = await getBookByCode(ctx, startVerse.bookCode);
  const endBook = await getBookByCode(ctx, endVerse.bookCode);
  const startName = startBook?.name ?? startVerse.bookCode;
  const endName = endBook?.name ?? endVerse.bookCode;
  const coversWholeChapters = await rangeCoversWholeChapters(ctx, range, startVerse, endVerse);

  if (coversWholeChapters) {
    if (
      startVerse.bookCode === endVerse.bookCode &&
      startVerse.chapterNumber === endVerse.chapterNumber
    ) {
      return `${startName} ${startVerse.chapterNumber}`;
    }

    if (startVerse.bookCode === endVerse.bookCode) {
      return `${startName} ${startVerse.chapterNumber}-${endVerse.chapterNumber}`;
    }
  }

  if (
    startVerse.bookCode === endVerse.bookCode &&
    startVerse.chapterNumber === endVerse.chapterNumber
  ) {
    if (startVerse.verseNumber === endVerse.verseNumber) {
      return `${startName} ${startVerse.chapterNumber}:${startVerse.verseNumber}`;
    }

    return `${startName} ${startVerse.chapterNumber}:${startVerse.verseNumber}-${endVerse.verseNumber}`;
  }

  if (startVerse.bookCode === endVerse.bookCode) {
    return `${startName} ${startVerse.chapterNumber}:${startVerse.verseNumber}-${endVerse.chapterNumber}:${endVerse.verseNumber}`;
  }

  return `${startName} ${startVerse.chapterNumber}:${startVerse.verseNumber}-${endName} ${endVerse.chapterNumber}:${endVerse.verseNumber}`;
}

async function rangeCoversWholeChapters(
  ctx: QueryCtx,
  range: ResolvedRange,
  startVerse: Doc<"bibleVerses">,
  endVerse: Doc<"bibleVerses">,
) {
  const startChapter = await getChapter(ctx, startVerse.bookCode, startVerse.chapterNumber);
  const endChapter = await getChapter(ctx, endVerse.bookCode, endVerse.chapterNumber);

  return (
    startChapter?.startOrdinal === range.startOrdinal &&
    endChapter?.endOrdinal === range.endOrdinal
  );
}

async function getVerseByOrdinal(ctx: QueryCtx, ordinal: number) {
  return await ctx.db
    .query("bibleVerses")
    .withIndex("by_ordinal", (q) => q.eq("ordinal", ordinal))
    .unique();
}

async function selectTranslation(ctx: QueryCtx, translationCode?: string) {
  const requestedTranslationCode = translationCode?.trim().toUpperCase();
  if (requestedTranslationCode) {
    return await ctx.db
      .query("bibleTranslations")
      .withIndex("by_code", (q) => q.eq("code", requestedTranslationCode))
      .unique();
  }

  const defaultTranslation = await ctx.db
    .query("bibleTranslations")
    .withIndex("by_code", (q) => q.eq("code", DEFAULT_TRANSLATION_CODE))
    .unique();
  if (defaultTranslation?.textStatus === "available") {
    return defaultTranslation;
  }

  const availableTranslation = await ctx.db
    .query("bibleTranslations")
    .withIndex("by_textStatus_and_code", (q) => q.eq("textStatus", "available"))
    .take(1);

  return availableTranslation[0] ?? defaultTranslation ?? null;
}

function summarizeTranslation(
  translation: Doc<"bibleTranslations"> | null,
): TranslationSummary | null {
  if (!translation) {
    return null;
  }

  return {
    code: translation.code,
    name: translation.name,
    textStatus: translation.textStatus,
  };
}

async function getVersesForRanges(ctx: QueryCtx, ranges: ResolvedRange[]) {
  const verses: Doc<"bibleVerses">[] = [];
  let isTruncated = false;

  for (const range of ranges) {
    const remaining = MAX_PASSAGE_VERSES + 1 - verses.length;
    if (remaining <= 0) {
      isTruncated = true;
      break;
    }

    const rangeVerses = await ctx.db
      .query("bibleVerses")
      .withIndex("by_ordinal", (q) =>
        q.gte("ordinal", range.startOrdinal).lte("ordinal", range.endOrdinal),
      )
      .take(remaining);
    verses.push(...rangeVerses);
  }

  if (verses.length > MAX_PASSAGE_VERSES) {
    verses.length = MAX_PASSAGE_VERSES;
    isTruncated = true;
  }

  return { isTruncated, verses };
}

async function getVerseTextByOrdinal(
  ctx: QueryCtx,
  translationId: Id<"bibleTranslations">,
  verses: Doc<"bibleVerses">[],
) {
  const textByOrdinal = new Map<number, string>();
  const ordinalRanges = getContiguousOrdinalRanges(verses);

  for (const range of ordinalRanges) {
    const limit = range.endOrdinal - range.startOrdinal + 1;
    const verseTexts = await ctx.db
      .query("bibleVerseTexts")
      .withIndex("by_translationId_and_verseOrdinal", (q) =>
        q
          .eq("translationId", translationId)
          .gte("verseOrdinal", range.startOrdinal)
          .lte("verseOrdinal", range.endOrdinal),
      )
      .take(limit);

    for (const verseText of verseTexts) {
      textByOrdinal.set(verseText.verseOrdinal, verseText.text);
    }
  }

  return textByOrdinal;
}

function getContiguousOrdinalRanges(verses: Doc<"bibleVerses">[]) {
  const ranges: ResolvedRange[] = [];

  for (const verse of verses) {
    const previousRange = ranges.at(-1);
    if (previousRange && verse.ordinal === previousRange.endOrdinal + 1) {
      previousRange.endOrdinal = verse.ordinal;
    } else {
      ranges.push({
        endOrdinal: verse.ordinal,
        startOrdinal: verse.ordinal,
      });
    }
  }

  return ranges;
}

async function buildVerseRows(
  ctx: QueryCtx,
  verses: Doc<"bibleVerses">[],
  textByOrdinal: Map<number, string>,
) {
  const bookByCode = new Map<string, Doc<"bibleBooks"> | null>();
  const verseRows = [];

  for (const verse of verses) {
    let book = bookByCode.get(verse.bookCode);
    if (!bookByCode.has(verse.bookCode)) {
      book = await getBookByCode(ctx, verse.bookCode);
      bookByCode.set(verse.bookCode, book);
    }

    verseRows.push({
      bookCode: verse.bookCode,
      bookName: book?.name ?? verse.bookCode,
      bookShortName: book?.shortName ?? verse.bookCode,
      chapterNumber: verse.chapterNumber,
      ordinal: verse.ordinal,
      text: textByOrdinal.get(verse.ordinal) ?? null,
      verseNumber: verse.verseNumber,
    });
  }

  return verseRows;
}
