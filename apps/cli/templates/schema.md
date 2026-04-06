# CacheZero Knowledge Base Schema

## What This Is
A personal knowledge base powered by CacheZero. Raw sources are bookmarked via the Chrome extension or CLI. The wiki is compiled and maintained by you (the LLM agent). The human reads, explores, and asks questions — you do the bookkeeping.

## Directory Structure
- `raw/` — Bookmarked source material. **Never modify these files.** They are the immutable source of truth.
- `wiki/` — Your compiled wiki. You own this entirely. Create pages, update them, maintain cross-references.
- `wiki/INDEX.md` — Master index of every wiki page with a one-line summary. Update on every compile.
- `outputs/` — Generated answers, reports, analyses. File valuable outputs back here.
- `images/` — Downloaded images referenced by markdown files.
- `log.md` — Append-only operation log. You should read recent entries for context.

## Wiki Conventions
- Every topic gets its own `.md` file in `wiki/`
- Every wiki file starts with YAML frontmatter:
  ```yaml
  ---
  type: wiki
  topics: [topic-a, topic-b]
  sources:
    - raw/source-file.md
  compiled: YYYY-MM-DDTHH:MM:SSZ
  ---
  ```
- Use `[[wikilinks]]` to link between wiki pages (Obsidian-compatible)
- Use `[[page-name|Display Text]]` for custom link text
- Every wiki page should have a one-paragraph summary at the top
- Cite sources with links back to `raw/` files
- Maintain an **## Related** section at the bottom of each page

## INDEX.md Format
```markdown
# Knowledge Base Index

## Concepts
- [[topic-name]] — One-line description

## Entities
- [[entity-name]] — One-line description

## Sources
- [[raw/filename]] — One-line summary
```

## Operations

### Ingest (when asked to process new raw sources)
1. Read the new source(s) in `raw/`
2. Identify key topics, entities, and claims
3. For each: create a new wiki page or update an existing one
4. Update `wiki/INDEX.md`
5. Append to `log.md`: `## [YYYY-MM-DD] compile | Brief description`

### Query (when asked a question)
1. Read `wiki/INDEX.md` to find relevant pages
2. Read the relevant wiki pages and raw sources
3. Synthesize an answer
4. If the answer is substantial, save it to `outputs/` as a new `.md` file

### Lint (when asked to health-check the wiki)
1. Read all files in `wiki/`
2. Flag: contradictions, stale claims, orphan pages, missing cross-references
3. Suggest: new pages, new connections, sources to find
4. Save report to `outputs/health-check-YYYY-MM-DD.md`

## Output File Format
```yaml
---
type: output
query: "The question that was asked"
generated: YYYY-MM-DDTHH:MM:SSZ
sources_used: [wiki/page.md, raw/source.md]
---
```

## Tips
- Keep wiki pages focused — one concept per page
- Prefer updating existing pages over creating new ones for minor additions
- When sources contradict each other, note the contradiction explicitly
- Use the graph view in Obsidian to spot orphan pages and weak connections
