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
  "./knowledgeSubscriptions.ts": () => import("./knowledgeSubscriptions"),
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

type NotificationSubscriptionSource = {
  href: string;
  label: string;
  organizationKind: string;
  organizationReferentId: Id<"referents">;
  secondaryLabel: string;
  subscriptionKey: string;
  targetKind: "organization";
};

describe("Knowledge Subscriptions", () => {
  test("lists an empty notification subscription source set for an allowed user", async () => {
    const { authed } = await seedAllowedUser();

    const subscriptions = await authed.query(
      api.knowledgeSubscriptions.listForNotifications,
      {},
    ) as NotificationSubscriptionSource[];

    expect(subscriptions).toEqual([]);
  });

  test("subscribes to an accessible Organization Knowledge Page for the current user", async () => {
    const { authed } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );

    const subscription = await authed.mutation(
      api.knowledgeSubscriptions.subscribeOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    ) as NotificationSubscriptionSource;

    expect(subscription).toMatchObject({
      href: `/organizations/${organization.organizationReferentId}`,
      label: "Arche Classical Academy",
      organizationKind: "school",
      organizationReferentId: organization.organizationReferentId,
      secondaryLabel: "School",
      subscriptionKey: `organization:${organization.organizationReferentId}`,
      targetKind: "organization",
    });

    const subscriptions = await authed.query(
      api.knowledgeSubscriptions.listForNotifications,
      {},
    ) as NotificationSubscriptionSource[];
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({
      label: "Arche Classical Academy",
      subscriptionKey: `organization:${organization.organizationReferentId}`,
    });
  });

  test("re-subscribing updates the existing subscription instead of duplicating it", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );

    await authed.mutation(
      api.knowledgeSubscriptions.subscribeOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );
    await authed.mutation(
      api.knowledgeSubscriptions.subscribeOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    const rows = await t.run(async (ctx) =>
      await ctx.db
        .query("knowledgeSubscriptions")
        .withIndex("by_userId_and_subscriptionKey", (q) =>
          q
            .eq("userId", userId)
            .eq("subscriptionKey", `organization:${organization.organizationReferentId}`),
        )
        .take(10),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].updatedAt).toBeGreaterThanOrEqual(rows[0].createdAt);
  });

  test("gets and unsubscribes the current user's subscription for a target", async () => {
    const { authed } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );
    const subscriptionKey = `organization:${organization.organizationReferentId}`;

    await authed.mutation(
      api.knowledgeSubscriptions.subscribeOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    const subscription = await authed.query(
      api.knowledgeSubscriptions.getForTarget,
      { subscriptionKey },
    ) as NotificationSubscriptionSource | null;
    expect(subscription).toMatchObject({
      label: "Arche Classical Academy",
      subscriptionKey,
    });

    await authed.mutation(api.knowledgeSubscriptions.unsubscribe, {
      subscriptionKey,
    });

    const removed = await authed.query(
      api.knowledgeSubscriptions.getForTarget,
      { subscriptionKey },
    );
    expect(removed).toBeNull();
  });

  test("unsubscribing only removes the current user's subscription", async () => {
    const { getAuthedUser } = await seedDefaultUsers();
    const firstUser = getAuthedUser("gelbaughcm@gmail.com");
    const secondUser = getAuthedUser("corey@rulerofkingschurch.com");
    const organization = await getAllowedOrganization(
      firstUser.authed,
      "Arche Classical Academy",
    );
    const subscriptionKey = `organization:${organization.organizationReferentId}`;

    await firstUser.authed.mutation(
      api.knowledgeSubscriptions.subscribeOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );
    await secondUser.authed.mutation(
      api.knowledgeSubscriptions.subscribeOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    await firstUser.authed.mutation(api.knowledgeSubscriptions.unsubscribe, {
      subscriptionKey,
    });

    expect(
      await firstUser.authed.query(
        api.knowledgeSubscriptions.listForNotifications,
        {},
      ),
    ).toEqual([]);
    expect(
      await secondUser.authed.query(
        api.knowledgeSubscriptions.listForNotifications,
        {},
      ),
    ).toMatchObject([{ subscriptionKey }]);
  });

  test("subscribing and unsubscribing do not create or remove pins or bookmarks", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    const organization = await getAllowedOrganization(
      authed,
      "Arche Classical Academy",
    );
    const subscriptionKey = `organization:${organization.organizationReferentId}`;
    async function getRelationshipCounts() {
      return await t.run(async (ctx) => {
        const pins = await ctx.db
          .query("pinnedKnowledgePages")
          .withIndex("by_userId_and_pageKey", (q) =>
            q.eq("userId", userId).eq("pageKey", subscriptionKey),
          )
          .take(10);
        const bookmarks = await ctx.db
          .query("bookmarkedKnowledgePages")
          .withIndex("by_userId_and_pageKey", (q) =>
            q.eq("userId", userId).eq("pageKey", subscriptionKey),
          )
          .take(10);

        return { bookmarks: bookmarks.length, pins: pins.length };
      });
    }

    await authed.mutation(
      api.knowledgeSubscriptions.subscribeOrganizationPage,
      {
        organizationReferentId: organization.organizationReferentId,
      },
    );

    const relationshipCountsAfterSubscribe = await getRelationshipCounts();
    expect(relationshipCountsAfterSubscribe).toEqual({ bookmarks: 0, pins: 0 });

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("pinnedKnowledgePages", {
        createdAt: now,
        hrefSnapshot: `/organizations/${organization.organizationReferentId}`,
        labelSnapshot: organization.name,
        organizationKind: "school",
        organizationReferentId: organization.organizationReferentId,
        pageKey: subscriptionKey,
        pageKind: "organization",
        pinSource: "manual",
        pinState: "pinned",
        sortOrder: 0,
        updatedAt: now,
        userId,
      });
      await ctx.db.insert("bookmarkedKnowledgePages", {
        createdAt: now,
        hrefSnapshot: `/organizations/${organization.organizationReferentId}`,
        labelSnapshot: organization.name,
        lastReferencedAt: now,
        organizationReferentId: organization.organizationReferentId,
        pageKey: subscriptionKey,
        pageKind: "organization",
        secondaryLabelSnapshot: "School",
        targetReferentId: organization.organizationReferentId,
        updatedAt: now,
        userId,
      });
    });

    await authed.mutation(api.knowledgeSubscriptions.unsubscribe, {
      subscriptionKey,
    });

    const relationshipCountsAfterUnsubscribe = await getRelationshipCounts();
    expect(relationshipCountsAfterUnsubscribe).toEqual({ bookmarks: 1, pins: 1 });
  });

  test("blocks unauthenticated, inactive, and no-organization users from subscribing to Organizations", async () => {
    const t = convexTest({ schema, modules });
    const organizationReferentId = await t.run((ctx) =>
      insertOrganization(ctx, {
        canonicalKey: "outside-school",
        kind: "school",
        name: "Outside School",
      }),
    );

    await expect(
      t.mutation(api.knowledgeSubscriptions.subscribeOrganizationPage, {
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
        api.knowledgeSubscriptions.subscribeOrganizationPage,
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
        api.knowledgeSubscriptions.subscribeOrganizationPage,
        { organizationReferentId },
      ),
    ).rejects.toThrow("Unauthorized");
  });

  test("subscribing an Organization upserts user tag recognition", async () => {
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
      api.knowledgeSubscriptions.subscribeOrganizationPage,
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
      api.knowledgeSubscriptions.subscribeOrganizationPage,
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
  const t = convexTest({ schema, modules });
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
