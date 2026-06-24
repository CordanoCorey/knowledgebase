import { describe, expect, test } from "vitest";

const backendSurfaceModules: Record<string, () => Promise<unknown>> = {
  "auth.config.ts": () => import("./auth.config"),
  "crons.ts": () => import("./crons"),
  "editor.ts": () => import("./editor"),
  "http.ts": () => import("./http"),
  "seedOrganizationsAction.ts": () => import("./seedOrganizationsAction"),
};

describe("Convex backend surface modules", () => {
  test.each(Object.entries(backendSurfaceModules))(
    "loads %s without import-time failures",
    async (_path, loadModule) => {
      await expect(loadModule()).resolves.toBeTruthy();
    },
  );
});
