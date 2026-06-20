import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";

const contextExpertiseVisibilitySettings = v.object({
  globalExpertVisibilityEnabled: v.boolean(),
});

export const getCurrentUserSettings = query({
  args: {},
  returns: contextExpertiseVisibilitySettings,
  handler: async (ctx) => {
    const access = await requireAppAccess(ctx);
    const settings = await ctx.db
      .query("contextExpertiseVisibilitySettings")
      .withIndex("by_userId", (q) => q.eq("userId", access.userId))
      .unique();

    return {
      globalExpertVisibilityEnabled:
        settings?.globalExpertVisibilityEnabled ?? false,
    };
  },
});

export const updateGlobalExpertVisibility = mutation({
  args: {
    enabled: v.boolean(),
  },
  returns: contextExpertiseVisibilitySettings,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("contextExpertiseVisibilitySettings")
      .withIndex("by_userId", (q) => q.eq("userId", access.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        globalExpertVisibilityEnabled: args.enabled,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("contextExpertiseVisibilitySettings", {
        userId: access.userId,
        globalExpertVisibilityEnabled: args.enabled,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      globalExpertVisibilityEnabled: args.enabled,
    };
  },
});
