/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import literatureSeed from "../data/literature/classical-christian-literature.seed.json";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./seedLiterature.ts": () => import("./seedLiterature"),
};

type LiteratureSeedFile = {
  metadata: {
    countsByKnowledgeType: Record<string, number>;
    workCount: number;
  };
  works: Array<{
    canonicalKey: string;
    detail: {
      approxGradeMax: number | null;
      approxGradeMin: number | null;
      approxWordCountK: number | null;
      author: string | null;
      genres: string[];
      historicalTimeframeEndYear: number | null;
      historicalTimeframeStartYear: number | null;
      lexileMeasure: number | null;
      publisher: string | null;
      settingLocation: string | null;
      yearPublished: string | null;
    };
    knowledgeType: "book" | "poem" | "shortStory" | "song" | "series" | "essay";
    schoolCanonPriority: number | null;
    title: string;
  }>;
};

const seed = literatureSeed as LiteratureSeedFile;

describe("classical Christian literature seed data", () => {
  test("bundles corrected, typed literary works for seeding", () => {
    expect(seed.metadata.workCount).toBe(525);
    expect(seed.works).toHaveLength(525);
    expect(seed.metadata.countsByKnowledgeType).toMatchObject({
      book: 378,
      essay: 9,
      poem: 64,
      series: 7,
      shortStory: 66,
      song: 1,
    });

    expect(getSeedWork("Brambly Hedge")).toMatchObject({
      knowledgeType: "series",
      title: "Brambly Hedge",
    });
    expect(getSeedWork("The High Hills").detail.yearPublished).toBe("1986");
    expect(getSeedWork("Pompeii...Buried Alive!")).toMatchObject({
      detail: {
        author: "Edith Kunhardt",
        publisher: "Random House",
        yearPublished: "1987",
      },
      knowledgeType: "book",
    });
    expect(getSeedWork("The Ink Garden of Brother Theophane")).toMatchObject({
      detail: {
        author: "C. M. Millen",
        yearPublished: "2010",
      },
      knowledgeType: "book",
    });
    expect(getSeedWork("All Things Bright and Beautiful").knowledgeType).toBe(
      "song",
    );
    expect(getSeedWork("Rikki-Tikki-Tavi")).toMatchObject({
      detail: {
        author: "Rudyard Kipling",
        lexileMeasure: 810,
        approxWordCountK: 6,
        settingLocation: "British India / garden bungalow in India",
      },
      knowledgeType: "shortStory",
      schoolCanonPriority: 1,
    });

    for (const work of seed.works) {
      expect(work.detail).toHaveProperty("settingLocation");
      expect(work.detail).not.toHaveProperty("priority");
      expect(work).toHaveProperty("schoolCanonPriority");
    }
  });

  test("seeds idempotent referents and tags without knowledge entries", async () => {
    const t = convexTest({ schema, modules });
    const works = [
      "All Things Bright and Beautiful",
      "Brambly Hedge",
      "On Fairy Stories",
      "Pompeii...Buried Alive!",
      "The Princess and the Pea",
      "The Waste Land",
    ].map((title) => {
      const { schoolCanonPriority: _priority, ...work } = getSeedWork(title);
      return addTestEnrichment(work);
    });

    await expect(
      t.mutation(internal.seedLiterature.upsertLiteraryWorks, { works }),
    ).resolves.toMatchObject({
      authorDetails: { inserted: 6, skipped: 0, updated: 0 },
      authorReferences: { inserted: 6, skipped: 0, updated: 0 },
      authorReferents: { inserted: 6, skipped: 0, updated: 0 },
      authorTags: { inserted: 6, skipped: 0, updated: 0 },
      referents: { inserted: 6, skipped: 0, updated: 0 },
      referentDetails: { inserted: 6, skipped: 0, updated: 0 },
      tags: { inserted: 6, skipped: 0, updated: 0 },
    });

    await expect(
      t.mutation(internal.seedLiterature.upsertLiteraryWorks, { works }),
    ).resolves.toMatchObject({
      authorDetails: { inserted: 0, skipped: 6, updated: 0 },
      authorReferences: { inserted: 0, skipped: 6, updated: 0 },
      authorReferents: { inserted: 0, skipped: 6, updated: 0 },
      authorTags: { inserted: 0, skipped: 6, updated: 0 },
      referents: { inserted: 0, skipped: 6, updated: 0 },
      referentDetails: { inserted: 0, skipped: 6, updated: 0 },
      tags: { inserted: 0, skipped: 6, updated: 0 },
    });

    await expect(
      t.query(internal.seedLiterature.verifyLiteratureSeedBatch, {
        works: works.map((work) => ({
          canonicalKey: work.canonicalKey,
          knowledgeType: work.knowledgeType,
          title: work.title,
        })),
      }),
    ).resolves.toEqual({
      checked: 6,
      missing: [],
      ok: true,
    });

    const seededRows = await t.run(async (ctx) => {
      const work = getSeedWork("Pompeii...Buried Alive!");
      const referent = await ctx.db
        .query("referents")
        .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
          q
            .eq("knowledgeType", work.knowledgeType)
            .eq("canonicalKey", work.canonicalKey),
        )
        .unique();
      if (!referent) {
        throw new Error("Missing seeded Pompeii referent.");
      }
      const tag = await ctx.db
        .query("tags")
        .withIndex("by_knowledgeType_and_lookupKey", (q) =>
          q
            .eq("knowledgeType", work.knowledgeType)
            .eq("lookupKey", work.canonicalKey),
        )
        .unique();
      if (!tag) {
        throw new Error("Missing seeded Pompeii tag.");
      }
      const entries = await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_representedReferentId", (q) =>
          q.eq("representedReferentId", referent._id),
        )
        .take(10);
      const referentDetail = await ctx.db
        .query("literatureReferentDetails")
        .withIndex("by_referentId", (q) => q.eq("referentId", referent._id))
        .unique();
      const authorReferences = await ctx.db
        .query("literatureAuthorReferences")
        .withIndex("by_workReferentId_and_authorOrder", (q) =>
          q.eq("workReferentId", referent._id),
        )
        .take(10);
      const authorReference = authorReferences[0];
      const authorReferent = authorReference
        ? await ctx.db.get(authorReference.personReferentId)
        : null;
      const authorDetail = authorReferent
        ? await ctx.db
            .query("personReferentDetails")
            .withIndex("by_referentId", (q) =>
              q.eq("referentId", authorReferent._id),
            )
            .unique()
        : null;
      const authorTag = authorReferent
        ? await ctx.db
            .query("tags")
            .withIndex("by_knowledgeType_and_lookupKey", (q) =>
              q
                .eq("knowledgeType", "person")
                .eq("lookupKey", authorReferent.canonicalKey),
            )
            .unique()
        : null;
      const details = await ctx.db.query("bookEntries").take(10);
      return {
        authorDetail,
        authorReference,
        authorReferent,
        authorTag,
        details,
        entries,
        referent,
        referentDetail,
        tag,
      };
    });

    expect(seededRows.referent).toMatchObject({
      canonicalKey: "pompeii-buried-alive-edith-kunhardt",
      canonicalName: "Pompeii...Buried Alive!",
      knowledgeType: "book",
    });
    expect(seededRows.tag).toMatchObject({
      knowledgeType: "book",
      label: "Pompeii...Buried Alive!",
      lookupKey: "pompeii-buried-alive-edith-kunhardt",
      referentId: seededRows.referent._id,
    });
    expect(seededRows.referentDetail).toMatchObject({
      approxGradeMax: 4,
      approxGradeMin: 2,
      approxWordCountK: 2,
      author: "Edith Kunhardt",
      genres: ["children's literature", "history", "reference"],
      historicalTimeframeEndYear: 79,
      historicalTimeframeStartYear: 79,
      knowledgeType: "book",
      publisher: "Random House",
      referentId: seededRows.referent._id,
      searchText: expect.stringContaining("Pompeii...Buried Alive!"),
      settingLocation: "Pompeii, Italy",
      description: "A short public description for Pompeii.",
      descriptionSourceName: "Open Library",
      descriptionSourceUrl: "https://openlibrary.org/works/OL123W",
      openLibraryCoverId: "123",
      openLibraryWorkKey: "/works/OL123W",
      subjects: ["Pompeii", "Vesuvius"],
      thumbnailSourceName: "Open Library",
      thumbnailSourceUrl: "https://openlibrary.org/works/OL123W",
      thumbnailUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
      yearPublished: "1987",
    });
    expect(seededRows.authorReferent).toMatchObject({
      canonicalKey: "edith-kunhardt",
      canonicalName: "Edith Kunhardt",
      knowledgeType: "person",
    });
    expect(seededRows.authorTag).toMatchObject({
      knowledgeType: "person",
      label: "Edith Kunhardt",
      lookupKey: "edith-kunhardt",
      referentId: seededRows.authorReferent?._id,
    });
    expect(seededRows.authorDetail).toMatchObject({
      description: "Children's nonfiction author.",
      descriptionSourceName: "Wikipedia",
      descriptionSourceUrl: "https://en.wikipedia.org/wiki/Edith_Kunhardt",
      searchText: expect.stringContaining("Edith Kunhardt"),
      thumbnailSourceName: "Wikipedia",
      thumbnailSourceUrl: "https://en.wikipedia.org/wiki/Edith_Kunhardt",
      thumbnailUrl: "https://upload.wikimedia.org/edith.jpg",
      wikipediaTitle: "Edith Kunhardt",
    });
    expect(seededRows.authorReference).toMatchObject({
      authorName: "Edith Kunhardt",
      authorOrder: 0,
      personReferentId: seededRows.authorReferent?._id,
      role: "author",
      workReferentId: seededRows.referent._id,
    });
    expect(seededRows.referentDetail).not.toHaveProperty("priority");
    expect(seededRows.referentDetail).not.toHaveProperty("schoolCanonPriority");
    expect(seededRows.entries).toEqual([]);
    expect(seededRows.details).toEqual([]);
  });

});

function addTestEnrichment(work: Omit<LiteratureSeedFile["works"][number], "schoolCanonPriority">) {
  if (work.title !== "Pompeii...Buried Alive!") {
    return work;
  }

  return {
    ...work,
    authorReferences: [
      {
        canonicalKey: "edith-kunhardt",
        detail: {
          description: "Children's nonfiction author.",
          descriptionSourceName: "Wikipedia",
          descriptionSourceUrl: "https://en.wikipedia.org/wiki/Edith_Kunhardt",
          thumbnailSourceName: "Wikipedia",
          thumbnailSourceUrl: "https://en.wikipedia.org/wiki/Edith_Kunhardt",
          thumbnailUrl: "https://upload.wikimedia.org/edith.jpg",
          wikipediaTitle: "Edith Kunhardt",
        },
        name: "Edith Kunhardt",
        role: "author" as const,
      },
    ],
    detail: {
      ...work.detail,
      description: "A short public description for Pompeii.",
      descriptionSourceName: "Open Library",
      descriptionSourceUrl: "https://openlibrary.org/works/OL123W",
      openLibraryCoverId: "123",
      openLibraryWorkKey: "/works/OL123W",
      subjects: ["Pompeii", "Vesuvius"],
      thumbnailSourceName: "Open Library",
      thumbnailSourceUrl: "https://openlibrary.org/works/OL123W",
      thumbnailUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
    },
  };
}

function getSeedWork(title: string) {
  const work = seed.works.find((candidate) => candidate.title === title);
  if (!work) {
    throw new Error(`Missing literature seed work ${title}.`);
  }
  return work;
}
