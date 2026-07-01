import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  envDir: "..",
  plugins: [solid()],
  server: {
    host: "0.0.0.0",
  },
});
