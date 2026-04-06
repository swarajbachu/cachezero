import { execSync } from "node:child_process";
import { existsSync, cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE_DIR = join(homedir(), ".cachezero");
const VAULT_DIR = join(BASE_DIR, "vault");
const QUARTZ_DIR = join(BASE_DIR, "quartz");

const QUARTZ_CONFIG = `
import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

const config: QuartzConfig = {
  configuration: {
    pageTitle: "CacheZero",
    pageTitleSuffix: " — Second Brain",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "localhost",
    ignorePatterns: [".obsidian", "images"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: { header: "Inter", body: "Inter", code: "JetBrains Mono" },
      colors: {
        lightMode: {
          light: "#fafafa", lightgray: "#e5e5e5", gray: "#b8b8b8",
          darkgray: "#4e4e4e", dark: "#111111", secondary: "#333333",
          tertiary: "#666666", highlight: "rgba(0,0,0,0.05)", textHighlight: "#fff23688",
        },
        darkMode: {
          light: "#0a0a0a", lightgray: "#1a1a1a", gray: "#646464",
          darkgray: "#d4d4d4", dark: "#ebebec", secondary: "#aaaaaa",
          tertiary: "#888888", highlight: "rgba(255,255,255,0.05)", textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({ priority: ["frontmatter", "filesystem"] }),
      Plugin.SyntaxHighlighting({ theme: { light: "github-light", dark: "github-dark" }, keepBackground: false }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(), Plugin.ComponentResources(), Plugin.ContentPage(),
      Plugin.FolderPage(), Plugin.TagPage(),
      Plugin.ContentIndex({ enableSiteMap: true, enableRSS: true }),
      Plugin.Assets(), Plugin.Static(), Plugin.Favicon(), Plugin.NotFoundPage(),
    ],
  },
}
export default config
`.trim();

function ensureQuartz(): string {
  if (existsSync(join(QUARTZ_DIR, "quartz.config.ts"))) {
    return QUARTZ_DIR;
  }

  console.log("  Quartz not found. Cloning Quartz v4 (one-time setup)...");
  mkdirSync(BASE_DIR, { recursive: true });

  execSync(`git clone --depth 1 --branch v4 https://github.com/jackyzha0/quartz.git "${QUARTZ_DIR}"`, {
    stdio: "inherit",
  });

  // Write our config
  writeFileSync(join(QUARTZ_DIR, "quartz.config.ts"), QUARTZ_CONFIG);

  // Write vercel.json
  writeFileSync(
    join(QUARTZ_DIR, "vercel.json"),
    JSON.stringify({ outputDirectory: "public", cleanUrls: true }, null, 2)
  );

  // Install Quartz deps
  console.log("  Installing Quartz dependencies...");
  execSync("npm install", { cwd: QUARTZ_DIR, stdio: "inherit" });

  console.log("  Quartz setup complete.\n");
  return QUARTZ_DIR;
}

export async function runPublish(opts: { quartzDir?: string; deploy?: boolean }) {
  if (!existsSync(VAULT_DIR)) {
    console.error("Vault not found at ~/.cachezero/vault/. Run `cachezero init` first.");
    process.exit(1);
  }

  console.log("Publishing knowledge base...\n");

  // Step 1: Ensure Quartz is installed
  const quartzDir = opts.quartzDir ?? ensureQuartz();

  // Step 2: Copy vault content into Quartz content directory
  const contentDir = join(quartzDir, "content");
  console.log("  Copying vault to Quartz content...");

  if (existsSync(contentDir)) {
    rmSync(contentDir, { recursive: true });
  }
  mkdirSync(contentDir, { recursive: true });

  cpSync(VAULT_DIR, contentDir, {
    recursive: true,
    filter: (src) => !src.includes(".obsidian") && !src.includes(".DS_Store"),
  });
  console.log("  Done.\n");

  // Step 3: Build Quartz
  console.log("  Building Quartz site...");
  try {
    execSync("npx quartz build", { cwd: quartzDir, stdio: "inherit" });
  } catch {
    console.error("\nQuartz build failed. Check the output above.");
    process.exit(1);
  }

  const publicDir = join(quartzDir, "public");
  console.log(`\n  Static site built at: ${publicDir}`);

  // Step 4: Deploy to Vercel (optional)
  if (opts.deploy) {
    console.log("\n  Deploying to Vercel...");
    try {
      execSync("npx vercel deploy --prod", { cwd: quartzDir, stdio: "inherit" });
    } catch {
      console.error("\nVercel deploy failed. Make sure you're logged in: npx vercel login");
      process.exit(1);
    }
  } else {
    console.log("\n  To deploy to Vercel:");
    console.log(`    cd ${quartzDir} && npx vercel deploy --prod`);
    console.log("\n  Or preview locally:");
    console.log(`    npx serve ${publicDir}`);
  }
}
