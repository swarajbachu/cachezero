import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const BASE_DIR = join(homedir(), ".cachezero");
const VAULT_DIR = join(BASE_DIR, "vault");
const INDEX_DIR = join(BASE_DIR, "index");
const CONFIG_PATH = join(BASE_DIR, "config.json");
const EXTENSION_DIR = join(BASE_DIR, "extension");

const DIRS = [
  join(VAULT_DIR, "raw"),
  join(VAULT_DIR, "wiki"),
  join(VAULT_DIR, "outputs"),
  join(VAULT_DIR, "images"),
  INDEX_DIR,
];

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function installExtension(): boolean {
  if (existsSync(join(EXTENSION_DIR, "manifest.json"))) {
    console.log("  Chrome extension already installed.");
    return true;
  }

  // Find bundled extension (shipped with the npm package)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const bundledExt = [
    join(__dirname, "..", "extension"),
    join(__dirname, "extension"),
  ].find((p) => existsSync(join(p, "manifest.json")));

  if (!bundledExt) {
    console.warn("  Chrome extension not found in package. Skipping.");
    return false;
  }

  mkdirSync(EXTENSION_DIR, { recursive: true });
  cpSync(bundledExt, EXTENSION_DIR, { recursive: true });
  console.log("  Chrome extension installed to ~/.cachezero/extension/");
  return true;
}

export async function runInit() {
  console.log("\nCacheZero — AI-Powered Second Brain\n");

  // Create directories
  for (const dir of DIRS) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`  Created ${dir.replace(homedir(), "~")}`);
    }
  }

  // Write SCHEMA.md
  const schemaPath = join(VAULT_DIR, "SCHEMA.md");
  if (!existsSync(schemaPath)) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const templatePath = [
      join(__dirname, "..", "templates", "schema.md"),
      join(__dirname, "templates", "schema.md"),
    ].find((p) => existsSync(p)) ?? "";
    if (existsSync(templatePath)) {
      const template = readFileSync(templatePath, "utf-8");
      writeFileSync(schemaPath, template);
    } else {
      writeFileSync(schemaPath, "# CacheZero Knowledge Base Schema\n\nSee https://github.com/swarajbachu/cachezero for documentation.\n");
    }
    console.log("  Created SCHEMA.md");
  }

  // Write log.md
  const logPath = join(VAULT_DIR, "log.md");
  if (!existsSync(logPath)) {
    const date = new Date().toISOString().split("T")[0];
    writeFileSync(logPath, `# CacheZero Log\n\n## [${date}] init | Knowledge base created\n`);
    console.log("  Created log.md");
  }

  // Write wiki/INDEX.md
  const indexPath = join(VAULT_DIR, "wiki", "INDEX.md");
  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, "# Knowledge Base Index\n\n*No wiki pages yet. Add bookmarks and compile to get started.*\n");
    console.log("  Created wiki/INDEX.md");
  }

  // Minimal .obsidian config
  const obsidianDir = join(VAULT_DIR, ".obsidian");
  if (!existsSync(obsidianDir)) {
    mkdirSync(obsidianDir, { recursive: true });
    writeFileSync(
      join(obsidianDir, "app.json"),
      JSON.stringify({ alwaysUpdateLinks: true, useMarkdownLinks: false }, null, 2)
    );
    console.log("  Created .obsidian/ config");
  }

  // Install Chrome extension
  installExtension();

  // Config file
  if (!existsSync(CONFIG_PATH)) {
    console.log("\nTo enable vector search, you need a free Gemini API key.");
    console.log("Get one at: https://aistudio.google.com/apikey\n");

    const key = await ask("Gemini API key (or press Enter to skip): ");

    const config: Record<string, unknown> = {
      server_port: 3777,
      vault_dir: "~/.cachezero/vault",
      index_dir: "~/.cachezero/index",
    };
    if (key) config["gemini_api_key"] = key;

    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
    console.log(`  Saved config to ${CONFIG_PATH.replace(homedir(), "~")}`);
  } else {
    console.log(`  Config already exists at ${CONFIG_PATH.replace(homedir(), "~")}`);
  }

  console.log("\nDone! Next steps:");
  console.log("  1. Start the server:  npx cachezero start");
  console.log("  2. Open in Obsidian:  ~/.cachezero/vault/");
  console.log("  3. Load Chrome extension:");
  console.log("     → Open chrome://extensions");
  console.log("     → Enable Developer Mode");
  console.log(`     → Click "Load unpacked" → select ~/.cachezero/extension/`);
  console.log("  4. Start bookmarking!\n");
}
