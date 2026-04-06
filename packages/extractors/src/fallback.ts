import type { ExtractedContent } from "@cachezero/shared";
import type { Extractor } from "./index.js";

export const fallbackExtractor: Extractor = {
  name: "fallback",

  matches(): boolean {
    return true; // Always matches — used as last resort
  },

  extract(doc: Document, url: string): ExtractedContent {
    const title = doc.title || "Untitled";

    // Get meta description
    const metaDesc = doc.querySelector('meta[name="description"], meta[property="og:description"]');
    const description = metaDesc?.getAttribute("content") ?? "";

    // Get body text, truncated
    const bodyText = doc.body?.textContent?.replace(/\s+/g, " ").trim().slice(0, 5000) ?? "";

    const textContent = description
      ? `${description}\n\n${bodyText}`
      : bodyText;

    return {
      url,
      title,
      contentType: "other",
      textContent,
    };
  },
};
