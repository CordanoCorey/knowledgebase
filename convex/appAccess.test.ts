/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DEFAULT_USER_SEEDS } from "./seedOrganizations";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./appAccess.ts": () => import("./appAccess"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./seedOrganizations.ts": () => import("./seedOrganizations"),
  "./seedOrganizationsAction.ts": () => import("./seedOrganizationsAction"),
};

type SeedStats = {
  inserted: number;
  skipped: number;
  updated: number;
};
type SeedActionTestResult = {
  memberships: SeedStats;
  organizations: SeedStats;
  profiles: SeedStats;
  userRows: SeedStats;
  users: Array<{
    email: string;
    tempPassword: string;
    userId: Id<"users">;
  }>;
};
type SeedVerificationResult = {
  organizations: Array<{
    canonicalKey: string;
    exists: boolean;
    isActive: boolean | null;
    kind: string | null;
    name: string | null;
  }>;
  users: Array<{
    activeMemberships: Array<{
      organizationReferentId: Id<"referents"> | null;
      role: string | null;
    }>;
    email: string;
    exists: boolean;
    isActive: boolean | null;
  }>;
};
type AppAccessTestState =
  | { status: "unauthenticated" }
  | {
      email?: string;
      status: "inactiveUser" | "needsOrganization";
      userId: Id<"users">;
    }
  | {
      email?: string;
      organizations: Array<{
        name: string;
        organizationKind: string;
        role: string;
      }>;
      status: "allowed";
      userId: Id<"users">;
    };

describe("App organization access", () => {
  test("seeds default organizations, temporary password users, and memberships", async () => {
    const t = convexTest({ schema, modules });

    const result = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;

    expect(result.users.map((user) => user.email)).toEqual(
      DEFAULT_USER_SEEDS.map((user) => user.email),
    );
    expect(result.users.map((user) => user.tempPassword)).toEqual(
      DEFAULT_USER_SEEDS.map((user) => user.tempPassword),
    );
    expect(result.organizations).toEqual({
      inserted: 2,
      skipped: 0,
      updated: 0,
    });
    expect(result.memberships).toEqual({
      inserted: 6,
      skipped: 0,
      updated: 0,
    });
    expect(result.profiles).toEqual({
      inserted: 3,
      skipped: 0,
      updated: 0,
    });

    const secondResult = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    expect(secondResult.organizations).toEqual({
      inserted: 0,
      skipped: 2,
      updated: 0,
    });
    expect(secondResult.memberships).toEqual({
      inserted: 0,
      skipped: 6,
      updated: 0,
    });
    expect(secondResult.profiles).toEqual({
      inserted: 0,
      skipped: 3,
      updated: 0,
    });
    expect(secondResult.userRows).toEqual({
      inserted: 0,
      skipped: 3,
      updated: 0,
    });

    const verification = (await t.query(
      internal.seedOrganizations.verifyDefaultOrganizationsSeed,
      {},
    )) as SeedVerificationResult;
    expect(verification.organizations).toEqual([
      {
        canonicalKey: "arche-classical-academy",
        exists: true,
        isActive: true,
        kind: "school",
        name: "Arche Classical Academy",
      },
      {
        canonicalKey: "ruler-of-kings-church",
        exists: true,
        isActive: true,
        kind: "church",
        name: "Ruler of Kings Church",
      },
    ]);
    expect(
      verification.users.map((user) => ({
        email: user.email,
        exists: user.exists,
        isActive: user.isActive,
        membershipCount: user.activeMemberships.length,
      })),
    ).toEqual([
      {
        email: "gelbaughcm@gmail.com",
        exists: true,
        isActive: true,
        membershipCount: 2,
      },
      {
        email: "corey@rulerofkingschurch.com",
        exists: true,
        isActive: true,
        membershipCount: 2,
      },
      {
        email: "corey@archeclassicalacademy.com",
        exists: true,
        isActive: true,
        membershipCount: 2,
      },
    ]);
  });

  test("allows an active seeded user with an active organization membership", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");

    const access = (await t
      .withIdentity({ subject: `${gelbaugh.userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;

    expect(access.status).toBe("allowed");
    if (access.status !== "allowed") {
      throw new Error("Expected seeded user to have app access.");
    }
    expect(access.email).toBe("gelbaughcm@gmail.com");
    expect(
      access.organizations.map((organization) => ({
        kind: organization.organizationKind,
        name: organization.name,
        role: organization.role,
      })),
    ).toEqual([
      {
        kind: "school",
        name: "Arche Classical Academy",
        role: "admin",
      },
      {
        kind: "church",
        name: "Ruler of Kings Church",
        role: "admin",
      },
    ]);
  });

  test("blocks active users without active organization membership", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "outside@example.com",
        isActive: true,
        name: "outside@example.com",
      });
    });

    const access = (await t
      .withIdentity({ subject: `${userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;

    expect(access).toEqual({
      email: "outside@example.com",
      status: "needsOrganization",
      userId,
    });
  });

  test("blocks inactive users and memberships to inactive organizations", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");

    await t.run(async (ctx) => {
      await ctx.db.patch(gelbaugh.userId, { isActive: false });
    });

    const inactiveUserAccess = (await t
      .withIdentity({ subject: `${gelbaugh.userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(inactiveUserAccess.status).toBe("inactiveUser");

    await t.run(async (ctx) => {
      await ctx.db.patch(gelbaugh.userId, { isActive: true });
      const organizationEntries = await ctx.db
        .query("organizationEntries")
        .take(10);
      for (const organizationEntry of organizationEntries) {
        await ctx.db.patch(organizationEntry._id, { isActive: false });
      }
    });

    const inactiveOrganizationAccess = (await t
      .withIdentity({ subject: `${gelbaugh.userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(inactiveOrganizationAccess.status).toBe("needsOrganization");
  });
});

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
