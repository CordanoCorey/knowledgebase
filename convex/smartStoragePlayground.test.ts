/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./smartStoragePlayground.ts": () => import("./smartStoragePlayground"),
};

describe("Smart Storage playground feedback", () => {
  test("stores bounded prediction feedback for the authenticated user", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertActiveUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    const result = await authed.mutation(api.smartStoragePlayground.recordFeedback, {
      feedbackRating: "close",
      feedbackNote: "It should have treated the source as a lesson, not words.",
      intendedKnowledgeType: "lesson",
      predictedEntries: [
        {
          confidence: 0.44,
          knowledgeType: "words",
          reason: "fallback type",
          sourceExcerpt: "Objective: students will compare Joshua 1.",
          title: "Courage Lesson",
        },
      ],
      sourceKind: "pastedText",
      sourceSizeBytes: 48,
      sourceText: "Objective: students will compare Joshua 1.",
      submittedEntry: {
        bodyPreview: "Objective: students will compare Joshua 1.",
        knowledgeType: "lesson",
        title: "Courage Lesson",
      },
    });

    expect(result.predictionCount).toBe(1);

    const rows = await t.run(async (ctx) =>
      await ctx.db.query("smartStoragePlaygroundFeedback").collect(),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        feedbackRating: "close",
        intendedKnowledgeType: "lesson",
        sourceKind: "pastedText",
        sourceText: "Objective: students will compare Joshua 1.",
        userId,
      }),
    ]);
  });
});

async function insertActiveUser(ctx: MutationCtx) {
  return await ctx.db.insert("users", {
    email: "smart-storage@example.com",
    isActive: true,
    name: "Smart Storage User",
  });
}
