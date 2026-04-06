import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE_DIR = join(homedir(), ".cachezero");
const VAULT_DIR = join(BASE_DIR, "vault");

export async function runCompile() {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found. Run `cachezero init` first.");
    process.exit(1);
  }

  // Check claude CLI is available
  try {
    execSync("which claude", { stdio: "ignore" });
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

  // Build the prompt
  const schema = existsSync(join(VAULT_DIR, "SCHEMA.md"))
    ? readFileSync(join(VAULT_DIR, "SCHEMA.md"), "utf-8")
    : "";

  const existingIndex = existsSync(join(VAULT_DIR, "wiki", "INDEX.md"))
    ? readFileSync(join(VAULT_DIR, "wiki", "INDEX.md"), "utf-8")
    : "";

  // List existing wiki files so Claude knows what already exists
  const wikiDir = join(VAULT_DIR, "wiki");
  const existingWiki = existsSync(wikiDir)
    ? readdirSync(wikiDir).filter((f) => f.endsWith(".md") && f !== "INDEX.md")
    : [];

  const prompt = `You are a knowledge base compiler. Your job is to read raw sources and compile/update a wiki.

IMPORTANT RULES:
- Read the SCHEMA.md below for conventions
- Read ALL files in raw/ directory
- Create or update wiki pages in wiki/ directory
- Every wiki page must have YAML frontmatter with type: wiki, topics, sources, compiled fields
- Use [[wikilinks]] to link between pages (Obsidian-compatible)
- Update wiki/INDEX.md with every page and a one-line description
- Append a compile entry to log.md
- Do NOT modify any files in raw/ — they are immutable sources

SCHEMA:
${schema}

CURRENT WIKI INDEX:
${existingIndex}

EXISTING WIKI PAGES: ${existingWiki.length > 0 ? existingWiki.join(", ") : "none yet"}

RAW SOURCES TO PROCESS: ${rawFiles.join(", ")}

Now read each raw source file, extract key topics and entities, and create/update wiki pages. Start by reading the raw files, then write the wiki.`;

  // Run claude in the vault directory
  try {
    execSync(`claude --print "${prompt.replace(/"/g, '\\"')}"`, {
      cwd: VAULT_DIR,
      stdio: "inherit",
      timeout: 300000, // 5 min timeout
    });
  } catch {
    // claude --print might not work, try interactive mode with -p
    try {
      execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
        cwd: VAULT_DIR,
        stdio: "inherit",
        timeout: 300000,
      });
    } catch (err) {
      console.error("\nCompilation failed. You can also compile manually:");
      console.error("  cd ~/.cachezero/vault && claude");
      console.error('  Then say: "Read SCHEMA.md and compile the wiki from raw sources"');
      process.exit(1);
    }
  }

  console.log("\nWiki compilation complete.");

  // Trigger reindex
  console.log("Reindexing...");
  try {
    const res = await fetch("http://localhost:3777/api/reindex", { method: "POST" });
    if (res.ok) {
      const data = await res.json() as { indexed?: number };
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

  try {
    execSync("which claude", { stdio: "ignore" });
  } catch {
    console.error("Claude Code CLI not found.");
    process.exit(1);
  }

  const prompt = `You are a knowledge base assistant. Answer the following question using ONLY information from this vault.

1. First read wiki/INDEX.md to find relevant pages
2. Read the relevant wiki and raw source files
3. Synthesize an answer with citations to specific files
${opts.save ? `4. Save your answer as a new .md file in outputs/ with frontmatter:
---
type: output
query: "${question}"
generated: ${new Date().toISOString()}
sources_used: [list files you referenced]
---` : ""}

QUESTION: ${question}`;

  try {
    execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
      cwd: VAULT_DIR,
      stdio: "inherit",
      timeout: 300000,
    });
  } catch {
    console.error("\nFailed. Try manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error(`  Then ask: "${question}"`);
  }
}

export async function runHealth() {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found. Run `cachezero init` first.");
    process.exit(1);
  }

  try {
    execSync("which claude", { stdio: "ignore" });
  } catch {
    console.error("Claude Code CLI not found.");
    process.exit(1);
  }

  const date = new Date().toISOString().split("T")[0];

  const prompt = `You are a knowledge base health checker. Review this vault for issues.

1. Read wiki/INDEX.md and all wiki pages
2. Check for:
   - Contradictions between pages
   - Stale claims that newer sources have superseded
   - Orphan pages with no inbound links
   - Important concepts mentioned but lacking their own page
   - Missing cross-references between related topics
   - Claims not backed by a source in raw/
3. Suggest new pages, connections, and sources to find
4. Save your report to outputs/health-check-${date}.md with frontmatter:
---
type: output
query: "Wiki health check"
generated: ${new Date().toISOString()}
sources_used: [list all files you reviewed]
---

Be thorough but concise.`;

  try {
    execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
      cwd: VAULT_DIR,
      stdio: "inherit",
      timeout: 300000,
    });
  } catch {
    console.error("\nFailed. Try manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error('  Then say: "Review the wiki for issues and save a health report"');
  }
}
