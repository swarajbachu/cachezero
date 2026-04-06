# CacheZero

AI-powered second brain. Bookmark anything from the web, compile it into a knowledge wiki with your local LLM, search it, and publish it as a website.

Inspired by [Karpathy's LLM Wiki pattern](https://github.com/karpathy/llm-wiki): raw data goes in, an LLM compiles an interconnected wiki, and the knowledge compounds over time. You never write the wiki yourself — that's the LLM's job.

## How it works

```
Chrome Extension ──POST──┐
CLI (cachezero add) ──────┤
                          ▼
                    Hono Server (:3777) ──▶ ~/.cachezero/vault/
                          │                   ├── raw/       ← bookmarked .md files
                          │                   ├── wiki/      ← AI-compiled articles
                          │                   ├── outputs/   ← Q&A results
                          │                   └── SCHEMA.md  ← LLM instructions
                          ▼
                       LanceDB (vector search index)
```

The vault is just a folder of markdown files. Open it in **Obsidian** for graph view, wikilinks, and browsing. Publish it to **Vercel** as a website with one command.

## Quick start

```bash
# 1. Install and set up everything (one command)
npx cachezero init

#    This will:
#    → Create ~/.cachezero/vault/ (your Obsidian-compatible knowledge base)
#    → Install the Chrome extension to ~/.cachezero/extension/
#    → Prompt for a free Gemini API key (for vector search)
#    → Start the server in the background

# 2. Load the Chrome extension
#    → Open chrome://extensions
#    → Enable Developer Mode
#    → Click "Load unpacked" → select ~/.cachezero/extension/

# 3. Start bookmarking!
#    Browse the web → click the CacheZero icon → Save

# 4. Compile your wiki (requires Claude Code CLI)
npx cachezero compile
```

## Commands

### Server

```bash
cachezero init               # Set up vault, config, extension, start server
cachezero start              # Start server in background
cachezero stop               # Stop server
cachezero status             # Show server, vault, and index stats
cachezero health             # Check server + embedding service health
```

### Bookmarking & browsing

```bash
cachezero list               # List all bookmarks
cachezero list -t tweet      # Filter by type (tweet, article, linkedin, youtube)
cachezero list --tag ai      # Filter by tag
```

### Search (vector similarity)

Requires a [Gemini API key](https://aistudio.google.com/apikey) (free tier, set during `cachezero init`).

```bash
cachezero search "RAG vs fine-tuning"
cachezero search "attention mechanism" -t article
cachezero reindex            # Rebuild search index after manual vault edits
```

### Wiki compilation (uses your local Claude Code)

Requires [Claude Code](https://claude.ai/claude-code) installed.

```bash
cachezero compile            # Read raw/ → compile wiki/ articles
```

This calls your local `claude` CLI with a spinner and elapsed timer. Claude reads all raw sources, follows the conventions in `SCHEMA.md`, and creates interconnected wiki pages with `[[wikilinks]]`, YAML frontmatter, and source citations. Example output:

```
Found 6 raw source(s), 7 existing wiki page(s).
Compiling wiki with Claude Code...

⠹ Compiling wiki... 2m 14s  Writing wiki/transformer-architecture.md

Done in 3m 2s.
Compiled 6 raw sources into 12 wiki pages.
INDEX.md and log.md updated.
```

### Q&A and health checks

```bash
cachezero ask "What are the tradeoffs between RAG and fine-tuning?"
# → Claude searches your wiki, synthesizes an answer, saves to outputs/

cachezero wiki-health
# → Claude reviews wiki for contradictions, gaps, orphan pages
# → Saves report to outputs/health-check-YYYY-MM-DD.md
```

### Publishing

```bash
cachezero publish            # Build static site with Quartz (auto-clones on first run)
cachezero publish --deploy   # Build + deploy to Vercel
```

Generates a full website from your vault with search, graph view, wikilinks, and tag pages. First run clones [Quartz v4](https://quartz.jzhao.xyz) to `~/.cachezero/quartz/`.

## Browse in Obsidian

Open `~/.cachezero/vault/` as an Obsidian vault. You get:

- **Graph view** showing connections between wiki pages
- **Wikilinks** that navigate between articles
- **Live updates** as you bookmark or compile
- **Tag browsing** from bookmark frontmatter

The vault is the LLM's domain — you browse it, the LLM writes it.

## Architecture

Everything lives in `~/.cachezero/`:

```
~/.cachezero/
├── config.json        # Gemini API key, server port
├── vault/             # YOUR DATA (Obsidian vault)
│   ├── SCHEMA.md      # LLM instructions for wiki compilation
│   ├── log.md         # Append-only operation log
│   ├── raw/           # Bookmarked content (immutable)
│   ├── wiki/          # AI-compiled articles (LLM-owned)
│   │   └── INDEX.md   # Master index of all wiki pages
│   ├── outputs/       # Q&A answers, health reports
│   └── images/        # Downloaded images
├── index/             # LanceDB vector search (rebuildable)
├── extension/         # Chrome extension files
└── quartz/            # Quartz site generator (cloned on first publish)
```

### Raw files (bookmarked content)

```markdown
---
id: 01JRVX...
type: tweet
url: https://x.com/karpathy/status/...
author: Andrej Karpathy
tags: [knowledge-base, llm]
bookmarked: 2026-04-06T12:00:00Z
---

# LLM Knowledge Bases

Something I'm finding very useful recently...
```

### Wiki files (AI-compiled)

```markdown
---
type: wiki
topics: [vector-databases, embeddings]
sources:
  - raw/article-lance-db-overview.md
compiled: 2026-04-06T14:00:00Z
---

# Vector Databases

A **vector database** stores data as high-dimensional vectors...

## Related
- [[retrieval-augmented-generation|RAG]]
- [[embeddings]]

## Sources
- [LanceDB Overview](raw/article-lance-db-overview.md)
```

## MCP Server (Claude Code integration)

CacheZero includes an MCP server so Claude Code can search your knowledge base directly during conversations.

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "cachezero": {
      "command": "npx",
      "args": ["-y", "cachezero", "mcp"]
    }
  }
}
```

Tools available:
- `search_knowledge` — semantic search across your vault
- `list_bookmarks` — list/filter bookmarks
- `add_bookmark` — bookmark a URL

## Chrome extension

The extension is bundled with the npm package and installed to `~/.cachezero/extension/` during `cachezero init`.

To load it:
1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `~/.cachezero/extension/`

Supports: Twitter/X, LinkedIn, YouTube, articles, and any web page.

## Tech stack

- **Server**: Hono (TypeScript)
- **Vector DB**: LanceDB (embedded)
- **Embeddings**: Google Gemini `text-embedding-004` (free tier)
- **Wiki compilation**: Your local Claude Code / Codex
- **Extension**: WXT (Manifest V3)
- **Publishing**: Quartz v4 → Vercel
- **Vault**: Plain markdown + YAML frontmatter (Obsidian-compatible)

## Development

```bash
git clone https://github.com/swarajbachu/cachezero
cd cachezero
pnpm install
pnpm -w run build

# Dev server with hot reload
pnpm --filter @cachezero/server dev

# Build Chrome extension
pnpm --filter @cachezero/extension build
# → Load apps/extension/.output/chrome-mv3/ in Chrome

# Build CLI
pnpm --filter cachezero build
```

## Support

If CacheZero is useful to you, consider sponsoring the project. It helps me keep building and shipping.

[Sponsor on GitHub](https://github.com/sponsors/swarajbachu)

## License

MIT
