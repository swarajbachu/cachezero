interface ExtractedContent {
  url: string;
  title: string;
  contentType: string;
  textContent: string;
  author?: string;
  authorUrl?: string;
  publishedDate?: string;
  images?: string[];
}

let extractedContent: ExtractedContent | null = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Check if server is running
  const serverOk = await new Promise<boolean>((resolve) => {
    chrome.runtime.sendMessage({ action: "checkServer" }, (res) => {
      resolve(res?.ok ?? false);
    });
  });

  if (!serverOk) {
    document.getElementById("offline")!.style.display = "block";
    return;
  }

  // Extract content from current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
    if (chrome.runtime.lastError || !response) {
      const offlineEl = document.getElementById("offline")!;
      offlineEl.style.display = "block";
      offlineEl.innerHTML =
        "<p>Can't extract from this page.</p><p style='margin-top:8px;color:#999;font-size:12px'>Try refreshing the page first.</p>";
      return;
    }

    extractedContent = response;
    showPreview(response);
    document.getElementById("main")!.style.display = "block";
  });

  document.getElementById("saveBtn")!.addEventListener("click", save);
  document.getElementById("tags")!.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
  });
});

function showPreview(content: ExtractedContent) {
  document.getElementById("type")!.textContent = content.contentType;
  document.getElementById("title")!.textContent = content.title;
  document.getElementById("author")!.textContent = content.author
    ? `by ${content.author}`
    : "";
  document.getElementById("snippet")!.textContent =
    content.textContent?.slice(0, 200) || "";
}

async function save() {
  if (!extractedContent) return;

  const btn = document.getElementById("saveBtn") as HTMLButtonElement;
  const status = document.getElementById("status")!;
  btn.disabled = true;
  btn.textContent = "Saving...";
  status.textContent = "";

  const tagsRaw = (document.getElementById("tags") as HTMLInputElement).value;
  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  const data = { ...extractedContent, tags };

  chrome.runtime.sendMessage({ action: "save", data }, (response) => {
    if (response?.ok) {
      status.className = "status success";
      status.textContent = "Saved!";
      btn.textContent = "Saved";
      setTimeout(() => window.close(), 800);
    } else {
      status.className = "status error";
      status.textContent = response?.error || "Failed to save";
      btn.disabled = false;
      btn.textContent = "Save to Knowledge Base";
    }
  });
}
