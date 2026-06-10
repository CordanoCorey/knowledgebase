import { v } from "convex/values";
import { query } from "./_generated/server";
import { hasGoogleAuth, hasPasswordAuth, hasResendAuth } from "./authProviderConfig";

export const get = query({
  args: {},
  returns: v.object({
    google: v.boolean(),
    password: v.boolean(),
    resend: v.boolean(),
  }),
  handler: async () => ({
    google: hasGoogleAuth(),
    password: hasPasswordAuth(),
    resend: hasResendAuth(),
  }),
});
