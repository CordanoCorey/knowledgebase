import {
  createAccount,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { DEFAULT_USER_SEEDS } from "./seedOrganizations";

type SeededUserResult = {
  email: string;
  tempPassword: string;
  userId: Id<"users">;
};
type SeedStats = {
  inserted: number;
  skipped: number;
  updated: number;
};
type DomainSeedStats = {
  memberships: SeedStats;
  organizations: SeedStats;
  profiles: SeedStats;
  users: SeedStats;
};
type SeedActionResult = {
  memberships: SeedStats;
  organizations: SeedStats;
  profiles: SeedStats;
  users: SeededUserResult[];
  userRows: SeedStats;
};

export const seedDefaultOrganizations = internalAction({
  args: {},
  returns: v.object({
    memberships: v.object({
      inserted: v.number(),
      skipped: v.number(),
      updated: v.number(),
    }),
    organizations: v.object({
      inserted: v.number(),
      skipped: v.number(),
      updated: v.number(),
    }),
    profiles: v.object({
      inserted: v.number(),
      skipped: v.number(),
      updated: v.number(),
    }),
    users: v.array(
      v.object({
        email: v.string(),
        tempPassword: v.string(),
        userId: v.id("users"),
      }),
    ),
    userRows: v.object({
      inserted: v.number(),
      skipped: v.number(),
      updated: v.number(),
    }),
  }),
  handler: async (ctx): Promise<SeedActionResult> => {
    const users: SeededUserResult[] = [];

    for (const userSeed of DEFAULT_USER_SEEDS) {
      const userId = await upsertPasswordUser(ctx, userSeed);
      users.push({
        email: userSeed.email,
        tempPassword: userSeed.tempPassword,
        userId,
      });
    }

    const domainStats: DomainSeedStats = await ctx.runMutation(
      internal.seedOrganizations.upsertDefaultOrganizationsAndMemberships,
      {
        users: users.map((user) => ({
          email: user.email,
          name:
            DEFAULT_USER_SEEDS.find((seed) => seed.email === user.email)?.name ??
            user.email,
          userId: user.userId,
        })),
      },
    );

    return {
      memberships: domainStats.memberships,
      organizations: domainStats.organizations,
      profiles: domainStats.profiles,
      users,
      userRows: domainStats.users,
    };
  },
});

async function upsertPasswordUser(
  ctx: ActionCtx,
  userSeed: (typeof DEFAULT_USER_SEEDS)[number],
) {
  const existingAccount = await retrieveAccount(ctx, {
    account: { id: userSeed.email },
    provider: "password",
  }).catch(() => null);

  if (existingAccount) {
    await modifyAccountCredentials(ctx, {
      account: {
        id: userSeed.email,
        secret: userSeed.tempPassword,
      },
      provider: "password",
    });
    return existingAccount.user._id;
  }

  const created = await createAccount(ctx, {
    account: {
      id: userSeed.email,
      secret: userSeed.tempPassword,
    },
    profile: {
      email: userSeed.email,
      isActive: true,
      name: userSeed.name,
    },
    provider: "password",
  });

  return created.user._id;
}
