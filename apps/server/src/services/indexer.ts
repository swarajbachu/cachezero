import * as lancedb from "@lancedb/lancedb";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_INDEX_DIR,
  VAULT_DIRS,
  EMBEDDING_DIMENSIONS,
  parseMarkdown,
  extractTitle,
} from "@cachezero/shared";
import { getConfig } from "./config.js";
import { embed, embedBatch } from "./embeddings.js";
import { listVaultFiles } from "./vault.js";

const TABLE_NAME = "documents";

let db: lancedb.Connection | null = null;

function indexDir(): string {
  const config = getConfig();
  return config.index_dir?.replace("~", process.env["HOME"] ?? "") ?? DEFAULT_INDEX_DIR;
}

async function getDb(): Promise<lancedb.Connection> {
  if (db) return db;
  const dir = indexDir();
  db = await lancedb.connect(dir);
  return db;
}

async function tableExists(): Promise<boolean> {
  const conn = await getDb();
  const tables = await conn.tableNames();
  return tables.includes(TABLE_NAME);
}

async function getOrCreateTable(
  initialData?: Array<{
    filePath: string;
    title: string;
    snippet: string;
    contentType: string;
    tags: string;
    vector: number[];
  }>
) {
  const conn = await getDb();

  if (await tableExists()) {
    return conn.openTable(TABLE_NAME);
  }

  // Create with initial data or a dummy row to define schema
  const data = initialData ?? [
    {
      filePath: "__init__",
      title: "",
      snippet: "",
      contentType: "",
      tags: "",
      vector: new Array(EMBEDDING_DIMENSIONS).fill(0),
    },
  ];

  const table = await conn.createTable(TABLE_NAME, data);

  // Remove the dummy row if we used one
  if (!initialData) {
    await table.delete('filePath = "__init__"');
  }

  return table;
}

/** Index a single file: read it, embed it, upsert into LanceDB */
export async function indexFile(relativePath: string, vaultDir: string): Promise<void> {
  const fullPath = join(vaultDir, relativePath);
  if (!existsSync(fullPath)) return;

  const raw = await readFile(fullPath, "utf-8");
  const parsed = parseMarkdown(raw, relativePath);
  const title = extractTitle(parsed.content) ?? relativePath;

  // Use first 2000 chars for embedding
  const textForEmbedding = `${title}\n\n${parsed.content}`.slice(0, 2000);
  const vector = await embed(textForEmbedding);

  const fm = parsed.frontmatter as Record<string, unknown>;
  const snippet = parsed.content.slice(0, 300);
  const contentType = String(fm["type"] ?? fm["contentType"] ?? "other");
  const tags = JSON.stringify(fm["tags"] ?? []);

  const table = await getOrCreateTable();

  // Delete existing entry for this file path, then add new one
  try {
    await table.delete(`filePath = "${relativePath}"`);
  } catch {
    // Table might be empty or row doesn't exist — that's fine
  }

  await table.add([{ filePath: relativePath, title, snippet, contentType, tags, vector }]);
}

/** Reindex all markdown files in the vault */
export async function reindexAll(vaultDir: string): Promise<{ indexed: number }> {
  const dirs = [VAULT_DIRS.raw, VAULT_DIRS.wiki, VAULT_DIRS.outputs];
  const allFiles: string[] = [];

  for (const dir of dirs) {
    const files = await listVaultFiles(dir);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) return { indexed: 0 };

  // Read all files and prepare data
  const rows: Array<{
    filePath: string;
    title: string;
    snippet: string;
    contentType: string;
    tags: string;
    vector: number[];
  }> = [];

  const textsToEmbed: string[] = [];
  const fileData: Array<{
    filePath: string;
    title: string;
    snippet: string;
    contentType: string;
    tags: string;
  }> = [];

  for (const relativePath of allFiles) {
    const fullPath = join(vaultDir, relativePath);
    if (!existsSync(fullPath)) continue;

    const raw = await readFile(fullPath, "utf-8");
    const parsed = parseMarkdown(raw, relativePath);
    const title = extractTitle(parsed.content) ?? relativePath;
    const fm = parsed.frontmatter as Record<string, unknown>;
    const snippet = parsed.content.slice(0, 300);
    const contentType = String(fm["type"] ?? fm["contentType"] ?? "other");
    const tags = JSON.stringify(fm["tags"] ?? []);

    const textForEmbedding = `${title}\n\n${parsed.content}`.slice(0, 2000);
    textsToEmbed.push(textForEmbedding);
    fileData.push({ filePath: relativePath, title, snippet, contentType, tags });
  }

  // Batch embed (up to 100 at a time to stay within API limits)
  const batchSize = 100;
  const allVectors: number[][] = [];

  for (let i = 0; i < textsToEmbed.length; i += batchSize) {
    const batch = textsToEmbed.slice(i, i + batchSize);
    const vectors = await embedBatch(batch);
    allVectors.push(...vectors);
  }

  for (let i = 0; i < fileData.length; i++) {
    rows.push({ ...fileData[i]!, vector: allVectors[i]! });
  }

  // Drop and recreate table with fresh data
  const conn = await getDb();
  try {
    await conn.dropTable(TABLE_NAME);
  } catch {
    // Table might not exist
  }

  await conn.createTable(TABLE_NAME, rows);

  return { indexed: rows.length };
}

/** Search the index by vector similarity */
export async function vectorSearch(
  queryVector: number[],
  limit: number,
  contentType?: string
): Promise<
  Array<{
    filePath: string;
    title: string;
    snippet: string;
    contentType: string;
    tags: string;
    score: number;
  }>
> {
  if (!(await tableExists())) return [];

  const conn = await getDb();
  const table = await conn.openTable(TABLE_NAME);

  let query = table.search(queryVector).limit(limit);

  if (contentType) {
    query = query.where(`contentType = '${contentType}'`);
  }

  const results = await query.toArray();

  return results.map((row) => ({
    filePath: String(row.filePath),
    title: String(row.title),
    snippet: String(row.snippet),
    contentType: String(row.contentType),
    tags: String(row.tags),
    score: Number(row._distance ?? 0),
  }));
}

/** Get the count of indexed documents */
export async function getIndexStats(): Promise<{ documentCount: number }> {
  if (!(await tableExists())) return { documentCount: 0 };

  const conn = await getDb();
  const table = await conn.openTable(TABLE_NAME);
  const count = await table.countRows();
  return { documentCount: count };
}
