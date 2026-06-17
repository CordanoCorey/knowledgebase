/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./seedOrganizations.ts": () => import("./seedOrganizations"),
  "./seedOrganizationsAction.ts": () => import("./seedOrganizationsAction"),
};

describe("Convex Auth user emails", () => {
  test("rejects creating a password account when the email belongs to another user", async () => {
    const t = convexTest({ schema, modules });
    const existingUserId = await t.run(insertExistingSeedUser);

    await expect(
      t.action(internal.seedOrganizationsAction.seedDefaultOrganizations, {}),
    ).rejects.toThrow("Email is already in use by another user.");

    const usersWithEmail = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "gelbaughcm@gmail.com"))
        .take(10);
    });

    expect(usersWithEmail.map((user) => user._id)).toEqual([existingUserId]);
  });

  test("rejects patching an auth-linked user to another user's email", async () => {
    const t = convexTest({ schema, modules });
    const { conflictingUserId, passwordUserId } = await t.run(
      insertExistingPasswordAccountWithConflictingUser,
    );

    await expect(
      t.action(internal.seedOrganizationsAction.seedDefaultOrganizations, {}),
    ).rejects.toThrow("Email is already in use by another user.");

    const users = await t.run(async (ctx) => {
      return {
        conflictingUser: await ctx.db.get(conflictingUserId),
        passwordUser: await ctx.db.get(passwordUserId),
      };
    });

    expect(users.conflictingUser?.email).toBe("gelbaughcm@gmail.com");
    expect(users.passwordUser?.email).toBe("old@example.com");
  });
});

async function insertExistingSeedUser(ctx: MutationCtx): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    email: "gelbaughcm@gmail.com",
    isActive: true,
    name: "Existing User",
  });
}

async function insertExistingPasswordAccountWithConflictingUser(
  ctx: MutationCtx,
) {
  const passwordUserId = await ctx.db.insert("users", {
    email: "old@example.com",
    isActive: true,
    name: "Password Account User",
  });
  const conflictingUserId = await ctx.db.insert("users", {
    email: "gelbaughcm@gmail.com",
    isActive: true,
    name: "Conflicting User",
  });

  await ctx.db.insert("authAccounts", {
    provider: "password",
    providerAccountId: "gelbaughcm@gmail.com",
    userId: passwordUserId,
  });

  return { conflictingUserId, passwordUserId };
}
