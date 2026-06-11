import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const translationCategory = v.union(
  v.literal("translation"),
  v.literal("sourceText"),
);

const textStatus = v.union(v.literal("metadataOnly"), v.literal("available"));

const licenseStatus = v.union(
  v.literal("publicDomain"),
  v.literal("permissionRequired"),
  v.literal("unknown"),
);

const bookSeedInput = v.object({
  chapterCount: v.number(),
  code: v.string(),
  name: v.string(),
  shortName: v.string(),
  testament: v.union(v.literal("old"), v.literal("new")),
  bookOrder: v.number(),
});

const chapterSeedInput = v.object({
  bookCode: v.string(),
  chapterNumber: v.number(),
  endOrdinal: v.number(),
  startOrdinal: v.number(),
  verseCount: v.number(),
});

const verseSeedInput = v.object({
  bookCode: v.string(),
  chapterNumber: v.number(),
  ordinal: v.number(),
  verseNumber: v.number(),
});

const translationSeedInput = v.object({
  category: translationCategory,
  code: v.string(),
  languageCode: v.string(),
  licenseNotes: v.optional(v.string()),
  licenseStatus,
  name: v.string(),
  textStatus,
});

const verseTextSeedInput = v.object({
  bookCode: v.string(),
  chapterNumber: v.number(),
  text: v.string(),
  verseNumber: v.number(),
  verseOrdinal: v.number(),
});

type Stats = {
  inserted: number;
  skipped: number;
  updated: number;
};

type BibleBookPatch = Partial<
  Omit<Doc<"bibleBooks">, "_creationTime" | "_id">
>;
type BibleChapterPatch = Partial<
  Omit<Doc<"bibleChapters">, "_creationTime" | "_id">
>;
type BibleVersePatch = Partial<
  Omit<Doc<"bibleVerses">, "_creationTime" | "_id">
>;
type BibleTranslationPatch = Partial<
  Omit<Doc<"bibleTranslations">, "_creationTime" | "_id">
>;
type BibleVerseTextPatch = Partial<
  Omit<Doc<"bibleVerseTexts">, "_creationTime" | "_id">
>;

export const upsertBooks = internalMutation({
  args: {
    books: v.array(bookSeedInput),
  },
  handler: async (ctx, args) => {
    const stats = emptyStats();

    for (const book of args.books) {
      const existingBook = await getBookByCode(ctx, book.code);
      if (!existingBook) {
        await ctx.db.insert("bibleBooks", book);
        stats.inserted += 1;
        continue;
      }

      const patch = getBookPatch(existingBook, book);
      if (hasPatch(patch)) {
        await ctx.db.patch(existingBook._id, patch);
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
    }

    return stats;
  },
});

export const upsertChapters = internalMutation({
  args: {
    chapters: v.array(chapterSeedInput),
  },
  handler: async (ctx, args) => {
    const stats = emptyStats();
    const bookIdsByCode = new Map<string, Id<"bibleBooks">>();

    for (const chapter of args.chapters) {
      const bookId = await getBookId(ctx, chapter.bookCode, bookIdsByCode);
      const existingChapter = await ctx.db
        .query("bibleChapters")
        .withIndex("by_bookCode_and_chapterNumber", (q) =>
          q
            .eq("bookCode", chapter.bookCode)
            .eq("chapterNumber", chapter.chapterNumber),
        )
        .unique();

      const nextChapter = {
        ...chapter,
        bookId,
      };

      if (!existingChapter) {
        await ctx.db.insert("bibleChapters", nextChapter);
        stats.inserted += 1;
        continue;
      }

      const patch = getChapterPatch(existingChapter, nextChapter);
      if (hasPatch(patch)) {
        await ctx.db.patch(existingChapter._id, patch);
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
    }

    return stats;
  },
});

export const upsertVerses = internalMutation({
  args: {
    verses: v.array(verseSeedInput),
  },
  handler: async (ctx, args) => {
    const stats = emptyStats();
    const bookIdsByCode = new Map<string, Id<"bibleBooks">>();

    for (const verse of args.verses) {
      const bookId = await getBookId(ctx, verse.bookCode, bookIdsByCode);
      const existingVerse = await getVerse(
        ctx,
        verse.bookCode,
        verse.chapterNumber,
        verse.verseNumber,
      );

      const nextVerse = {
        ...verse,
        bookId,
      };

      if (!existingVerse) {
        await ctx.db.insert("bibleVerses", nextVerse);
        stats.inserted += 1;
        continue;
      }

      const patch = getVersePatch(existingVerse, nextVerse);
      if (hasPatch(patch)) {
        await ctx.db.patch(existingVerse._id, patch);
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
    }

    return stats;
  },
});

export const upsertTranslationMetadata = internalMutation({
  args: {
    translation: translationSeedInput,
  },
  handler: async (ctx, args) => {
    const existingTranslation = await getTranslationByCode(
      ctx,
      args.translation.code,
    );
    const nextTranslation =
      existingTranslation?.textStatus === "available" &&
      args.translation.textStatus === "metadataOnly"
        ? { ...args.translation, textStatus: "available" as const }
        : args.translation;

    if (!existingTranslation) {
      await ctx.db.insert("bibleTranslations", nextTranslation);
      return { inserted: 1, skipped: 0, updated: 0 };
    }

    const patch = getTranslationPatch(existingTranslation, nextTranslation);
    if (hasPatch(patch)) {
      await ctx.db.patch(existingTranslation._id, patch);
      return { inserted: 0, skipped: 0, updated: 1 };
    }

    return { inserted: 0, skipped: 1, updated: 0 };
  },
});

export const upsertKjvVerseTexts = internalMutation({
  args: {
    verses: v.array(verseTextSeedInput),
  },
  handler: async (ctx, args) => {
    const translation = await getTranslationByCode(ctx, "KJV");
    if (!translation) {
      throw new Error("KJV translation metadata must be seeded before verse text.");
    }

    const stats = emptyStats();

    for (const verse of args.verses) {
      const canonicalVerse = await getVerse(
        ctx,
        verse.bookCode,
        verse.chapterNumber,
        verse.verseNumber,
      );
      if (!canonicalVerse) {
        throw new Error(
          `Missing canonical verse ${verse.bookCode} ${verse.chapterNumber}:${verse.verseNumber}.`,
        );
      }
      if (canonicalVerse.ordinal !== verse.verseOrdinal) {
        throw new Error(
          `Ordinal mismatch for ${verse.bookCode} ${verse.chapterNumber}:${verse.verseNumber}.`,
        );
      }

      const existingText = await ctx.db
        .query("bibleVerseTexts")
        .withIndex("by_translationId_and_verseId", (q) =>
          q.eq("translationId", translation._id).eq("verseId", canonicalVerse._id),
        )
        .unique();

      const nextText = {
        text: verse.text,
        translationId: translation._id,
        verseId: canonicalVerse._id,
        verseOrdinal: verse.verseOrdinal,
      };

      if (!existingText) {
        await ctx.db.insert("bibleVerseTexts", nextText);
        stats.inserted += 1;
        continue;
      }

      const patch = getVerseTextPatch(existingText, nextText);
      if (hasPatch(patch)) {
        await ctx.db.patch(existingText._id, patch);
        stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
    }

    return stats;
  },
});

export const verifySeed = internalQuery({
  args: {},
  handler: async (ctx) => {
    const books = await ctx.db
      .query("bibleBooks")
      .withIndex("by_bookOrder")
      .take(67);
    const chapters = await ctx.db.query("bibleChapters").take(1190);
    const firstVerse = await getVerse(ctx, "GEN", 1, 1);
    const john316 = await getVerse(ctx, "JHN", 3, 16);
    const romans81 = await getVerse(ctx, "ROM", 8, 1);
    const lastVerse = await getVerse(ctx, "REV", 22, 21);
    const kjv = await getTranslationByCode(ctx, "KJV");
    const john316Text =
      kjv && john316 ? await getVerseText(ctx, kjv._id, john316._id) : null;
    const romans81Text =
      kjv && romans81 ? await getVerseText(ctx, kjv._id, romans81._id) : null;
    const lastVerseText =
      kjv && lastVerse ? await getVerseText(ctx, kjv._id, lastVerse._id) : null;

    return {
      books: {
        expected: 66,
        found: books.length,
        ok: books.length === 66,
      },
      chapters: {
        expected: 1189,
        found: chapters.length,
        ok: chapters.length === 1189,
      },
      kjv: kjv
        ? {
            john316TextPresent: john316Text !== null,
            lastVerseTextPresent: lastVerseText !== null,
            romans81TextPresent: romans81Text !== null,
            textStatus: kjv.textStatus,
          }
        : null,
      verses: {
        firstOrdinal: firstVerse?.ordinal ?? null,
        john316Ordinal: john316?.ordinal ?? null,
        lastOrdinal: lastVerse?.ordinal ?? null,
        ok:
          firstVerse?.ordinal === 1 &&
          john316 !== null &&
          lastVerse?.ordinal === 31102,
      },
    };
  },
});

function emptyStats(): Stats {
  return { inserted: 0, skipped: 0, updated: 0 };
}

async function getBookByCode(ctx: QueryCtx | MutationCtx, code: string) {
  return await ctx.db
    .query("bibleBooks")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

async function getBookId(
  ctx: MutationCtx,
  bookCode: string,
  bookIdsByCode: Map<string, Id<"bibleBooks">>,
) {
  const cachedBookId = bookIdsByCode.get(bookCode);
  if (cachedBookId) {
    return cachedBookId;
  }

  const book = await getBookByCode(ctx, bookCode);
  if (!book) {
    throw new Error(`Missing Bible book ${bookCode}.`);
  }

  bookIdsByCode.set(bookCode, book._id);
  return book._id;
}

async function getVerse(
  ctx: QueryCtx | MutationCtx,
  bookCode: string,
  chapterNumber: number,
  verseNumber: number,
) {
  return await ctx.db
    .query("bibleVerses")
    .withIndex("by_bookCode_and_chapterNumber_and_verseNumber", (q) =>
      q
        .eq("bookCode", bookCode)
        .eq("chapterNumber", chapterNumber)
        .eq("verseNumber", verseNumber),
    )
    .unique();
}

async function getTranslationByCode(
  ctx: QueryCtx | MutationCtx,
  code: string,
) {
  return await ctx.db
    .query("bibleTranslations")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

async function getVerseText(
  ctx: QueryCtx,
  translationId: Id<"bibleTranslations">,
  verseId: Id<"bibleVerses">,
) {
  return await ctx.db
    .query("bibleVerseTexts")
    .withIndex("by_translationId_and_verseId", (q) =>
      q.eq("translationId", translationId).eq("verseId", verseId),
    )
    .unique();
}

function getBookPatch(
  existingBook: Doc<"bibleBooks">,
  nextBook: Omit<Doc<"bibleBooks">, "_creationTime" | "_id">,
) {
  const patch: BibleBookPatch = {};
  if (existingBook.chapterCount !== nextBook.chapterCount) {
    patch.chapterCount = nextBook.chapterCount;
  }
  if (existingBook.code !== nextBook.code) {
    patch.code = nextBook.code;
  }
  if (existingBook.name !== nextBook.name) {
    patch.name = nextBook.name;
  }
  if (existingBook.shortName !== nextBook.shortName) {
    patch.shortName = nextBook.shortName;
  }
  if (existingBook.testament !== nextBook.testament) {
    patch.testament = nextBook.testament;
  }
  if (existingBook.bookOrder !== nextBook.bookOrder) {
    patch.bookOrder = nextBook.bookOrder;
  }
  return patch;
}

function getChapterPatch(
  existingChapter: Doc<"bibleChapters">,
  nextChapter: Omit<Doc<"bibleChapters">, "_creationTime" | "_id">,
) {
  const patch: BibleChapterPatch = {};
  if (existingChapter.bookCode !== nextChapter.bookCode) {
    patch.bookCode = nextChapter.bookCode;
  }
  if (existingChapter.bookId !== nextChapter.bookId) {
    patch.bookId = nextChapter.bookId;
  }
  if (existingChapter.chapterNumber !== nextChapter.chapterNumber) {
    patch.chapterNumber = nextChapter.chapterNumber;
  }
  if (existingChapter.endOrdinal !== nextChapter.endOrdinal) {
    patch.endOrdinal = nextChapter.endOrdinal;
  }
  if (existingChapter.startOrdinal !== nextChapter.startOrdinal) {
    patch.startOrdinal = nextChapter.startOrdinal;
  }
  if (existingChapter.verseCount !== nextChapter.verseCount) {
    patch.verseCount = nextChapter.verseCount;
  }
  return patch;
}

function getVersePatch(
  existingVerse: Doc<"bibleVerses">,
  nextVerse: Omit<Doc<"bibleVerses">, "_creationTime" | "_id">,
) {
  const patch: BibleVersePatch = {};
  if (existingVerse.bookCode !== nextVerse.bookCode) {
    patch.bookCode = nextVerse.bookCode;
  }
  if (existingVerse.bookId !== nextVerse.bookId) {
    patch.bookId = nextVerse.bookId;
  }
  if (existingVerse.chapterNumber !== nextVerse.chapterNumber) {
    patch.chapterNumber = nextVerse.chapterNumber;
  }
  if (existingVerse.ordinal !== nextVerse.ordinal) {
    patch.ordinal = nextVerse.ordinal;
  }
  if (existingVerse.verseNumber !== nextVerse.verseNumber) {
    patch.verseNumber = nextVerse.verseNumber;
  }
  return patch;
}

function getTranslationPatch(
  existingTranslation: Doc<"bibleTranslations">,
  nextTranslation: Omit<Doc<"bibleTranslations">, "_creationTime" | "_id">,
) {
  const patch: BibleTranslationPatch = {};
  if (existingTranslation.category !== nextTranslation.category) {
    patch.category = nextTranslation.category;
  }
  if (existingTranslation.code !== nextTranslation.code) {
    patch.code = nextTranslation.code;
  }
  if (existingTranslation.languageCode !== nextTranslation.languageCode) {
    patch.languageCode = nextTranslation.languageCode;
  }
  if (existingTranslation.licenseNotes !== nextTranslation.licenseNotes) {
    patch.licenseNotes = nextTranslation.licenseNotes;
  }
  if (existingTranslation.licenseStatus !== nextTranslation.licenseStatus) {
    patch.licenseStatus = nextTranslation.licenseStatus;
  }
  if (existingTranslation.name !== nextTranslation.name) {
    patch.name = nextTranslation.name;
  }
  if (existingTranslation.textStatus !== nextTranslation.textStatus) {
    patch.textStatus = nextTranslation.textStatus;
  }
  return patch;
}

function getVerseTextPatch(
  existingVerseText: Doc<"bibleVerseTexts">,
  nextVerseText: Omit<Doc<"bibleVerseTexts">, "_creationTime" | "_id">,
) {
  const patch: BibleVerseTextPatch = {};
  if (existingVerseText.text !== nextVerseText.text) {
    patch.text = nextVerseText.text;
  }
  if (existingVerseText.translationId !== nextVerseText.translationId) {
    patch.translationId = nextVerseText.translationId;
  }
  if (existingVerseText.verseId !== nextVerseText.verseId) {
    patch.verseId = nextVerseText.verseId;
  }
  if (existingVerseText.verseOrdinal !== nextVerseText.verseOrdinal) {
    patch.verseOrdinal = nextVerseText.verseOrdinal;
  }
  return patch;
}

function hasPatch(patch: object) {
  return Object.keys(patch).length > 0;
}
