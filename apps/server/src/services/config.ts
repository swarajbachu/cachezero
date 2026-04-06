import { readFileSync, existsSync } from "node:fs";
import { DEFAULT_CONFIG_PATH, ConfigSchema, type Config } from "@cachezero/shared";

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  if (existsSync(DEFAULT_CONFIG_PATH)) {
    const raw = readFileSync(DEFAULT_CONFIG_PATH, "utf-8");
    cachedConfig = ConfigSchema.parse(JSON.parse(raw));
  } else {
    cachedConfig = ConfigSchema.parse({});
  }

  return cachedConfig;
}
