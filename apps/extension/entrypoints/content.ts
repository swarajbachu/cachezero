export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.action === "extract") {
        const content = extractPageContent();
        sendResponse(content);
      }
      return true;
    });
  },
});

function extractPageContent() {
  const url = window.location.href;

  let contentType = "other";
  if (/x\.com|twitter\.com/i.test(url)) contentType = "tweet";
  else if (/linkedin\.com/i.test(url)) contentType = "linkedin";
  else if (/youtube\.com|youtu\.be/i.test(url)) contentType = "youtube";
  else contentType = "article";

  let title = "";
  let textContent = "";
  let author: string | undefined;
  let authorUrl: string | undefined;
  let publishedDate: string | undefined;
  const images: string[] = [];

  if (contentType === "tweet") {
    const tweetText = document.querySelector('[data-testid="tweetText"]');
    textContent = tweetText?.textContent?.trim() || "";
    title = textContent.length > 80 ? textContent.slice(0, 77) + "..." : textContent || "Tweet";

    const userNameEl = document.querySelector('[data-testid="User-Name"]');
    if (userNameEl) {
      const spans = userNameEl.querySelectorAll("span");
      author = spans[0]?.textContent?.trim();
      const handleLink = userNameEl.querySelector('a[href*="/"]') as HTMLAnchorElement | null;
      if (handleLink) authorUrl = handleLink.href;
    }

    const photoEls = document.querySelectorAll('[data-testid="tweetPhoto"] img');
    for (const img of photoEls) {
      const src = (img as HTMLImageElement).src;
      if (src) images.push(src);
    }

    const timeEl = document.querySelector("time");
    publishedDate = timeEl?.getAttribute("datetime") ?? undefined;

  } else if (contentType === "linkedin") {
    const selectors = [
      ".feed-shared-update-v2__description",
      ".feed-shared-text",
      ".update-components-text",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) {
        textContent = el.textContent.trim();
        break;
      }
    }
    title = textContent.length > 80 ? textContent.slice(0, 77) + "..." : textContent || "LinkedIn Post";

    const authorEl = document.querySelector(".feed-shared-actor__name, .update-components-actor__name");
    author = authorEl?.textContent?.trim();

  } else {
    // Article / generic
    const ogTitle = document.querySelector('meta[property="og:title"]');
    title = ogTitle?.getAttribute("content") || document.title || "Untitled";

    const authorMeta = document.querySelector('meta[name="author"], meta[property="article:author"]');
    author = authorMeta?.getAttribute("content") || undefined;

    const dateMeta = document.querySelector('meta[property="article:published_time"], time[datetime]');
    publishedDate = dateMeta?.getAttribute("content") || dateMeta?.getAttribute("datetime") || undefined;

    const containerSelectors = ["article", '[role="main"]', ".post-content", ".article-content", ".entry-content", "main"];
    for (const sel of containerSelectors) {
      const el = document.querySelector(sel);
      if (el?.textContent && el.textContent.trim().length > 200) {
        textContent = el.textContent.replace(/\s+/g, " ").trim().slice(0, 10000);
        break;
      }
    }
    if (!textContent) {
      textContent = document.body?.textContent?.replace(/\s+/g, " ").trim().slice(0, 5000) || "";
    }

    const ogImage = document.querySelector('meta[property="og:image"]');
    const ogSrc = ogImage?.getAttribute("content");
    if (ogSrc) images.push(ogSrc);
  }

  return {
    url,
    title,
    contentType,
    textContent,
    author,
    authorUrl,
    publishedDate,
    images: images.length > 0 ? images : undefined,
  };
}
