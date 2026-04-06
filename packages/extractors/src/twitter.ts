import type { ExtractedContent } from "@cachezero/shared";
import type { Extractor } from "./index.js";

export const twitterExtractor: Extractor = {
  name: "twitter",

  matches(url: string): boolean {
    return /^https?:\/\/(x\.com|twitter\.com)\//i.test(url);
  },

  extract(doc: Document, url: string): ExtractedContent {
    // Tweet text
    const tweetTextEl = doc.querySelector('[data-testid="tweetText"]');
    const textContent = tweetTextEl?.textContent?.trim() ?? "";

    // Author
    const userNameEl = doc.querySelector('[data-testid="User-Name"]');
    let author: string | undefined;
    let authorUrl: string | undefined;
    if (userNameEl) {
      const spans = userNameEl.querySelectorAll("span");
      // First span is usually display name
      author = spans[0]?.textContent?.trim();
      // Look for the @handle link
      const handleLink = userNameEl.querySelector('a[href*="/"]');
      if (handleLink) {
        authorUrl = (handleLink as HTMLAnchorElement).href;
      }
    }

    // Images
    const images: string[] = [];
    const photoEls = doc.querySelectorAll('[data-testid="tweetPhoto"] img');
    for (const img of photoEls) {
      const src = (img as HTMLImageElement).src;
      if (src) images.push(src);
    }

    // Title: use first ~80 chars of text
    const title = textContent.length > 80
      ? textContent.slice(0, 77) + "..."
      : textContent || "Tweet";

    // Try to get date from time element
    const timeEl = doc.querySelector("time");
    const publishedDate = timeEl?.getAttribute("datetime") ?? undefined;

    return {
      url,
      title,
      contentType: "tweet",
      textContent,
      author,
      authorUrl,
      publishedDate,
      images: images.length > 0 ? images : undefined,
    };
  },
};
