#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SERVER_URL = process.env["CACHEZERO_SERVER"] ?? "http://localhost:3777";

async function serverFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${SERVER_URL}${path}`, opts);
  if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
  return res.json();
}

const server = new McpServer({
  name: "cachezero",
  version: "0.1.0",
});

// Tool: search_knowledge
server.tool(
  "search_knowledge",
  "Semantic search across the CacheZero knowledge base. Returns ranked results with file paths, titles, and snippets.",
  {
    query: z.string().describe("Natural language search query"),
    limit: z.number().optional().default(10).describe("Max results to return"),
    contentType: z.enum(["tweet", "linkedin", "article", "youtube", "other"]).optional()
      .describe("Filter by content type"),
  },
  async ({ query, limit, contentType }) => {
    try {
      const results = await serverFetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit, contentType }),
      });

      if (!Array.isArray(results) || results.length === 0) {
        return { content: [{ type: "text" as const, text: "No results found." }] };
      }

      const text = results
        .map((r: any, i: number) =>
          `${i + 1}. **${r.title}** (score: ${r.score?.toFixed(3) ?? "?"})\n   File: ${r.filePath}\n   ${r.snippet?.slice(0, 150)}...`
        )
        .join("\n\n");

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: list_bookmarks
server.tool(
  "list_bookmarks",
  "List bookmarks in the CacheZero knowledge base with optional filters.",
  {
    contentType: z.enum(["tweet", "linkedin", "article", "youtube", "other"]).optional()
      .describe("Filter by content type"),
    tag: z.string().optional().describe("Filter by tag"),
    limit: z.number().optional().default(20).describe("Max results"),
  },
  async ({ contentType, tag, limit }) => {
    try {
      const params = new URLSearchParams();
      if (contentType) params.set("contentType", contentType);
      if (tag) params.set("tag", tag);
      params.set("limit", String(limit));

      const bookmarks = await serverFetch(`/api/bookmarks?${params}`);

      if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
        return { content: [{ type: "text" as const, text: "No bookmarks found." }] };
      }

      const text = bookmarks
        .map((b: any) =>
          `- [${b.contentType}] **${b.title}**\n  URL: ${b.url}\n  Tags: ${b.tags?.join(", ") || "none"}\n  File: ${b.filePath}`
        )
        .join("\n\n");

      return { content: [{ type: "text" as const, text: `${bookmarks.length} bookmarks:\n\n${text}` }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Tool: add_bookmark
server.tool(
  "add_bookmark",
  "Add a new bookmark to the CacheZero knowledge base.",
  {
    url: z.string().url().describe("URL of the content to bookmark"),
    title: z.string().describe("Title of the content"),
    textContent: z.string().describe("The main text content"),
    contentType: z.enum(["tweet", "linkedin", "article", "youtube", "other"]).optional().default("other")
      .describe("Type of content"),
    author: z.string().optional().describe("Author name"),
    tags: z.array(z.string()).optional().default([]).describe("Tags to apply"),
  },
  async ({ url, title, textContent, contentType, author, tags }) => {
    try {
      const result = await serverFetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title, textContent, contentType, author, tags }),
      });

      return {
        content: [{ type: "text" as const, text: `Bookmarked: ${(result as any).title}\nFile: ${(result as any).filePath}\nID: ${(result as any).id}` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
