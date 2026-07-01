/// <reference types="vite/client" />

import { register as registerResend } from "@convex-dev/resend/test";
import type { EmailId } from "@convex-dev/resend";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./emailer.ts": () => import("./emailer"),
};

describe("Emailer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("enqueues a durable system email and records the Resend component email id", async () => {
    stubEmailEnv();
    const t = convexTest({ schema, modules });
    registerResend(t);

    const deliveryId = await t.mutation(internal.emailer.enqueueEmail, {
      sourceKey: "system:test-email",
      subject: "Test notice",
      text: "The body",
      to: "delivered@resend.dev",
    });

    const delivery = await t.run((ctx) => ctx.db.get(deliveryId));
    expect(delivery).toMatchObject({
      deliveryKind: "system",
      from: "Logeion <notifications@example.com>",
      sourceKey: "system:test-email",
      status: "waiting",
      subject: "Test notice",
      to: "delivered@resend.dev",
    });
    expect(delivery?.providerEmailId).toBeTypeOf("string");
  });

  test("uses source keys to keep enqueue retries idempotent", async () => {
    stubEmailEnv();
    const t = convexTest({ schema, modules });
    registerResend(t);

    const firstDeliveryId = await t.mutation(internal.emailer.enqueueEmail, {
      sourceKey: "system:idempotent-email",
      subject: "Test notice",
      text: "The body",
      to: "delivered@resend.dev",
    });
    const secondDeliveryId = await t.mutation(internal.emailer.enqueueEmail, {
      sourceKey: "system:idempotent-email",
      subject: "Test notice",
      text: "The body",
      to: "delivered@resend.dev",
    });

    expect(secondDeliveryId).toBe(firstDeliveryId);
    const deliveries = await t.run((ctx) =>
      ctx.db.query("emailDeliveries").take(10),
    );
    expect(deliveries).toHaveLength(1);
  });

  test("enqueues notification email from the notification row and recipient user", async () => {
    stubEmailEnv();
    const t = convexTest({ schema, modules });
    registerResend(t);
    const { notificationId, userId } = await seedNotification(t);

    const deliveryId = await t.mutation(
      internal.emailer.enqueueNotificationEmail,
      { notificationId },
    );

    const delivery = await t.run((ctx) => ctx.db.get(deliveryId));
    expect(delivery).toMatchObject({
      deliveryKind: "notification",
      notificationId,
      sourceKey: `notification-email:${notificationId}`,
      status: "waiting",
      subject: "Identity review needed",
      to: "delivered+recipient@resend.dev",
      userId,
    });
  });

  test("records webhook status events against the app delivery row", async () => {
    stubEmailEnv();
    const t = convexTest({ schema, modules });
    registerResend(t);
    const deliveryId = await t.mutation(internal.emailer.enqueueEmail, {
      sourceKey: "system:webhook-status",
      subject: "Test notice",
      text: "The body",
      to: "delivered@resend.dev",
    });
    const delivery = await t.run((ctx) => ctx.db.get(deliveryId));
    const providerEmailId = delivery?.providerEmailId;
    if (!providerEmailId) {
      throw new Error("Missing provider email id.");
    }

    await t.mutation(internal.emailer.handleEmailEvent, {
      id: providerEmailId as EmailId,
      event: {
        type: "email.delivered",
        created_at: "2026-06-24T12:00:00.000Z",
        data: emailEventData("resend-message-1"),
      },
    });

    const updatedDelivery = await t.run((ctx) => ctx.db.get(deliveryId));
    expect(updatedDelivery).toMatchObject({
      lastEventType: "email.delivered",
      resendMessageId: "resend-message-1",
      status: "delivered",
    });
    expect(updatedDelivery?.lastEventAt).toBe(
      Date.parse("2026-06-24T12:00:00.000Z"),
    );
  });
});

function stubEmailEnv() {
  vi.stubEnv("AUTH_EMAIL_FROM", "Logeion <notifications@example.com>");
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
}

async function seedNotification(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "delivered+recipient@resend.dev",
      isActive: true,
      name: "Recipient",
    });
    const now = Date.now();
    const notificationId = await ctx.db.insert("userNotifications", {
      body: "A user claimed an email address.",
      contextHref: "/organizations/logeion/settings",
      contextLabel: "Logeion",
      createdAt: now,
      notificationKind: "access",
      notificationStatus: "unread",
      receivedAt: now,
      sourceKind: "system",
      title: "Identity review needed",
      updatedAt: now,
      userId,
    });

    return { notificationId, userId };
  });
}

function emailEventData(resendMessageId: string) {
  return {
    created_at: "2026-06-24T12:00:00.000Z",
    email_id: resendMessageId,
    from: "Logeion <notifications@example.com>",
    subject: "Test notice",
    to: "delivered@resend.dev",
  };
}
