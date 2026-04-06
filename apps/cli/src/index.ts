import { Command } from "commander";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, openSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { runInit } from "./init.js";
import { runPublish } from "./publish.js";
import { runCompile, runAsk, runHealth as runWikiHealth } from "./compile.js";

const SERVER = "http://localhost:3777";
const PID_FILE = join(homedir(), ".cachezero", "server.pid");
const __dirname = dirname(fileURLToPath(import.meta.url));

async function serverFetch(path: string, opts?: RequestInit) {
  try {
    const res = await fetch(`${SERVER}${path}`, opts);
    return await res.json();
  } catch {
    console.error("Server not running. Start with: cachezero start");
    process.exit(1);
  }
}

const program = new Command();

program
  .name("cachezero")
  .description("AI-powered second brain — bookmark, index, search")
  .version(process.env["npm_package_version"] ?? "0.1.8");

program
  .command("init")
  .description("Set up CacheZero vault, config, and Obsidian integration")
  .action(runInit);

program
  .command("start")
  .description("Start the CacheZero server")
  .option("--foreground", "Run in foreground (don't daemonize)")
  .action(async (opts: { foreground?: boolean }) => {
    // Check if already running
    try {
      const res = await fetch(`${SERVER}/api/status`);
      if (res.ok) {
        console.log("Server already running.");
        return;
      }
    } catch {
      // Not running — good
    }

    if (opts.foreground) {
      // Run server in this process
      const { startServer } = await import("./server.js");
      await startServer();
    } else {
      // Spawn detached process using the same cachezero binary with --foreground
      const binPath = process.argv[1]!;
      const logFile = join(homedir(), ".cachezero", "server.log");
      const out = openSync(logFile, "a");
      const child = spawn(process.execPath, [binPath, "start", "--foreground"], {
        detached: true,
        stdio: ["ignore", out, out],
      });
      child.unref();
      if (child.pid) {
        writeFileSync(PID_FILE, String(child.pid));
        // Wait for server to start
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const res = await fetch(`${SERVER}/api/status`);
          if (res.ok) {
            console.log(`Server started in background (PID: ${child.pid})`);
            console.log(`Logs: ~/.cachezero/server.log`);
          }
        } catch {
          console.log(`Server starting (PID: ${child.pid})...`);
          console.log(`Check logs: ~/.cachezero/server.log`);
        }
      }
    }
  });

program
  .command("stop")
  .description("Stop the CacheZero server")
  .action(() => {
    if (existsSync(PID_FILE)) {
      const pid = readFileSync(PID_FILE, "utf-8").trim();
      try {
        process.kill(Number(pid));
        console.log(`Server stopped (PID: ${pid})`);
      } catch {
        console.log("Server was not running.");
      }
    } else {
      try {
        execSync("lsof -ti:3777 | xargs kill 2>/dev/null");
        console.log("Server stopped.");
      } catch {
        console.log("Server was not running.");
      }
    }
  });

program
  .command("status")
  .description("Show server, vault, and index status")
  .action(async () => {
    const data = await serverFetch("/api/status");
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("search <query>")
  .description("Semantic search across your knowledge base")
  .option("-l, --limit <n>", "Max results", "10")
  .option("-t, --type <type>", "Filter by content type")
  .action(async (query: string, opts: { limit: string; type?: string }) => {
    const data = await serverFetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: Number(opts.limit), contentType: opts.type }),
    });
    if (Array.isArray(data) && data.length === 0) {
      console.log("No results. Try `cachezero reindex` if you just added bookmarks.");
      return;
    }
    for (const r of data) {
      console.log(`\n[${r.score?.toFixed(3) ?? "?"}] ${r.title}`);
      console.log(`  ${r.filePath}`);
      console.log(`  ${r.snippet?.slice(0, 120)}...`);
    }
  });

program
  .command("list")
  .description("List bookmarks")
  .option("-t, --type <type>", "Filter by content type")
  .option("--tag <tag>", "Filter by tag")
  .option("-l, --limit <n>", "Max results", "50")
  .action(async (opts: { type?: string; tag?: string; limit: string }) => {
    const params = new URLSearchParams();
    if (opts.type) params.set("contentType", opts.type);
    if (opts.tag) params.set("tag", opts.tag);
    params.set("limit", opts.limit);
    const data = await serverFetch(`/api/bookmarks?${params}`);
    if (Array.isArray(data) && data.length === 0) {
      console.log("No bookmarks yet. Use the Chrome extension or `cachezero add <url>`.");
      return;
    }
    for (const b of data) {
      console.log(`\n[${b.contentType}] ${b.title}`);
      console.log(`  ${b.url}`);
      if (b.tags?.length) console.log(`  tags: ${b.tags.join(", ")}`);
    }
  });

program
  .command("add <url>")
  .description("Bookmark a URL (fetch + extract + store)")
  .option("--tag <tags...>", "Tags to apply")
  .action(async (url: string, opts: { tag?: string[] }) => {
    console.log(`Adding ${url} — not yet implemented (needs extractors)`);
  });

program
  .command("reindex")
  .description("Rebuild the vector search index from all vault files")
  .action(async () => {
    console.log("Reindexing...");
    const data = await serverFetch("/api/reindex", { method: "POST" });
    console.log(`Done. Indexed ${data.indexed} documents.`);
  });

program
  .command("health")
  .description("Check server, embedding service, and index health")
  .action(async () => {
    const data = await serverFetch("/api/health");
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("compile")
  .description("Compile raw bookmarks into wiki articles using Claude Code")
  .action(runCompile);

program
  .command("ask <question>")
  .description("Ask a question against your knowledge base using Claude Code")
  .option("--no-save", "Don't save the answer to outputs/")
  .action(async (question: string, opts: { save?: boolean }) => {
    await runAsk(question, { save: opts.save !== false });
  });

program
  .command("wiki-health")
  .description("Run a health check on the wiki using Claude Code")
  .action(runWikiHealth);

program
  .command("publish")
  .description("Build and optionally deploy your knowledge base as a website")
  .option("--quartz-dir <path>", "Path to Quartz directory")
  .option("--deploy", "Deploy to Vercel after building")
  .action(runPublish);

program.parse();
