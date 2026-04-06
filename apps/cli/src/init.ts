import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const BASE_DIR = join(homedir(), ".cachezero");
const VAULT_DIR = join(BASE_DIR, "vault");
const INDEX_DIR = join(BASE_DIR, "index");
const CONFIG_PATH = join(BASE_DIR, "config.json");

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
    // Check both bundled location (dist/) and dev location (src/)
    const templatePath = [
      join(__dirname, "..", "templates", "schema.md"),
      join(__dirname, "templates", "schema.md"),
    ].find((p) => existsSync(p)) ?? "";
    if (existsSync(templatePath)) {
      const template = readFileSync(templatePath, "utf-8");
      writeFileSync(schemaPath, template);
    } else {
      // Fallback if template not found (e.g. running via tsx directly)
      writeFileSync(schemaPath, "# CacheZero Knowledge Base Schema\n\nSee https://github.com/cachezero for documentation.\n");
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
      JSON.stringify({
        alwaysUpdateLinks: true,
        useMarkdownLinks: false,
      }, null, 2)
    );
    console.log("  Created .obsidian/ config");
  }

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
  console.log("  1. Start the server:  cachezero start  (or: pnpm --filter @cachezero/server dev)");
  console.log("  2. Open in Obsidian:  ~/.cachezero/vault/");
  console.log("  3. Install the Chrome extension from apps/extension/.output/chrome-mv3/");
  console.log("  4. Start bookmarking!\n");
}
