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
  if (message.action === "downloadImage") {
    const { dataUrl, filename } = message;
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
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
