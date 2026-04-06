import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE_DIR = join(homedir(), ".cachezero");
const VAULT_DIR = join(BASE_DIR, "vault");

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Run claude CLI with streaming JSON to show live progress */
function runClaude(prompt: string, label: string): Promise<{ ok: boolean; result: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let spinIdx = 0;
    let statusLine = "";
    let resultText = "";
    let lastUpdate = "";

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const frame = spinner[spinIdx++ % spinner.length];
      const display = statusLine ? `  ${statusLine.slice(0, 55)}` : "";
      process.stderr.write(`\r${frame} ${label}... ${formatElapsed(elapsed)}${display.padEnd(60)}`);
    }, 200);

    const child = spawn("claude", [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--allowedTools", "Edit,Write,Read,Glob,Grep,Bash(cat *),Bash(ls *)",
    ], {
      cwd: VAULT_DIR,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 600000,
    });

    let buffer = "";

    child.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();

      // Parse complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete last line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          // Tool use events — show what Claude is doing
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "tool_use") {
                const tool = block.name;
                const input = block.input;

                if (tool === "Read" && input?.file_path) {
                  const file = input.file_path.replace(VAULT_DIR + "/", "");
                  const msg = `Reading ${file}`;
                  if (msg !== lastUpdate) {
                    statusLine = msg;
                    lastUpdate = msg;
                  }
                } else if (tool === "Write" && input?.file_path) {
                  const file = input.file_path.replace(VAULT_DIR + "/", "");
                  const msg = `Writing ${file}`;
                  if (msg !== lastUpdate) {
                    // Clear spinner line and print permanent log
                    process.stderr.write(`\r${"".padEnd(120)}\r`);
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    console.log(`  [${formatElapsed(elapsed)}] Writing ${file}`);
                    statusLine = msg;
                    lastUpdate = msg;
                  }
                } else if (tool === "Edit" && input?.file_path) {
                  const file = input.file_path.replace(VAULT_DIR + "/", "");
                  const msg = `Editing ${file}`;
                  if (msg !== lastUpdate) {
                    process.stderr.write(`\r${"".padEnd(120)}\r`);
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    console.log(`  [${formatElapsed(elapsed)}] Editing ${file}`);
                    statusLine = msg;
                    lastUpdate = msg;
                  }
                } else if (tool === "Glob" || tool === "Grep") {
                  statusLine = `Searching files...`;
                }
              }
            }
          }

          // Final result
          if (event.type === "result") {
            resultText = event.result ?? "";
          }
        } catch {
          // Ignore parse errors for incomplete JSON
        }
      }
    });

    child.on("close", (code) => {
      clearInterval(timer);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      process.stderr.write(`\r${"".padEnd(120)}\r`);

      if (code === 0) {
        console.log(`\nDone in ${formatElapsed(elapsed)}.`);
        resolve({ ok: true, result: resultText });
      } else {
        console.error(`\nFailed after ${formatElapsed(elapsed)}.`);
        resolve({ ok: false, result: resultText });
      }
    });

    child.on("error", (err) => {
      clearInterval(timer);
      process.stderr.write(`\r${"".padEnd(120)}\r`);
      console.error(`Claude error: ${err.message}`);
      resolve({ ok: false, result: "" });
    });
  });
}

export async function runCompile() {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found. Run `cachezero init` first.");
    process.exit(1);
  }

  const claudeCheck = spawnSync("which", ["claude"]);
  if (claudeCheck.status !== 0) {
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

  const existingWikiDir = join(VAULT_DIR, "wiki");
  const existingWiki = existsSync(existingWikiDir)
    ? readdirSync(existingWikiDir).filter((f) => f.endsWith(".md") && f !== "INDEX.md")
    : [];

  console.log(`Found ${rawFiles.length} raw source(s), ${existingWiki.length} existing wiki page(s).`);
  console.log("Compiling wiki with Claude Code...\n");

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

  const { ok, result } = await runClaude(prompt, "Compiling wiki");

  if (!ok) {
    console.error("\nCompilation failed. You can compile manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error('  Then say: "Read SCHEMA.md and compile the wiki from raw sources"');
    process.exit(1);
  }

  if (result) {
    console.log("\n" + result);
  }

  // Trigger reindex
  console.log("\nReindexing...");
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

  const claudeCheck = spawnSync("which", ["claude"]);
  if (claudeCheck.status !== 0) {
    console.error("Claude Code CLI not found.");
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

  console.log("Searching knowledge base...\n");
  const { ok, result } = await runClaude(prompt, "Thinking");

  if (ok && result) {
    console.log("\n" + result);
  } else if (!ok) {
    console.error("\nFailed. Try manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error("  Then ask your question.");
  }
}

export async function runHealth() {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found. Run `cachezero init` first.");
    process.exit(1);
  }

  const claudeCheck = spawnSync("which", ["claude"]);
  if (claudeCheck.status !== 0) {
    console.error("Claude Code CLI not found.");
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

  console.log("Running wiki health check...\n");
  const { ok, result } = await runClaude(prompt, "Reviewing wiki");

  if (ok && result) {
    console.log("\n" + result);
  } else if (!ok) {
    console.error("\nFailed. Try manually:");
    console.error("  cd ~/.cachezero/vault && claude");
    console.error('  Then say: "Review the wiki for issues and save a health report"');
  }
}
