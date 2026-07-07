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

  test("seeds idempotent entries with bibliography detail rows", async () => {
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
      return work;
    });

    await expect(
      t.mutation(internal.seedLiterature.upsertLiteraryWorks, { works }),
    ).resolves.toMatchObject({
      details: { inserted: 6, skipped: 0, updated: 0 },
      entries: { inserted: 6, skipped: 0, updated: 0 },
      entryTags: { inserted: 6, skipped: 0, updated: 0 },
      referents: { inserted: 6, skipped: 0, updated: 0 },
      tags: { inserted: 6, skipped: 0, updated: 0 },
    });

    await expect(
      t.mutation(internal.seedLiterature.upsertLiteraryWorks, { works }),
    ).resolves.toMatchObject({
      details: { inserted: 0, skipped: 6, updated: 0 },
      entries: { inserted: 0, skipped: 6, updated: 0 },
      entryTags: { inserted: 0, skipped: 6, updated: 0 },
      referents: { inserted: 0, skipped: 6, updated: 0 },
      tags: { inserted: 0, skipped: 6, updated: 0 },
    });

    await expect(
      t.query(internal.seedLiterature.verifyLiteratureSeedBatch, {
        works: works.map((work) => ({
          canonicalKey: work.canonicalKey,
          knowledgeType: work.knowledgeType,
        })),
      }),
    ).resolves.toEqual({
      checked: 6,
      missing: [],
      ok: true,
    });

    const details = await t.run(async (ctx) => {
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
      const entries = await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_representedReferentId", (q) =>
          q.eq("representedReferentId", referent._id),
        )
        .take(10);
      const entry = entries.find((candidate) => candidate.knowledgeType === "book");
      if (!entry) {
        throw new Error("Missing seeded Pompeii entry.");
      }
      const detail = await ctx.db
        .query("bookEntries")
        .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
        .unique();
      return { detail, entry };
    });

    expect(details.entry.title).toBe("Pompeii...Buried Alive!");
    expect(details.detail).toMatchObject({
      approxGradeMax: 4,
      approxGradeMin: 2,
      approxWordCountK: 2,
      author: "Edith Kunhardt",
      genres: ["children's literature", "history", "reference"],
      historicalTimeframeEndYear: 79,
      historicalTimeframeStartYear: 79,
      publisher: "Random House",
      settingLocation: "Pompeii, Italy",
      yearPublished: "1987",
    });
    expect(details.detail).not.toHaveProperty("priority");
    expect(details.detail).not.toHaveProperty("schoolCanonPriority");
  });
});

function getSeedWork(title: string) {
  const work = seed.works.find((candidate) => candidate.title === title);
  if (!work) {
    throw new Error(`Missing literature seed work ${title}.`);
  }
  return work;
}
