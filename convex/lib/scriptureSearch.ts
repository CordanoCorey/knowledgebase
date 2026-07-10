import type { QueryCtx } from "../_generated/server";
import {
  parseBiblePassageReference,
  type ParsedPassageRange,
} from "./scriptureReferences";

type OrdinalRange = {
  endOrdinal: number;
  startOrdinal: number;
};

export type ResolvedBiblePassageSearchTarget = {
  canonicalKey: string;
  href: string;
  id: string;
  label: string;
  passageString: string;
  ranges: OrdinalRange[];
};

export async function resolveBiblePassageSearchTarget(
  ctx: QueryCtx,
  searchText: string,
): Promise<ResolvedBiblePassageSearchTarget | null> {
  const parsedPassage = parseBiblePassageReference(searchText);
  if (!parsedPassage) {
    return null;
  }

  const ranges: OrdinalRange[] = [];
  for (const parsedRange of parsedPassage.ranges) {
    const range = await resolvePassageRange(ctx, parsedRange);
    if (!range) {
      return null;
    }
    ranges.push(range);
  }

  const canonicalKey = parsedPassage.slug;

  return {
    canonicalKey,
    href: `/scripture/${encodeURIComponent(canonicalKey)}`,
    id: canonicalKey,
    label: parsedPassage.label,
    passageString: canonicalKey,
    ranges: normalizeRanges(ranges),
  };
}

async function resolvePassageRange(
  ctx: QueryCtx,
  range: ParsedPassageRange,
): Promise<OrdinalRange | null> {
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

function normalizeRanges(ranges: OrdinalRange[]) {
  const sortedRanges = [...ranges].sort(
    (left, right) => left.startOrdinal - right.startOrdinal,
  );
  const mergedRanges: OrdinalRange[] = [];

  for (const range of sortedRanges) {
    const previousRange = mergedRanges.at(-1);
    if (previousRange && range.startOrdinal <= previousRange.endOrdinal + 1) {
      previousRange.endOrdinal = Math.max(previousRange.endOrdinal, range.endOrdinal);
      continue;
    }

    mergedRanges.push({ ...range });
  }

  return mergedRanges;
}
