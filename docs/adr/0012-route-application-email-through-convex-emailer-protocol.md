# Route Application Email Through The Convex Emailer Protocol

Application email delivery will go through `convex/emailer.ts`, backed by the
official Convex Resend component. Product workflows must write durable domain
state first, then enqueue email through internal Convex functions. Email success
or failure is delivery state, not the source of truth for notifications,
memberships, subscriptions, invitations, or other product relationships.

Protocol for future email implementations:

- Public mutations create or update product state first, such as a
  `userNotifications` row, pending membership, or reminder source record.
- Email is enqueued only through `internal.emailer.enqueueEmail` or
  `internal.emailer.enqueueNotificationEmail`. Prefer `ctx.scheduler.runAfter(0,
  internal.emailer..., args)` when email does not need to block the user-facing
  mutation result.
- Every repeatable product event must pass a stable, namespaced `sourceKey`, for
  example `notification-email:${notificationId}` or
  `membership-reminder:${membershipId}`. Reusing a `sourceKey` returns the
  existing `emailDeliveries` row instead of enqueueing a duplicate.
- The app-owned `emailDeliveries` table is the durable audit surface for product
  code. It stores recipient, subject, source linkage, Convex Resend component
  email id, Resend message id, status, event timestamps, and error details.
- The Convex Resend component owns provider queueing, batching, retries, rate
  limits, and provider idempotency. Product code should not read or write the
  component's internal tables directly.
- Resend webhooks POST to `/resend-webhook`; the emailer forwards them to the
  component and updates `emailDeliveries` from `internal.emailer.handleEmailEvent`.
- Notification email rendering belongs behind the emailer boundary. Templates,
  HTML generation, and provider-specific parameters can evolve there without
  changing notification generation code.
- Email links must be absolute when possible. `SITE_URL` is used to expand
  app-relative notification context paths for email bodies.

Implementation boundaries:

- Do not call Resend directly from product modules or add ad hoc email `fetch`
  actions.
- Do not expose public send-email functions unless a separate product workflow
  explicitly requires it and still preserves the internal enqueue boundary.
- Do not make product state depend on provider delivery. A failed email may
  update `emailDeliveries`, but it should not remove or invalidate the
  notification, membership, subscription, or source event that asked for it.
- Keep delivery preferences, digesting, muting, and channel fanout as separate
  product decisions layered above this protocol.
