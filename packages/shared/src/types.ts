/** Content types that CacheZero can extract and store */
export type ContentType = "tweet" | "linkedin" | "article" | "youtube" | "other";

/** Extracted content from a web page, before storage */
export interface ExtractedContent {
  url: string;
  title: string;
  contentType: ContentType;
  textContent: string;
  author?: string;
  authorUrl?: string;
  publishedDate?: string;
  images?: string[];
  metadata?: Record<string, unknown>;
}

/** YAML frontmatter for a raw bookmark file */
export interface RawFrontmatter {
  id: string;
  type: ContentType;
  url: string;
  author?: string;
  author_url?: string;
  date?: string;
  tags: string[];
  bookmarked: string;
}

/** YAML frontmatter for a wiki article */
export interface WikiFrontmatter {
  type: "wiki";
  topics: string[];
  sources: string[];
  compiled: string;
}

/** YAML frontmatter for an output file */
export interface OutputFrontmatter {
  type: "output";
  query: string;
  generated: string;
  sources_used: string[];
}

/** A parsed markdown file with frontmatter and body */
export interface ParsedMarkdown<T = Record<string, unknown>> {
  frontmatter: T;
  content: string;
  filePath: string;
}

/** Search result returned from vector or text search */
export interface SearchResult {
  filePath: string;
  title: string;
  snippet: string;
  score: number;
  frontmatter: Record<string, unknown>;
}

/** Bookmark as returned by the API (raw file metadata) */
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  contentType: ContentType;
  author?: string;
  tags: string[];
  bookmarked: string;
  filePath: string;
}

/** Server status response */
export interface ServerStatus {
  server: "ok";
  vault: {
    path: string;
    rawCount: number;
    wikiCount: number;
    outputCount: number;
  };
  index: {
    documentCount: number;
    lastIndexed?: string;
  };
}
