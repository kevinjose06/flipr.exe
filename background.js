// flipr.exe - Background Service Worker

// Create context menu and auto-inject into existing tabs on install/reload
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "flipr-save-as",
      title: "⚡ Convert Image with flipr.exe...",
      contexts: ["image"],
    });
  });

  // Inject into open tabs so existing pages don't need a manual reload
  try {
    const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
    for (const tab of tabs) {
      if (tab.id && !tab.url.startsWith("chrome://")) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        }).catch(() => {});
      }
    }
  } catch (e) {}
});

// Robust sender with automatic fallback injection if receiving end does not exist
async function sendToContentScript(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    // Receiving end doesn't exist yet (page wasn't refreshed or script not loaded)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"],
      });
      // Small tick to ensure listener is active
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tabId, message);
        } catch (e) {
          console.warn("flipr.exe: Failed to send message after injection:", e);
        }
      }, 50);
    } catch (injectErr) {
      console.warn("flipr.exe: Script injection not allowed on this page:", injectErr);
    }
  }
}

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "flipr-save-as" && tab && tab.id) {
    sendToContentScript(tab.id, {
      action: "showConverter",
      imageUrl: info.srcUrl,
    });
  }
});

// Listen for download requests from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Fetch image data from background to bypass CORS restrictions on content scripts
  if (message.action === "fetchImageData") {
    if (typeof message.url !== "string" || !/^(https?|data|blob):/i.test(message.url)) {
      sendResponse({ success: false, error: "Invalid image URL" });
      return false;
    }

    fetch(message.url)
      .then(async (resp) => {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({
            success: true,
            dataUrl: reader.result,
            size: blob.size,
            type: blob.type,
          });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: "Failed to read image data" });
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }

  if (message.action === "downloadImage") {
    const { dataUrl, filename } = message;

    if (typeof dataUrl !== "string" || !/^(data:|blob:)/i.test(dataUrl)) {
      sendResponse({ success: false, error: "Invalid data URL" });
      return false;
    }

    // Sanitize filename on the background side (defense-in-depth against path traversal)
    const safeFilename = (typeof filename === "string" ? filename : "image.png")
      .replace(/\.\./g, "_")
      .replace(/[\/\\:*?"<>|]/g, "_")
      .replace(/^\.+/, "_")
      .trim()
      .substring(0, 100) || "image.png";

    chrome.downloads.download(
      {
        url: dataUrl,
        filename: safeFilename,
        saveAs: true,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      }
    );
    return true; // Keep channel open for async response
  }
});
