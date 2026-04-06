import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CreateBookmarkSchema,
  SearchQuerySchema,
  DEFAULT_PORT,
} from "@cachezero/shared";
import { getConfig } from "./services/config.js";
import { getVaultStats, vaultDir } from "./services/vault.js";
import { ingestBookmark, deleteBookmark, listBookmarks, getBookmark } from "./services/ingest.js";
import { search } from "./services/search.js";
import { reindexAll, getIndexStats } from "./services/indexer.js";
import { checkEmbeddingHealth } from "./services/embeddings.js";

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    const app = new Hono();
    app.use("*", cors({ origin: "*" }));

    app.get("/api/status", async (c) => {
      const vault = await getVaultStats();
      const index = await getIndexStats();
      return c.json({ server: "ok", vault, index });
    });

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

    app.post("/api/search", async (c) => {
      const body = await c.req.json();
      const input = SearchQuerySchema.parse(body);
      const results = await search(input);
      return c.json(results);
    });

    app.post("/api/reindex", async (c) => {
      const result = await reindexAll(vaultDir());
      return c.json({ ok: true, ...result });
    });

    app.get("/api/health", async (c) => {
      const embeddings = await checkEmbeddingHealth();
      const vault = await getVaultStats();
      const index = await getIndexStats();
      return c.json({ ok: true, embeddings: embeddings ? "ok" : "unavailable", vault, index });
    });

    const config = getConfig();
    const port = config.server_port ?? DEFAULT_PORT;

    serve({ fetch: app.fetch, port }, (info) => {
      console.log(`CacheZero server running at http://localhost:${info.port}`);
      resolve();
    });
  });
}
