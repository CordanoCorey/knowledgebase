/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./appAccess.ts": () => import("./appAccess"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./seedOrganizations.ts": () => import("./seedOrganizations"),
  "./seedOrganizationsAction.ts": () => import("./seedOrganizationsAction"),
  "./userNotifications.ts": () => import("./userNotifications"),
};

type SeedActionTestResult = {
  users: Array<{
    email: string;
    tempPassword: string;
    userId: Id<"users">;
  }>;
};

type InboxNotification = {
  id: Id<"userNotifications">;
  kind: "answer" | "event" | "knowledgeSlot" | "subscription";
  receivedAt: number;
  status: "read" | "unread";
  title: string;
};

type InboxResult = {
  notifications: InboxNotification[];
  summary: {
    allCount: number;
    eventCount: number;
    knowledgeSlotCount: number;
    latestReceivedAt?: number;
    unreadCount: number;
  };
};

describe("User Notifications", () => {
  test("lists current-user inbox notifications newest first with summary counts", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    await insertNotification(t, {
      kind: "knowledgeSlot",
      receivedAt: 300,
      status: "unread",
      title: "Requested answer",
      userId,
    });
    await insertNotification(t, {
      kind: "event",
      receivedAt: 500,
      status: "unread",
      title: "Event reminder",
      userId,
    });
    await insertNotification(t, {
      kind: "subscription",
      receivedAt: 100,
      status: "read",
      title: "Subscription update",
      userId,
    });

    const inbox = await authed.query(api.userNotifications.listForInbox, {}) as InboxResult;

    expect(inbox.notifications.map((notification) => notification.title)).toEqual([
      "Event reminder",
      "Requested answer",
      "Subscription update",
    ]);
    expect(inbox.summary).toEqual({
      allCount: 3,
      eventCount: 1,
      knowledgeSlotCount: 1,
      latestReceivedAt: 500,
      unreadCount: 2,
    });
  });

  test("does not return another user's notification rows", async () => {
    const { getAuthedUser, t } = await seedDefaultUsers();
    const firstUser = getAuthedUser("gelbaughcm@gmail.com");
    const secondUser = getAuthedUser("corey@rulerofkingschurch.com");
    await insertNotification(t, {
      kind: "event",
      receivedAt: 100,
      status: "unread",
      title: "First user notice",
      userId: firstUser.userId,
    });
    await insertNotification(t, {
      kind: "event",
      receivedAt: 200,
      status: "unread",
      title: "Second user notice",
      userId: secondUser.userId,
    });

    const firstInbox = await firstUser.authed.query(
      api.userNotifications.listForInbox,
      {},
    ) as InboxResult;
    const secondInbox = await secondUser.authed.query(
      api.userNotifications.listForInbox,
      {},
    ) as InboxResult;

    expect(firstInbox.notifications.map((notification) => notification.title)).toEqual([
      "First user notice",
    ]);
    expect(secondInbox.notifications.map((notification) => notification.title)).toEqual([
      "Second user notice",
    ]);
  });

  test("reports durable unread summary from unread notification rows", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    await insertNotification(t, {
      kind: "event",
      receivedAt: 100,
      status: "read",
      title: "Read event",
      userId,
    });
    await insertNotification(t, {
      kind: "answer",
      receivedAt: 400,
      status: "unread",
      title: "Fresh unread answer",
      userId,
    });
    await insertNotification(t, {
      kind: "knowledgeSlot",
      receivedAt: 200,
      status: "unread",
      title: "Older unread request",
      userId,
    });

    const summary = await authed.query(api.userNotifications.getUnreadSummary, {});

    expect(summary).toEqual({
      latestReceivedAt: 400,
      unreadCount: 2,
    });
  });

  test("marks the current user's notification read and unread", async () => {
    const { authed, t, userId } = await seedAllowedUser();
    const notificationId = await insertNotification(t, {
      kind: "knowledgeSlot",
      receivedAt: 100,
      status: "unread",
      title: "Unread request",
      userId,
    });

    const readNotification = await authed.mutation(
      api.userNotifications.markRead,
      { notificationId },
    );
    expect(readNotification).toMatchObject({
      id: notificationId,
      status: "read",
      title: "Unread request",
    });
    expect(readNotification.readAt).toBeTypeOf("number");

    const readSummary = await authed.query(api.userNotifications.getUnreadSummary, {});
    expect(readSummary).toEqual({ unreadCount: 0 });

    const unreadNotification = await authed.mutation(
      api.userNotifications.markUnread,
      { notificationId },
    );
    expect(unreadNotification).toMatchObject({
      id: notificationId,
      status: "unread",
    });
    expect("readAt" in unreadNotification).toBe(false);
  });

  test("does not let one user mark another user's notification read", async () => {
    const { getAuthedUser, t } = await seedDefaultUsers();
    const firstUser = getAuthedUser("gelbaughcm@gmail.com");
    const secondUser = getAuthedUser("corey@rulerofkingschurch.com");
    const notificationId = await insertNotification(t, {
      kind: "event",
      receivedAt: 100,
      status: "unread",
      title: "Private event",
      userId: secondUser.userId,
    });

    await expect(
      firstUser.authed.mutation(api.userNotifications.markRead, {
        notificationId,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  test("blocks unauthenticated, inactive, and no-organization users from inbox access", async () => {
    const t = convexTest({ schema, modules });
    const activeUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "active@example.com",
        isActive: true,
        name: "Active User",
      }),
    );
    const notificationId = await insertNotification(t, {
      kind: "event",
      receivedAt: 100,
      status: "unread",
      title: "Blocked notice",
      userId: activeUserId,
    });

    await expect(
      t.query(api.userNotifications.listForInbox, {}),
    ).rejects.toThrow("Unauthorized");
    await expect(
      t.mutation(api.userNotifications.markRead, { notificationId }),
    ).rejects.toThrow("Unauthorized");

    const inactiveUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "inactive@example.com",
        isActive: false,
        name: "Inactive User",
      }),
    );
    const inactive = t.withIdentity({ subject: `${inactiveUserId}|test-session` });
    await expect(
      inactive.query(api.userNotifications.listForInbox, {}),
    ).rejects.toThrow("Unauthorized");

    const noOrganizationUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "no-org@example.com",
        isActive: true,
        name: "No Organization User",
      }),
    );
    const noOrganization = t.withIdentity({
      subject: `${noOrganizationUserId}|test-session`,
    });
    await expect(
      noOrganization.query(api.userNotifications.getUnreadSummary, {}),
    ).rejects.toThrow("Unauthorized");
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

async function insertNotification(
  t: ReturnType<typeof convexTest>,
  input: {
    kind: "answer" | "event" | "knowledgeSlot" | "subscription";
    receivedAt: number;
    status: "read" | "unread";
    title: string;
    userId: Id<"users">;
  },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("userNotifications", {
      body: `${input.title} body.`,
      contextHref: "/scripture/matthew-5-9",
      contextLabel: "Matthew 5:9",
      createdAt: now,
      notificationKind: input.kind,
      notificationStatus: input.status,
      receivedAt: input.receivedAt,
      title: input.title,
      updatedAt: now,
      userId: input.userId,
      ...(input.status === "read" ? { readAt: now } : {}),
    });
  });
}
