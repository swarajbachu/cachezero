import type { ExtractedContent } from "@cachezero/shared";
import type { Extractor } from "./index.js";

export const articleExtractor: Extractor = {
  name: "article",

  matches(url: string): boolean {
    // Match any URL that's not a known social platform
    // This catches blogs, news sites, documentation, etc.
    const socialPatterns = [
      /x\.com/i, /twitter\.com/i, /linkedin\.com/i,
      /youtube\.com/i, /youtu\.be/i,
    ];
    return !socialPatterns.some((p) => p.test(url));
  },

  extract(doc: Document, url: string): ExtractedContent {
    // Title: prefer og:title, then document title
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    const title = ogTitle?.getAttribute("content") ?? doc.title ?? "Untitled";

    // Author: check meta tags
    const authorMeta = doc.querySelector(
      'meta[name="author"], meta[property="article:author"], meta[name="twitter:creator"]'
    );
    const author = authorMeta?.getAttribute("content") ?? undefined;

    // Published date
    const dateMeta = doc.querySelector(
      'meta[property="article:published_time"], meta[name="date"], time[datetime]'
    );
    const publishedDate =
      dateMeta?.getAttribute("content") ??
      dateMeta?.getAttribute("datetime") ??
      undefined;

    // Main content: simplified Readability approach
    // Try common article containers first
    const contentSelectors = [
      "article",
      '[role="main"]',
      ".post-content",
      ".article-content",
      ".entry-content",
      ".content",
      "main",
    ];

    let textContent = "";
    for (const sel of contentSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent && el.textContent.trim().length > 200) {
        textContent = cleanText(el.textContent);
        break;
      }
    }

    // Fallback: grab body text
    if (!textContent) {
      textContent = cleanText(doc.body?.textContent ?? "");
    }

    // Images: og:image or first significant image
    const images: string[] = [];
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage?.getAttribute("content")) {
      images.push(ogImage.getAttribute("content")!);
    }

    return {
      url,
      title,
      contentType: "article",
      textContent,
      author,
      publishedDate,
      images: images.length > 0 ? images : undefined,
    };
  },
};

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")       // collapse whitespace
    .replace(/\n{3,}/g, "\n\n") // limit consecutive newlines
    .trim()
    .slice(0, 10000);           // cap at 10k chars
}
