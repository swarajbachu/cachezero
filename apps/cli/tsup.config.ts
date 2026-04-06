import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: true,
    splitting: false,
    sourcemap: true,
    external: ["@lancedb/lancedb", "apache-arrow"],
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: ["src/start-daemon.ts"],
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    clean: false,
    splitting: false,
    sourcemap: true,
    external: ["@lancedb/lancedb", "apache-arrow"],
  },
]);
