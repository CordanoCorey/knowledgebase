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
  test("stores bounded prediction feedback for system admins", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertSystemAdminUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    const result = await authed.mutation(
      api.smartStoragePlayground.recordFeedback,
      getFeedbackInput(),
    );

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

  test("rejects playground feedback from non-system admins", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertActiveUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    await expect(
      authed.mutation(
        api.smartStoragePlayground.recordFeedback,
        getFeedbackInput(),
      ),
    ).rejects.toThrow("Unauthorized");
  });
});

function getFeedbackInput() {
  return {
    feedbackRating: "close" as const,
    feedbackNote: "It should have treated the source as a lesson, not words.",
    intendedKnowledgeType: "lesson" as const,
    predictedEntries: [
      {
        confidence: 0.44,
        knowledgeType: "words" as const,
        reason: "fallback type",
        sourceExcerpt: "Objective: students will compare Joshua 1.",
        title: "Courage Lesson",
      },
    ],
    sourceKind: "pastedText" as const,
    sourceSizeBytes: 48,
    sourceText: "Objective: students will compare Joshua 1.",
    submittedEntry: {
      bodyPreview: "Objective: students will compare Joshua 1.",
      knowledgeType: "lesson" as const,
      title: "Courage Lesson",
    },
  };
}

async function insertActiveUser(
  ctx: MutationCtx,
) {
  return await ctx.db.insert("users", {
    email: "smart-storage@example.com",
    isActive: true,
    name: "Smart Storage User",
  });
}

async function insertSystemAdminUser(ctx: MutationCtx) {
  return await ctx.db.insert("users", {
    email: "smart-storage-admin@example.com",
    isActive: true,
    name: "Smart Storage Admin",
    systemRole: "systemAdmin",
  });
}
