# Welcome to your Convex functions directory!

Write your Convex functions here.
See https://docs.convex.dev/functions for more.

A query function that takes two arguments looks like:

```ts
// convex/myFunctions.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query("tablename").collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  },
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.myFunctions.myQueryFunction, {
  first: 10,
  second: "hello",
});
```

A mutation function looks like:

```ts
// convex/myFunctions.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert("messages", message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get("messages", id);
  },
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.myFunctions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: "Hello!", second: "me" });
  // OR
  // use the result once the mutation has completed
  mutation({ first: "Hello!", second: "me" }).then((result) =>
    console.log(result),
  );
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.

## Emailer

Application email is routed through `convex/emailer.ts`, which wraps the
official Convex Resend component. Use internal functions only; public functions
should first write durable product state, then enqueue email from an internal
mutation or scheduled internal mutation.

The protocol is recorded in
`docs/adr/0012-route-application-email-through-convex-emailer-protocol.md`.

```ts
import { internal } from "./_generated/api";

await ctx.runMutation(internal.emailer.enqueueEmail, {
  sourceKey: "membership-reminder:123",
  subject: "Membership reminder",
  text: "Please finish setting up your Logeion account.",
  to: "person@example.com",
});

await ctx.runMutation(internal.emailer.enqueueNotificationEmail, {
  notificationId,
});
```

Pass a stable `sourceKey` for idempotency. Reusing the same key returns the
existing `emailDeliveries` row instead of enqueueing a duplicate. Notification
emails read the `userNotifications` row, use the recipient user's email, and
render a simple text and HTML message.

Required deployment env:

```bash
npx convex env set SITE_URL https://your-app.example.com
npx convex env set RESEND_API_KEY your-resend-api-key
npx convex env set EMAIL_FROM "Logeion <notifications@your-domain.com>"
```

`RESEND_TEST_MODE` defaults to safe test mode. Set
`npx convex env set RESEND_TEST_MODE false` for production delivery, and
configure Resend's webhook to POST to `/resend-webhook` with
`RESEND_WEBHOOK_SECRET` set for delivery status updates.
