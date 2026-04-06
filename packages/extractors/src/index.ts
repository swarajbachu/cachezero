import type { ExtractedContent } from "@cachezero/shared";
import { twitterExtractor } from "./twitter.js";
import { linkedinExtractor } from "./linkedin.js";
import { articleExtractor } from "./article.js";
import { fallbackExtractor } from "./fallback.js";

/** Interface that all content extractors implement */
export interface Extractor {
  name: string;
  matches(url: string): boolean;
  extract(doc: Document, url: string): ExtractedContent;
}

/** Ordered list of extractors — first match wins, fallback is last */
const extractors: Extractor[] = [
  twitterExtractor,
  linkedinExtractor,
  articleExtractor,
  fallbackExtractor,
];

/** Find the best extractor for a URL and extract content */
export function extractContent(doc: Document, url: string): ExtractedContent {
  const extractor = extractors.find((e) => e.matches(url)) ?? fallbackExtractor;
  return extractor.extract(doc, url);
}

export { twitterExtractor, linkedinExtractor, articleExtractor, fallbackExtractor };
export type { ExtractedContent };
