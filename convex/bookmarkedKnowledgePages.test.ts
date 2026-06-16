/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./appAccess.ts": () => import("./appAccess"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./bookmarkedKnowledgePages.ts": () => import("./bookmarkedKnowledgePages"),
  "./seedOrganizations.ts": () => import("./seedOrganizations"),
  "./seedOrganizationsAction.ts": () => import("./seedOrganizationsAction"),
};

type SeedActionTestResult = {
  users: Array<{
    email: string;
    tempPassword: string;
    userId: Id<"users">;
  }>;
};

type AllowedOrganization = {
  name: string;
  organizationKind: string;
  organizationReferentId: Id<"referents">;
};

type ProfileBookmark = {
  href: string;
  label: string;
  organizationKind: string;
  organizationReferentId: Id<"referents">;
  pageKey: string;
  secondaryLabel: string;
};

describe("Bookmarked Knowledge Pages", () => {
  test("lists an empty profile bookmark set for an allowed user", async () => {
    const { authed } = await seedAllowedUser();

    const bookmarks = await authed.query(
      api.bookmarkedKnowledgePages.listForProfile,
      {},
    ) as ProfileBookmark[];

    expect(bookmarks).toEqual([]);
  });

  test("bookmarks an accessible Organization Knowledge Page for the current user", async () => {
    const { authed } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );

    const bookmark = await authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    ) as ProfileBookmark;

    expect(bookmark).toMatchObject({
      href: `/organizations/${organization.organizationReferentId}`,
      label: "Arche Classical Academy",
      organizationKind: "school",
      organizationReferentId: organization.organizationReferentId,
      pageKey: `organization:${organization.organizationReferentId}`,
      secondaryLabel: "School",
    });

    const bookmarks = await authed.query(
      api.bookmarkedKnowledgePages.listForProfile,
      {},
    ) as ProfileBookmark[];
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0]).toMatchObject({
      label: "Arche Classical Academy",
      pageKey: `organization:${organization.organizationReferentId}`,
    });
  });

  test("re-bookmarking updates the existing bookmark instead of duplicating it", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );

    await authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );
    await authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    const rows = await t.run(async (ctx) =>
      await ctx.db
        .query("bookmarkedKnowledgePages")
        .withIndex("by_userId_and_pageKey", (q) =>
          q
            .eq("userId", userId)
            .eq("pageKey", `organization:${organization.organizationReferentId}`),
        )
        .take(10),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].lastReferencedAt).toEqual(rows[0].updatedAt);
  });

  test("gets and removes the current user's bookmark for a page", async () => {
    const { authed } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );
    const pageKey = `organization:${organization.organizationReferentId}`;

    await authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    const bookmark = await authed.query(
      api.bookmarkedKnowledgePages.getForPage,
      { pageKey },
    ) as ProfileBookmark | null;
    expect(bookmark).toMatchObject({
      label: "Arche Classical Academy",
      pageKey,
    });

    await authed.mutation(api.bookmarkedKnowledgePages.removeBookmark, {
      pageKey,
    });

    const removed = await authed.query(
      api.bookmarkedKnowledgePages.getForPage,
      { pageKey },
    );
    expect(removed).toBeNull();
  });

  test("removing a bookmark only removes the current user's relationship", async () => {
    const { getAuthedUser } = await seedDefaultUsers();
    const firstUser = getAuthedUser("gelbaughcm@gmail.com");
    const secondUser = getAuthedUser("corey@rulerofkingschurch.com");
    const organization = await getAllowedOrganization(
      firstUser.authed,
      "Arche Classical Academy",
    );
    const pageKey = `organization:${organization.organizationReferentId}`;

    await firstUser.authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );
    await secondUser.authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    await firstUser.authed.mutation(
      api.bookmarkedKnowledgePages.removeBookmark,
      { pageKey },
    );

    expect(
      await firstUser.authed.query(api.bookmarkedKnowledgePages.listForProfile, {}),
    ).toEqual([]);
    expect(
      await secondUser.authed.query(api.bookmarkedKnowledgePages.listForProfile, {}),
    ).toMatchObject([{ pageKey }]);
  });

  test("blocks unauthenticated, inactive, and no-organization users from bookmarking Organizations", async () => {
    const t = convexTest({ schema, modules });
    const organizationReferentId = await t.run((ctx) =>
      insertOrganization(ctx, {
        canonicalKey: "outside-school",
        kind: "school",
        name: "Outside School",
      }),
    );

    await expect(
      t.mutation(api.bookmarkedKnowledgePages.bookmarkOrganizationPage, {
        organizationReferentId,
      }),
    ).rejects.toThrow("Unauthorized");

    const inactiveUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "inactive@example.com",
        isActive: false,
        name: "Inactive User",
      }),
    );
    await expect(
      t.withIdentity({ subject: `${inactiveUserId}|test-session` }).mutation(
        api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
        { organizationReferentId },
      ),
    ).rejects.toThrow("Unauthorized");

    const noOrganizationUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "no-org@example.com",
        isActive: true,
        name: "No Organization User",
      }),
    );
    await expect(
      t.withIdentity({ subject: `${noOrganizationUserId}|test-session` }).mutation(
        api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
        { organizationReferentId },
      ),
    ).rejects.toThrow("Unauthorized");
  });

  test("bookmarking an Organization upserts user tag recognition", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );
    const tag = await t.run((ctx) =>
      getOrganizationTag(ctx, organization.organizationReferentId),
    );
    if (!tag) {
      throw new Error("Missing Organization tag.");
    }

    await authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    const firstRecognition = await t.run(async (ctx) =>
      await ctx.db
        .query("tagRecognitions")
        .withIndex("by_userId_and_tagId", (q) =>
          q.eq("userId", userId).eq("tagId", tag._id),
        )
        .unique(),
    );
    expect(firstRecognition).toMatchObject({
      recognizerKind: "user",
      tagId: tag._id,
      userId,
    });

    await authed.mutation(
      api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    const recognitions = await t.run(async (ctx) =>
      await ctx.db
        .query("tagRecognitions")
        .withIndex("by_userId_and_tagId", (q) =>
          q.eq("userId", userId).eq("tagId", tag._id),
        )
        .take(10),
    );
    expect(recognitions).toHaveLength(1);
    expect(recognitions[0]._id).toBe(firstRecognition?._id);
    expect(recognitions[0].lastInteractedAt).toBeGreaterThanOrEqual(
      firstRecognition?.lastInteractedAt ?? 0,
    );
  });
});

async function seedAllowedUser() {
  const seeded = await seedDefaultUsers();
  return {
    ...seeded.getAuthedUser("gelbaughcm@gmail.com"),
    t: seeded.t,
  };
}

async function seedDefaultUsers() {
  const t = convexTest(schema, modules);
  const seed = await t.action(
    internal.seedOrganizationsAction.seedDefaultOrganizations,
    {},
  ) as SeedActionTestResult;

  return {
    getAuthedUser(email: string) {
      const user = getSeededUser(seed.users, email);
      return {
        authed: t.withIdentity({ subject: `${user.userId}|test-session` }),
        userId: user.userId,
      };
    },
    t,
  };
}

function getSeededUser(
  users: Array<{ email: string; userId: Id<"users"> }>,
  email: string,
) {
  const user = users.find((candidate) => candidate.email === email);
  if (!user) {
    throw new Error(`Missing seeded user ${email}.`);
  }
  return user;
}

async function getAllowedOrganization(
  authed: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  label: string,
) {
  const access = await authed.query(api.appAccess.getCurrentUserAccess, {});
  if (access.status !== "allowed") {
    throw new Error("Expected allowed app access.");
  }

  const organization = access.organizations.find(
    (candidate: AllowedOrganization) => candidate.name === label,
  );
  if (!organization) {
    throw new Error(`Missing allowed Organization ${label}.`);
  }

  return organization;
}

async function insertOrganization(
  ctx: MutationCtx,
  input: {
    canonicalKey: string;
    kind: "church" | "community" | "family" | "school";
    name: string;
  },
) {
  const now = Date.now();
  const referentId = await ctx.db.insert("referents", {
    canonicalKey: input.canonicalKey,
    canonicalName: input.name,
    knowledgeType: "organization",
  });
  const tagId = await ctx.db.insert("tags", {
    knowledgeType: "organization",
    label: input.name,
    lookupKey: input.canonicalKey,
    referentId,
  });
  const entryId = await ctx.db.insert("knowledgeEntries", {
    contextPreviewTagLabels: [],
    createdAt: now,
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    humanWeight: 0,
    knowledgeType: "organization",
    previewText: `${input.name} organization.`,
    primaryTagId: tagId,
    primaryTagLabel: input.name,
    representedReferentId: referentId,
    searchText: `${input.name} ${input.kind}`,
    title: input.name,
    updatedAt: now,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("organizationEntries", {
    entryId,
    isActive: true,
    organizationKind: input.kind,
  });

  return referentId;
}

async function getOrganizationTag(
  ctx: MutationCtx,
  organizationReferentId: Id<"referents">,
) {
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_referentId", (q) => q.eq("referentId", organizationReferentId))
    .take(5);

  return tags.find((tag) => tag.knowledgeType === "organization") ?? null;
}
