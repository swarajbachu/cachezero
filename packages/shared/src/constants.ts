import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_PORT = 3777;
export const DEFAULT_BASE_DIR = join(homedir(), ".cachezero");
export const DEFAULT_VAULT_DIR = join(DEFAULT_BASE_DIR, "vault");
export const DEFAULT_INDEX_DIR = join(DEFAULT_BASE_DIR, "index");
export const DEFAULT_CONFIG_PATH = join(DEFAULT_BASE_DIR, "config.json");

export const VAULT_DIRS = {
  raw: "raw",
  wiki: "wiki",
  outputs: "outputs",
  images: "images",
} as const;

export const VAULT_FILES = {
  schema: "SCHEMA.md",
  log: "log.md",
  wikiIndex: "wiki/INDEX.md",
} as const;

export const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIMENSIONS = 768;

export const API_BASE = "/api";
