import matter from "gray-matter";
import type { ParsedMarkdown } from "./types.js";

/** Parse a markdown file with YAML frontmatter */
export function parseMarkdown<T = Record<string, unknown>>(
  content: string,
  filePath: string
): ParsedMarkdown<T> {
  const { data, content: body } = matter(content);
  return {
    frontmatter: data as T,
    content: body.trim(),
    filePath,
  };
}

/** Serialize frontmatter + content back to a markdown string */
export function serializeMarkdown(
  frontmatter: object,
  content: string
): string {
  // Strip undefined values — YAML dumper chokes on them
  const clean = JSON.parse(JSON.stringify(frontmatter));
  return matter.stringify(content, clean);
}

/** Extract the first H1 title from markdown content */
export function extractTitle(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}
