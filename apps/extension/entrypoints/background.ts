const SERVER_URL = "http://localhost:3777";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "save") {
      saveBookmark(request.data)
        .then((result) => sendResponse({ ok: true, data: result }))
        .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    if (request.action === "checkServer") {
      checkServer()
        .then((ok) => sendResponse({ ok }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
  });
});

async function saveBookmark(data: Record<string, unknown>) {
  const res = await fetch(`${SERVER_URL}/api/bookmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Server error: ${await res.text()}`);
  return res.json();
}

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/status`);
    return res.ok;
  } catch {
    return false;
  }
}
