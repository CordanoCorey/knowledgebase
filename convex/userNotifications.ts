import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";

const DEFAULT_INBOX_LIMIT = 50;
const MAX_INBOX_LIMIT = 100;

const notificationKind = v.union(
  v.literal("answer"),
  v.literal("event"),
  v.literal("knowledgeSlot"),
  v.literal("subscription"),
);

const notificationStatus = v.union(
  v.literal("read"),
  v.literal("unread"),
);

const inboxNotification = v.object({
  body: v.string(),
  contextHref: v.string(),
  contextLabel: v.string(),
  id: v.id("userNotifications"),
  kind: notificationKind,
  readAt: v.optional(v.number()),
  receivedAt: v.number(),
  status: notificationStatus,
  title: v.string(),
});

const inboxSummary = v.object({
  allCount: v.number(),
  eventCount: v.number(),
  knowledgeSlotCount: v.number(),
  latestReceivedAt: v.optional(v.number()),
  unreadCount: v.number(),
});

const inboxResult = v.object({
  notifications: v.array(inboxNotification),
  summary: inboxSummary,
});

const unreadSummary = v.object({
  latestReceivedAt: v.optional(v.number()),
  unreadCount: v.number(),
});

type UserNotificationRecord = Doc<"userNotifications">;
type InboxNotification = {
  body: string;
  contextHref: string;
  contextLabel: string;
  id: Id<"userNotifications">;
  kind: UserNotificationRecord["notificationKind"];
  readAt?: number;
  receivedAt: number;
  status: UserNotificationRecord["notificationStatus"];
  title: string;
};
type InboxSummary = {
  allCount: number;
  eventCount: number;
  knowledgeSlotCount: number;
  latestReceivedAt?: number;
  unreadCount: number;
};

export const listForInbox = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: inboxResult,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const notifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_userId_and_receivedAt", (q) =>
        q.eq("userId", access.userId),
      )
      .order("desc")
      .take(getInboxLimit(args.limit));
    const inboxNotifications = notifications.map(toInboxNotification);

    return {
      notifications: inboxNotifications,
      summary: getInboxSummary(inboxNotifications),
    };
  },
});

export const getUnreadSummary = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: unreadSummary,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const unreadNotifications = await ctx.db
      .query("userNotifications")
      .withIndex("by_userId_and_notificationStatus_and_receivedAt", (q) =>
        q.eq("userId", access.userId).eq("notificationStatus", "unread"),
      )
      .order("desc")
      .take(getInboxLimit(args.limit));

    return {
      ...(unreadNotifications[0]
        ? { latestReceivedAt: unreadNotifications[0].receivedAt }
        : {}),
      unreadCount: unreadNotifications.length,
    };
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id("userNotifications"),
  },
  returns: inboxNotification,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const notification = await getOwnedNotification(
      ctx,
      args.notificationId,
      access.userId,
    );

    if (notification.notificationStatus !== "read") {
      const now = Date.now();
      await ctx.db.patch(notification._id, {
        notificationStatus: "read",
        readAt: now,
        updatedAt: now,
      });
    }

    return toInboxNotification(
      (await ctx.db.get(notification._id)) ?? notification,
    );
  },
});

export const markUnread = mutation({
  args: {
    notificationId: v.id("userNotifications"),
  },
  returns: inboxNotification,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const notification = await getOwnedNotification(
      ctx,
      args.notificationId,
      access.userId,
    );

    if (notification.notificationStatus === "unread") {
      return toInboxNotification(notification);
    }

    const now = Date.now();
    const { _creationTime, _id, readAt, ...replacement } = notification;
    await ctx.db.replace(notification._id, {
      ...replacement,
      notificationStatus: "unread",
      updatedAt: now,
    });

    return toInboxNotification(
      (await ctx.db.get(notification._id)) ?? {
        ...notification,
        notificationStatus: "unread",
        updatedAt: now,
      },
    );
  },
});

async function getOwnedNotification(
  ctx: QueryCtx | MutationCtx,
  notificationId: Id<"userNotifications">,
  userId: Id<"users">,
) {
  const notification = await ctx.db.get(notificationId);
  if (!notification || notification.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return notification;
}

function toInboxNotification(
  notification: UserNotificationRecord,
): InboxNotification {
  return {
    body: notification.body,
    contextHref: notification.contextHref,
    contextLabel: notification.contextLabel,
    id: notification._id,
    kind: notification.notificationKind,
    ...(notification.readAt === undefined ? {} : { readAt: notification.readAt }),
    receivedAt: notification.receivedAt,
    status: notification.notificationStatus,
    title: notification.title,
  };
}

function getInboxSummary(notifications: InboxNotification[]): InboxSummary {
  return {
    allCount: notifications.length,
    eventCount: notifications.filter((notification) => notification.kind === "event").length,
    knowledgeSlotCount: notifications.filter(
      (notification) => notification.kind === "knowledgeSlot",
    ).length,
    ...(notifications[0]
      ? { latestReceivedAt: notifications[0].receivedAt }
      : {}),
    unreadCount: notifications.filter(
      (notification) => notification.status === "unread",
    ).length,
  };
}

function getInboxLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_INBOX_LIMIT;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_INBOX_LIMIT);
}
