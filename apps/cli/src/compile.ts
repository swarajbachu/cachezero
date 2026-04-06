import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE_DIR = join(homedir(), ".cachezero");
const VAULT_DIR = join(BASE_DIR, "vault");

/** Run claude CLI with a prompt, piped via a temp file to avoid shell escaping issues */
function runClaude(prompt: string): boolean {
  // Write prompt to a temp file, then pass it via --prompt-file or pipe
  const tmpPrompt = join(BASE_DIR, ".tmp-prompt.txt");
  writeFileSync(tmpPrompt, prompt, "utf-8");

  // Use spawn with the prompt as an argument array (no shell interpolation)
  // --allowedTools lets Claude write files without interactive approval
  const result = spawnSync("claude", [
    "-p", prompt,
    "--allowedTools", "Edit,Write,Read,Glob,Grep,Bash(cat *),Bash(ls *)",
  ], {
    cwd: VAULT_DIR,
    stdio: "inherit",
    timeout: 600000, // 10 min
    maxBuffer: 50 * 1024 * 1024,
  });

  // Clean up
  try { require("node:fs").unlinkSync(tmpPrompt); } catch {}

  if (result.error) {
    console.error(`Claude error: ${result.error.message}`);
    return false;
  }

  return result.status === 0;
}

export async function runCompile() {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found. Run `cachezero init` first.");
    process.exit(1);
  }

  try {
    spawnSync("which", ["claude"], { stdio: "ignore" });
  } catch {
    console.error("Claude Code CLI not found. Install it from: https://claude.ai/claude-code");
    process.exit(1);
  }

  const rawDir = join(VAULT_DIR, "raw");
  if (!existsSync(rawDir)) {
    console.error("No raw/ directory found. Bookmark some content first.");
    process.exit(1);
  }

  const rawFiles = readdirSync(rawDir).filter((f) => f.endsWith(".md"));
  if (rawFiles.length === 0) {
    console.error("No raw sources found. Bookmark some content first.");
    process.exit(1);
  }

  console.log(`Found ${rawFiles.length} raw source(s). Compiling wiki...\n`);

  const existingWikiDir = join(VAULT_DIR, "wiki");
  const existingWiki = existsSync(existingWikiDir)
    ? readdirSync(existingWikiDir).filter((f) => f.endsWith(".md") && f !== "INDEX.md")
    : [];

  const prompt = [
    "You are a knowledge base compiler working in this directory.",
    "",
    "Your task: read all files in raw/ and compile them into wiki articles in wiki/.",
    "",
    "Steps:",
    "1. Read SCHEMA.md for conventions",
    "2. Read every .md file in raw/",
    "3. For each key topic or entity, create or update a wiki page in wiki/",
    "4. Each wiki page needs YAML frontmatter (type: wiki, topics, sources, compiled)",
    "5. Use Obsidian wikilinks like [[page-name]] to link between pages",
    "6. Update wiki/INDEX.md with every page listed with a one-line description",
    "7. Append a compile entry to log.md",
    "8. Do NOT modify anything in raw/ - those are immutable sources",
    "",
    `There are ${rawFiles.length} raw files: ${rawFiles.join(", ")}`,
    existingWiki.length > 0 ? `Existing wiki pages: ${existingWiki.join(", ")}` : "No wiki pages exist yet.",
    "",
    "Start by reading the raw files, then create the wiki pages.",
  ].join("\n");

  const ok = runClaude(prompt);

  if (!ok) {
    console.error("\nCompilation failed. You can compile manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error('  Then say: "Read SCHEMA.md and compile the wiki from raw sources"');
    process.exit(1);
  }

  console.log("\nWiki compilation complete.");

  // Trigger reindex
  console.log("Reindexing...");
  try {
    const res = await fetch("http://localhost:3777/api/reindex", { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { indexed?: number };
      console.log(`Indexed ${data.indexed ?? 0} documents.`);
    }
  } catch {
    console.log("Server not running — skip reindex. Run `cachezero reindex` later.");
  }
}

export async function runAsk(question: string, opts: { save?: boolean }) {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found. Run `cachezero init` first.");
    process.exit(1);
  }

  const saveInstruction = opts.save
    ? "Save your answer as a new .md file in outputs/ with YAML frontmatter (type: output, query, generated, sources_used)."
    : "Just print the answer, do not save to a file.";

  const prompt = [
    "You are a knowledge base assistant. Answer this question using ONLY information from this vault.",
    "",
    "1. Read wiki/INDEX.md to find relevant pages",
    "2. Read the relevant wiki and raw source files",
    "3. Synthesize an answer with citations to specific files",
    saveInstruction,
    "",
    `Question: ${question}`,
  ].join("\n");

  const ok = runClaude(prompt);
  if (!ok) {
    console.error("\nFailed. Try manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error(`  Then ask your question.`);
  }
}

export async function runHealth() {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found. Run `cachezero init` first.");
    process.exit(1);
  }

  const date = new Date().toISOString().split("T")[0];

  const prompt = [
    "You are a knowledge base health checker. Review this vault for issues.",
    "",
    "1. Read wiki/INDEX.md and all wiki pages",
    "2. Check for: contradictions, stale claims, orphan pages, missing cross-references, unsourced claims",
    "3. Suggest new pages, connections, and sources to find",
    `4. Save your report to outputs/health-check-${date}.md with YAML frontmatter (type: output, query: wiki health check, generated, sources_used)`,
    "",
    "Be thorough but concise.",
  ].join("\n");

  const ok = runClaude(prompt);
  if (!ok) {
    console.error("\nFailed. Try manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error('  Then say: "Review the wiki for issues and save a health report"');
  }
}
