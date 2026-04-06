import { ulid } from "ulid";
import {
  VAULT_DIRS,
  type Bookmark,
  type CreateBookmarkInput,
  type RawFrontmatter,
  extractTitle,
} from "@cachezero/shared";
import {
  writeVaultFile,
  readVaultFile,
  listVaultFiles,
  deleteVaultFile,
  appendLog,
  ensureVault,
  vaultDir,
} from "./vault.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Ingest a new bookmark: write .md to raw/, log it */
export async function ingestBookmark(input: CreateBookmarkInput): Promise<Bookmark> {
  await ensureVault();

  const id = ulid();
  const slug = slugify(input.title);
  const filename = `${input.contentType}-${slug}.md`;

  const frontmatter: RawFrontmatter = {
    id,
    type: input.contentType,
    url: input.url,
    author: input.author,
    author_url: input.authorUrl,
    date: input.publishedDate,
    tags: input.tags,
    bookmarked: new Date().toISOString(),
  };

  const content = `# ${input.title}\n\n${input.textContent}`;

  const filePath = await writeVaultFile(VAULT_DIRS.raw, filename, frontmatter, content);

  await appendLog("ingest", input.title, `Source: ${input.url}`);

  // Index in LanceDB for vector search
  try {
    const { indexFile } = await import("./indexer.js");
    await indexFile(`${VAULT_DIRS.raw}/${filename}`, vaultDir());
  } catch (err) {
    // Non-fatal: indexing can fail if no API key configured yet
    console.warn("Indexing skipped (no embedding key?):", (err as Error).message);
  }

  return {
    id,
    url: input.url,
    title: input.title,
    contentType: input.contentType,
    author: input.author,
    tags: input.tags,
    bookmarked: frontmatter.bookmarked,
    filePath: `${VAULT_DIRS.raw}/${filename}`,
  };
}

/** List bookmarks with optional filters */
export async function listBookmarks(opts: {
  contentType?: string;
  tag?: string;
  limit: number;
}): Promise<Bookmark[]> {
  const files = await listVaultFiles(VAULT_DIRS.raw);
  const bookmarks: Bookmark[] = [];

  for (const f of files) {
    if (bookmarks.length >= opts.limit) break;

    const parsed = await readVaultFile<RawFrontmatter>(f);
    if (!parsed) continue;

    const fm = parsed.frontmatter;
    if (opts.contentType && fm.type !== opts.contentType) continue;
    if (opts.tag && !fm.tags?.includes(opts.tag)) continue;

    const title = extractTitle(parsed.content) ?? f;

    bookmarks.push({
      id: fm.id,
      url: fm.url,
      title,
      contentType: fm.type,
      author: fm.author,
      tags: fm.tags ?? [],
      bookmarked: fm.bookmarked,
      filePath: f,
    });
  }

  return bookmarks;
}

/** Get a single bookmark by ID */
export async function getBookmark(id: string): Promise<(Bookmark & { content: string }) | null> {
  const files = await listVaultFiles(VAULT_DIRS.raw);

  for (const f of files) {
    const parsed = await readVaultFile<RawFrontmatter>(f);
    if (!parsed || parsed.frontmatter.id !== id) continue;

    const fm = parsed.frontmatter;
    const title = extractTitle(parsed.content) ?? f;

    return {
      id: fm.id,
      url: fm.url,
      title,
      contentType: fm.type,
      author: fm.author,
      tags: fm.tags ?? [],
      bookmarked: fm.bookmarked,
      filePath: f,
      content: parsed.content,
    };
  }

  return null;
}

/** Delete a bookmark by ID */
export async function deleteBookmark(id: string): Promise<boolean> {
  const files = await listVaultFiles(VAULT_DIRS.raw);

  for (const f of files) {
    const parsed = await readVaultFile<RawFrontmatter>(f);
    if (!parsed || parsed.frontmatter.id !== id) continue;

    const title = extractTitle(parsed.content) ?? f;
    await deleteVaultFile(f);
    await appendLog("delete", title, `Removed: ${f}`);
    return true;
  }

  return false;
}
