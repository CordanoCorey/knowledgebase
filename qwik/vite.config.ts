import { defineConfig } from "vite";
import { qwikVite } from "@qwik.dev/core/optimizer";

export default defineConfig({
  plugins: [qwikVite()],
  server: {
    host: "0.0.0.0",
  },
});
