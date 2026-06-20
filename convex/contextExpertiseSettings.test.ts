/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./appAccess.ts": () => import("./appAccess"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./contextExpertiseSettings.ts": () => import("./contextExpertiseSettings"),
};

describe("Context Expertise Settings", () => {
  test("defaults Global Expert Visibility off and persists updates", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(seedSystemAdminUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    await expect(
      authed.query(api.contextExpertiseSettings.getCurrentUserSettings, {}),
    ).resolves.toEqual({
      globalExpertVisibilityEnabled: false,
    });

    await expect(
      authed.mutation(
        api.contextExpertiseSettings.updateGlobalExpertVisibility,
        {
          enabled: true,
        },
      ),
    ).resolves.toEqual({
      globalExpertVisibilityEnabled: true,
    });
    await expect(
      authed.query(api.contextExpertiseSettings.getCurrentUserSettings, {}),
    ).resolves.toEqual({
      globalExpertVisibilityEnabled: true,
    });

    await authed.mutation(
      api.contextExpertiseSettings.updateGlobalExpertVisibility,
      {
        enabled: false,
      },
    );
    await expect(
      authed.query(api.contextExpertiseSettings.getCurrentUserSettings, {}),
    ).resolves.toEqual({
      globalExpertVisibilityEnabled: false,
    });
  });
});

async function seedSystemAdminUser(ctx: MutationCtx): Promise<Id<"users">> {
  return await ctx.db.insert("users", {
    email: "context-expertise-settings@example.com",
    isActive: true,
    name: "Context Expertise Settings",
    systemRole: "systemAdmin",
  });
}
