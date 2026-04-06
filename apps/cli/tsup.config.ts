import { defineConfig } from "tsup";

const shared = {
  format: ["esm"] as const,
  target: "node18" as const,
  outDir: "dist",
  splitting: false,
  sourcemap: true,
  external: ["@lancedb/lancedb", "apache-arrow"],
  noExternal: ["@cachezero/shared"],
};

export default defineConfig([
  {
    ...shared,
    entry: ["src/index.ts"],
    clean: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    ...shared,
    entry: ["src/start-daemon.ts"],
    clean: false,
  },
]);
