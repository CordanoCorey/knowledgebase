// Convex Auth provider discovery points at this deployment's site URL so tokens
// issued by the app can be validated by Convex.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
