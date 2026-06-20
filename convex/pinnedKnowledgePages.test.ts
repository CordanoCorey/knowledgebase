/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { OrganizationMembershipRole } from "./lib/organizationRoles";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./appAccess.ts": () => import("./appAccess"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./pinnedKnowledgePages.ts": () => import("./pinnedKnowledgePages"),
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

type SidebarPin = {
  href: string;
  label: string;
  organizationKind: string;
  organizationReferentId: Id<"referents">;
  pageKey: string;
  pinSource: "defaultSeed" | "manual";
  secondaryLabel: string;
  sortOrder: number;
};

describe("Pinned Knowledge Pages", () => {
  test("lists default Organization pins from active memberships", async () => {
    const { authed } = await seedAllowedUser();

    const pins = await authed.query(
      api.pinnedKnowledgePages.listForSidebar,
      {},
    ) as SidebarPin[];

    expect(pins).toHaveLength(4);
    expect(
      pins.map((pin) => ({
        kind: pin.organizationKind,
        label: pin.label,
        secondaryLabel: pin.secondaryLabel,
      })),
    ).toEqual(expect.arrayContaining([
      {
        kind: "school",
        label: "Arche Classical Academy",
        secondaryLabel: "School",
      },
      {
        kind: "church",
        label: "Ruler of Kings Church",
        secondaryLabel: "Church",
      },
      {
        kind: "family",
        label: "My Family",
        secondaryLabel: "Family",
      },
      {
        kind: "community",
        label: "My Community",
        secondaryLabel: "Community",
      },
    ]));
    expect(pins.every((pin) => pin.pinSource === "defaultSeed")).toBe(true);
  });

  test("caps default seeds to one Organization per kind and keeps manual pins", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    const secondSchool = await t.run((ctx) =>
      insertOrganizationForUser(ctx, {
        canonicalKey: "second-school",
        kind: "school",
        name: "Second School",
        role: "member",
        userId,
      }),
    );

    const defaultPins = await authed.query(
      api.pinnedKnowledgePages.listForSidebar,
      {},
    ) as SidebarPin[];
    expect(defaultPins.filter((pin) => pin.organizationKind === "school")).toHaveLength(1);
    expect(defaultPins.map((pin) => pin.label)).not.toContain("Second School");

    await authed.mutation(api.pinnedKnowledgePages.pinOrganizationPage, {
      organizationReferentId: secondSchool.organizationReferentId,
    });

    const pinsWithManualSchool = await authed.query(
      api.pinnedKnowledgePages.listForSidebar,
      {},
    ) as SidebarPin[];
    expect(
      pinsWithManualSchool
        .filter((pin) => pin.organizationKind === "school")
        .map((pin) => ({
          label: pin.label,
          pinSource: pin.pinSource,
        })),
    ).toEqual([
      { label: "Arche Classical Academy", pinSource: "defaultSeed" },
      { label: "Second School", pinSource: "manual" },
    ]);
  });

  test("lists every default Organization pin for system admins", async () => {
    const { authed, t } = await seedAllowedUser("gelbaughcm@gmail.com");
    await t.run((ctx) =>
      insertOrganization(ctx, {
        canonicalKey: "second-school",
        kind: "school",
        name: "Second School",
      }),
    );

    const pins = await authed.query(
      api.pinnedKnowledgePages.listForSidebar,
      {},
    ) as SidebarPin[];

    expect(
      pins
        .filter((pin) => pin.organizationKind === "school")
        .map((pin) => pin.label),
    ).toEqual(["Arche Classical Academy", "Second School"]);
  });

  test("suppresses a default Organization pin and restores it when pinned again", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    const initialPins = await authed.query(
      api.pinnedKnowledgePages.listForSidebar,
      {},
    ) as SidebarPin[];
    const archePin = getPin(initialPins, "Arche Classical Academy");

    await authed.mutation(api.pinnedKnowledgePages.unpinKnowledgePage, {
      pageKey: archePin.pageKey,
    });

    const suppressedPins = await authed.query(
      api.pinnedKnowledgePages.listForSidebar,
      {},
    ) as SidebarPin[];
    expect(suppressedPins.map((pin) => pin.label)).not.toContain(
      "Arche Classical Academy",
    );
    const suppressedRecord = await t.run(async (ctx) =>
      await ctx.db
        .query("pinnedKnowledgePages")
        .withIndex("by_userId_and_pageKey", (q) =>
          q.eq("userId", userId).eq("pageKey", archePin.pageKey),
        )
        .unique(),
    );
    expect(suppressedRecord).toMatchObject({
      pinSource: "defaultSeed",
      pinState: "suppressed",
    });

    await authed.mutation(api.pinnedKnowledgePages.pinOrganizationPage, {
      organizationReferentId: archePin.organizationReferentId,
    });

    const restoredPins = await authed.query(
      api.pinnedKnowledgePages.listForSidebar,
      {},
    ) as SidebarPin[];
    expect(restoredPins.map((pin) => pin.label)).toContain(
      "Arche Classical Academy",
    );
    const restoredRecord = await t.run(async (ctx) =>
      await ctx.db
        .query("pinnedKnowledgePages")
        .withIndex("by_userId_and_pageKey", (q) =>
          q.eq("userId", userId).eq("pageKey", archePin.pageKey),
        )
        .unique(),
    );
    expect(restoredRecord).toMatchObject({
      pinSource: "manual",
      pinState: "pinned",
    });
  });

  test("blocks unauthenticated, inactive, and no-organization users from mutating pins", async () => {
    const t = convexTest({ schema, modules });
    const organizationReferentId = await t.run((ctx) =>
      insertOrganization(ctx, {
        canonicalKey: "outside-school",
        kind: "school",
        name: "Outside School",
      }),
    );

    await expect(
      t.mutation(api.pinnedKnowledgePages.pinOrganizationPage, {
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
        api.pinnedKnowledgePages.pinOrganizationPage,
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
        api.pinnedKnowledgePages.pinOrganizationPage,
        { organizationReferentId },
      ),
    ).rejects.toThrow("Unauthorized");
  });
});

async function seedAllowedUser(email = "corey@rulerofkingschurch.com") {
  const t = convexTest({ schema, modules });
  const seed = await t.action(
    internal.seedOrganizationsAction.seedDefaultOrganizations,
    {},
  ) as SeedActionTestResult;
  const user = getSeededUser(seed.users, email);

  return {
    authed: t.withIdentity({ subject: `${user.userId}|test-session` }),
    t,
    userId: user.userId,
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

function getPin(pins: SidebarPin[], label: string) {
  const pin = pins.find((candidate) => candidate.label === label);
  if (!pin) {
    throw new Error(`Missing pin ${label}.`);
  }
  return pin;
}

async function insertOrganizationForUser(
  ctx: MutationCtx,
  input: {
    canonicalKey: string;
    kind: "church" | "community" | "family" | "school";
    name: string;
    role: OrganizationMembershipRole;
    userId: Id<"users">;
  },
) {
  const organizationReferentId = await insertOrganization(ctx, input);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", input.userId))
    .unique();
  if (!profile) {
    throw new Error("Missing user profile.");
  }
  const now = Date.now();

  await ctx.db.insert("memberships", {
    createdAt: now,
    memberRole: input.role,
    memberUserId: input.userId,
    membershipStatus: "active",
    organizationReferentId,
    personReferentId: profile.personReferentId,
    targetKind: "organization",
    updatedAt: now,
  });

  return { organizationReferentId };
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
