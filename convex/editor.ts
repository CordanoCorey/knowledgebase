import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

async function requireAuthorizedAccess(ctx: QueryCtx | MutationCtx) {
  await requireAppAccess(ctx);
}

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi<DataModel>({
  checkRead: requireAuthorizedAccess,
  checkWrite: requireAuthorizedAccess,
});
