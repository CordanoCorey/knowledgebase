import { defineApp } from "convex/server";
import prosemirrorSync from "@convex-dev/prosemirror-sync/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";

// Convex component registration is centralized here so generated component
// references stay predictable.
const app = defineApp();
app.use(prosemirrorSync);
app.use(resend);

export default app;
