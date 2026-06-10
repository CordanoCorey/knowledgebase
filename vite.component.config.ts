import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/static-editor.tsx",
      formats: ["es"],
      fileName: () => "collaborative-editor.js",
    },
    outDir: "docs/component",
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: "collaborative-editor.[ext]",
      },
    },
  },
});
