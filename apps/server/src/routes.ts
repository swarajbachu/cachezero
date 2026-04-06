import { Hono } from "hono";
import { cors } from "hono/cors";
import { CreateBookmarkSchema, SearchQuerySchema } from "@cachezero/shared";
import { getVaultStats, vaultDir } from "./services/vault.js";
import { ingestBookmark, deleteBookmark, listBookmarks, getBookmark } from "./services/ingest.js";
import { search } from "./services/search.js";
import { reindexAll, getIndexStats } from "./services/indexer.js";
import { checkEmbeddingHealth } from "./services/embeddings.js";

export const app = new Hono();

// Allow Chrome extension and local clients
app.use("*", cors({ origin: "*" }));

// Health / status
app.get("/api/status", async (c) => {
  const vault = await getVaultStats();
  const index = await getIndexStats();
  return c.json({ server: "ok", vault, index });
});

// Bookmarks CRUD
app.post("/api/bookmarks", async (c) => {
  const body = await c.req.json();
  const input = CreateBookmarkSchema.parse(body);
  const bookmark = await ingestBookmark(input);
  return c.json(bookmark, 201);
});

app.get("/api/bookmarks", async (c) => {
  const contentType = c.req.query("contentType");
  const tag = c.req.query("tag");
  const limit = Number(c.req.query("limit") ?? 50);
  const bookmarks = await listBookmarks({ contentType, tag, limit });
  return c.json(bookmarks);
});

app.get("/api/bookmarks/:id", async (c) => {
  const bookmark = await getBookmark(c.req.param("id"));
  if (!bookmark) return c.json({ error: "Not found" }, 404);
  return c.json(bookmark);
});

app.delete("/api/bookmarks/:id", async (c) => {
  const deleted = await deleteBookmark(c.req.param("id"));
  if (!deleted) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// Search
app.post("/api/search", async (c) => {
  const body = await c.req.json();
  const input = SearchQuerySchema.parse(body);
  const results = await search(input);
  return c.json(results);
});

// Reindex all vault files
app.post("/api/reindex", async (c) => {
  const result = await reindexAll(vaultDir());
  return c.json({ ok: true, ...result });
});

// Server health (embedding service + vault + index stats)
app.get("/api/health", async (c) => {
  const embeddings = await checkEmbeddingHealth();
  const vault = await getVaultStats();
  const index = await getIndexStats();
  return c.json({
    ok: true,
    embeddings: embeddings ? "ok" : "unavailable",
    vault,
    index,
  });
});

// Note: compile, ask, and wiki health checks are NOT server endpoints.
// Those operations are performed by the user's local LLM agent (Claude Code / Codex)
// which reads/writes vault files directly. The server only handles
// bookmarking, storage, indexing, and vector search.
