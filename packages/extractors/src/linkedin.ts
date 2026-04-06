import type { ExtractedContent } from "@cachezero/shared";
import type { Extractor } from "./index.js";

export const linkedinExtractor: Extractor = {
  name: "linkedin",

  matches(url: string): boolean {
    return /^https?:\/\/(www\.)?linkedin\.com\//i.test(url);
  },

  extract(doc: Document, url: string): ExtractedContent {
    // Post content — try multiple selectors as LinkedIn changes often
    const contentSelectors = [
      ".feed-shared-update-v2__description",
      ".feed-shared-text",
      '[data-ad-preview="message"]',
      ".update-components-text",
    ];

    let textContent = "";
    for (const sel of contentSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) {
        textContent = el.textContent.trim();
        break;
      }
    }

    // Author
    const authorSelectors = [
      ".feed-shared-actor__name",
      ".update-components-actor__name",
      ".feed-shared-actor__title",
    ];

    let author: string | undefined;
    for (const sel of authorSelectors) {
      const el = doc.querySelector(sel);
      if (el?.textContent?.trim()) {
        author = el.textContent.trim();
        break;
      }
    }

    // Title
    const title = textContent.length > 80
      ? textContent.slice(0, 77) + "..."
      : textContent || "LinkedIn Post";

    return {
      url,
      title,
      contentType: "linkedin",
      textContent,
      author,
      authorUrl: undefined,
      publishedDate: undefined,
    };
  },
};
