import { readdir, readFile, writeFile, mkdir, unlink, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
  DEFAULT_VAULT_DIR,
  VAULT_DIRS,
  VAULT_FILES,
  parseMarkdown,
  serializeMarkdown,
  extractTitle,
  type ParsedMarkdown,
  type RawFrontmatter,
} from "@cachezero/shared";
import { getConfig } from "./config.js";

export function vaultDir(): string {
  return getConfig().vault_dir?.replace("~", process.env["HOME"] ?? "") ?? DEFAULT_VAULT_DIR;
}

/** Ensure the vault directory structure exists */
export async function ensureVault(): Promise<void> {
  const base = vaultDir();
  for (const dir of Object.values(VAULT_DIRS)) {
    const path = join(base, dir);
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true });
    }
  }
}

/** Get counts of files in each vault subdirectory */
export async function getVaultStats() {
  const base = vaultDir();
  await ensureVault();

  const count = async (dir: string) => {
    const path = join(base, dir);
    if (!existsSync(path)) return 0;
    const files = await readdir(path);
    return files.filter((f) => f.endsWith(".md")).length;
  };

  return {
    path: base,
    rawCount: await count(VAULT_DIRS.raw),
    wikiCount: await count(VAULT_DIRS.wiki),
    outputCount: await count(VAULT_DIRS.outputs),
  };
}

/** Write a markdown file to the vault */
export async function writeVaultFile(
  subdir: string,
  filename: string,
  frontmatter: object,
  content: string
): Promise<string> {
  const base = vaultDir();
  const dir = join(base, subdir);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const filePath = join(dir, filename);
  const md = serializeMarkdown(frontmatter, content);
  await writeFile(filePath, md, "utf-8");
  return filePath;
}

/** Read and parse a markdown file from the vault */
export async function readVaultFile<T = Record<string, unknown>>(
  relativePath: string
): Promise<ParsedMarkdown<T> | null> {
  const base = vaultDir();
  const filePath = join(base, relativePath);
  if (!existsSync(filePath)) return null;
  const raw = await readFile(filePath, "utf-8");
  return parseMarkdown<T>(raw, relativePath);
}

/** List all markdown files in a vault subdirectory */
export async function listVaultFiles(subdir: string): Promise<string[]> {
  const base = vaultDir();
  const dir = join(base, subdir);
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith(".md")).map((f) => join(subdir, f));
}

/** Delete a file from the vault */
export async function deleteVaultFile(relativePath: string): Promise<boolean> {
  const base = vaultDir();
  const filePath = join(base, relativePath);
  if (!existsSync(filePath)) return false;
  await unlink(filePath);
  return true;
}

/** Append an entry to the vault log */
export async function appendLog(verb: string, title: string, details?: string): Promise<void> {
  const base = vaultDir();
  const logPath = join(base, VAULT_FILES.log);
  const date = new Date().toISOString().split("T")[0];
  let entry = `\n## [${date}] ${verb} | ${title}\n`;
  if (details) entry += `${details}\n`;
  await appendFile(logPath, entry, "utf-8");
}

/** Read all raw bookmark files with their frontmatter */
export async function listRawBookmarks(): Promise<ParsedMarkdown<RawFrontmatter>[]> {
  const files = await listVaultFiles(VAULT_DIRS.raw);
  const results: ParsedMarkdown<RawFrontmatter>[] = [];
  for (const f of files) {
    const parsed = await readVaultFile<RawFrontmatter>(f);
    if (parsed) results.push(parsed);
  }
  return results;
}
