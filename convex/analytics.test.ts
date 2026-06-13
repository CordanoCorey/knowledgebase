/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./analytics.ts": () => import("./analytics"),
};

describe("Analytics MVP backend", () => {
  test("stores raw page visits and updates aggregate target stats", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertActiveUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    const firstVisit = await authed.mutation(api.analytics.recordPageVisit, {
      pageType: "referent",
      rawPath: "/scripture/john-3-16",
      targetKey: "john-3-16",
      targetKind: "biblePassage",
    });
    const secondVisit = await authed.mutation(api.analytics.recordPageVisit, {
      pageType: "referent",
      rawPath: "/scripture/john-3-16",
      targetKey: "john-3-16",
      targetKind: "biblePassage",
    });

    expect(firstVisit.totalVisits).toBe(1);
    expect(secondVisit.totalVisits).toBe(2);

    const summary = await authed.query(api.analytics.getMvpSummary, {
      popularLimit: 5,
      recentLimit: 5,
    });

    expect(summary.popularTargets).toContainEqual(
      expect.objectContaining({
        href: "/scripture/john-3-16",
        label: "John 3:16",
        pageType: "referent",
        targetKey: "john-3-16",
        targetKind: "biblePassage",
        totalVisits: 2,
      }),
    );
    expect(summary.recentPageVisits).toHaveLength(2);
    expect(summary.recentPageVisits.map((visit) => visit.rawPath)).toEqual([
      "/scripture/john-3-16",
      "/scripture/john-3-16",
    ]);
  });

  test("records navigator usage with active target keys and resolved Tag ids", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedNavigatorRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const usage = await authed.mutation(api.analytics.recordNavigatorUsage, {
      activeTagKeys: ["holy-spirit", "romans-8-28"],
      usageKind: "select",
    });

    expect(usage.activeTagCount).toBe(2);
    expect(usage.resolvedTagCount).toBe(1);

    const summary = await authed.query(api.analytics.getMvpSummary, {
      popularLimit: 5,
      recentLimit: 5,
    });

    expect(summary.navigatorUsage).toEqual([
      expect.objectContaining({
        activeTagCount: 2,
        resolvedTagCount: 1,
        usageKind: "select",
      }),
    ]);
  });
});

async function insertActiveUser(ctx: MutationCtx) {
  return await ctx.db.insert("users", {
    email: "analytics@example.com",
    isActive: true,
    name: "Analytics User",
  });
}

async function seedNavigatorRows(ctx: MutationCtx) {
  const userId = await insertActiveUser(ctx);
  const holySpirit = await insertTag(ctx, {
    canonicalKey: "holy-spirit",
    knowledgeType: "topic",
    label: "Holy Spirit",
  });

  return {
    tags: {
      holySpirit: holySpirit.tagId,
    },
    userId,
  };
}

async function insertTag(
  ctx: MutationCtx,
  tag: {
    canonicalKey: string;
    knowledgeType: Doc<"referents">["knowledgeType"];
    label: string;
  },
) {
  const referentId = await ctx.db.insert("referents", {
    knowledgeType: tag.knowledgeType,
    canonicalKey: tag.canonicalKey,
    canonicalName: tag.label,
  });
  const tagId: Id<"tags"> = await ctx.db.insert("tags", {
    referentId,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    lookupKey: tag.canonicalKey,
  });

  return { referentId, tagId };
}
