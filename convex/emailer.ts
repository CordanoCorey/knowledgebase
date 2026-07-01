import {
  Resend,
  type EmailEvent,
  type EmailId,
  type Status,
  vOnEmailEventArgs,
} from "@convex-dev/resend";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

// Resend integration queues outbound email delivery rows and reconciles provider
// webhooks back into Convex-owned status records.
const emailDeliveryKind = v.union(
  v.literal("notification"),
  v.literal("system"),
);

const emailDeliveryId = v.id("emailDeliveries");

export const resend: Resend = new Resend(components.resend, {
  apiKey: process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? "",
  onEmailEvent: internal.emailer.handleEmailEvent,
  testMode: process.env.RESEND_TEST_MODE !== "false",
});

type EmailDeliveryKind = "notification" | "system";
type EnqueueEmailInput = {
  deliveryKind?: EmailDeliveryKind;
  from?: string;
  headers?: Array<{ name: string; value: string }>;
  html?: string;
  notificationId?: Id<"userNotifications">;
  replyTo?: string[];
  sourceKey?: string;
  subject: string;
  text?: string;
  to: string;
  userId?: Id<"users">;
};

export const enqueueEmail = internalMutation({
  args: {
    deliveryKind: v.optional(emailDeliveryKind),
    from: v.optional(v.string()),
    headers: v.optional(
      v.array(
        v.object({
          name: v.string(),
          value: v.string(),
        }),
      ),
    ),
    html: v.optional(v.string()),
    notificationId: v.optional(v.id("userNotifications")),
    replyTo: v.optional(v.array(v.string())),
    sourceKey: v.optional(v.string()),
    subject: v.string(),
    text: v.optional(v.string()),
    to: v.string(),
    userId: v.optional(v.id("users")),
  },
  returns: emailDeliveryId,
  handler: async (ctx, args) => {
    return await enqueueEmailFromMutation(ctx, args);
  },
});

export const enqueueNotificationEmail = internalMutation({
  args: {
    from: v.optional(v.string()),
    notificationId: v.id("userNotifications"),
    sourceKey: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  returns: emailDeliveryId,
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found.");
    }

    const to = args.to ?? await getNotificationRecipientEmail(ctx, notification);

    return await enqueueEmailFromMutation(ctx, {
      deliveryKind: "notification",
      from: args.from,
      html: renderNotificationHtml(notification),
      notificationId: notification._id,
      sourceKey: args.sourceKey ?? `notification-email:${notification._id}`,
      subject: notification.title,
      text: renderNotificationText(notification),
      to,
      userId: notification.userId,
    });
  },
});

export const handleEmailEvent = internalMutation({
  args: vOnEmailEventArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_providerEmailId", (q) => q.eq("providerEmailId", args.id))
      .unique();

    if (!delivery) {
      return null;
    }

    await ctx.db.patch(delivery._id, getEventPatch(args.event));
    return null;
  },
});

async function enqueueEmailFromMutation(
  ctx: MutationCtx,
  input: EnqueueEmailInput,
) {
  if (!input.html && !input.text) {
    throw new Error("Email requires either html or text content.");
  }

  if (input.sourceKey !== undefined) {
    const existingDelivery = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_sourceKey", (q) => q.eq("sourceKey", input.sourceKey))
      .unique();
    if (existingDelivery) {
      return existingDelivery._id;
    }
  }

  const now = Date.now();
  const from = getEmailFrom(input.from);
  const deliveryId = await ctx.db.insert("emailDeliveries", {
    deliveryKind: input.deliveryKind ?? "system",
    from,
    ...(input.notificationId === undefined
      ? {}
      : { notificationId: input.notificationId }),
    ...(input.sourceKey === undefined ? {} : { sourceKey: input.sourceKey }),
    status: "waiting",
    subject: input.subject,
    to: input.to.trim(),
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    createdAt: now,
    updatedAt: now,
  });

  try {
    const providerEmailId = await resend.sendEmail(ctx, {
      from,
      ...(input.headers === undefined ? {} : { headers: input.headers }),
      ...(input.html === undefined ? {} : { html: input.html }),
      ...(input.replyTo === undefined ? {} : { replyTo: input.replyTo }),
      subject: input.subject,
      ...(input.text === undefined ? {} : { text: input.text }),
      to: input.to.trim(),
    });
    await ctx.db.patch(deliveryId, {
      providerEmailId,
      updatedAt: Date.now(),
    });
    return deliveryId;
  } catch (error) {
    await ctx.db.patch(deliveryId, {
      errorMessage: getErrorMessage(error),
      status: "failed",
      updatedAt: Date.now(),
    });
    throw error;
  }
}

async function getNotificationRecipientEmail(
  ctx: MutationCtx,
  notification: Doc<"userNotifications">,
) {
  const user = await ctx.db.get(notification.userId);
  if (!user?.email) {
    throw new Error("Notification recipient does not have an email address.");
  }

  return user.email;
}

function getEmailFrom(explicitFrom: string | undefined) {
  const from = explicitFrom ?? process.env.EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM or AUTH_EMAIL_FROM is required to send email.");
  }

  return from;
}

function renderNotificationText(notification: Doc<"userNotifications">) {
  const href = getEmailHref(notification.contextHref);

  return [
    notification.title,
    "",
    notification.body,
    "",
    `${notification.contextLabel}: ${href}`,
  ].join("\n");
}

function renderNotificationHtml(notification: Doc<"userNotifications">) {
  const href = getEmailHref(notification.contextHref);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<body>",
    `<h1>${escapeHtml(notification.title)}</h1>`,
    `<p>${escapeHtml(notification.body)}</p>`,
    `<p><a href="${escapeHtml(href)}">${escapeHtml(notification.contextLabel)}</a></p>`,
    "</body>",
    "</html>",
  ].join("");
}

function getEmailHref(href: string) {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) {
    return href;
  }

  return new URL(href, siteUrl).toString();
}

function getEventPatch(event: EmailEvent) {
  const eventAt = Date.parse(event.created_at);
  const now = Date.now();
  const status = statusFromEvent(event);

  return {
    ...(status === null ? {} : { status }),
    resendMessageId: event.data.email_id,
    lastEventType: event.type,
    lastEventAt: Number.isNaN(eventAt) ? now : eventAt,
    ...eventSignalPatch(event, Number.isNaN(eventAt) ? now : eventAt),
    ...(errorMessageFromEvent(event) === undefined
      ? {}
      : { errorMessage: errorMessageFromEvent(event) }),
    updatedAt: now,
  };
}

function statusFromEvent(event: EmailEvent): Status | null {
  switch (event.type) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
      return "delivery_delayed";
    case "email.bounced":
      return "bounced";
    case "email.failed":
      return "failed";
    case "email.clicked":
    case "email.complained":
    case "email.opened":
      return null;
  }
}

function eventSignalPatch(event: EmailEvent, eventAt: number) {
  switch (event.type) {
    case "email.clicked":
      return { clickedAt: eventAt };
    case "email.complained":
      return { complainedAt: eventAt };
    case "email.opened":
      return { openedAt: eventAt };
    case "email.bounced":
    case "email.delivered":
    case "email.delivery_delayed":
    case "email.failed":
    case "email.sent":
      return {};
  }
}

function errorMessageFromEvent(event: EmailEvent) {
  switch (event.type) {
    case "email.bounced":
      return event.data.bounce.message;
    case "email.failed":
      return event.data.failed.reason;
    case "email.complained":
      return "Recipient marked the email as spam.";
    case "email.clicked":
    case "email.delivered":
    case "email.delivery_delayed":
    case "email.opened":
    case "email.sent":
      return undefined;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
