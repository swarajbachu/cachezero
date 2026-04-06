import type { SearchQueryInput, SearchResult } from "@cachezero/shared";
import { embed } from "./embeddings.js";
import { vectorSearch } from "./indexer.js";

/** Semantic search across vault files using vector similarity */
export async function search(input: SearchQueryInput): Promise<SearchResult[]> {
  // Embed the query
  const queryVector = await embed(input.query);

  // Search LanceDB
  const results = await vectorSearch(queryVector, input.limit, input.contentType);

  return results.map((r) => ({
    filePath: r.filePath,
    title: r.title,
    snippet: r.snippet,
    score: r.score,
    frontmatter: {
      contentType: r.contentType,
      tags: JSON.parse(r.tags || "[]"),
    },
  }));
}
