/**
 * YouTube Focus Pause — Background Service Worker
 *
 * Minimal: only sets default storage on first install.
 * No persistent state, no per-tab coordination.
 * The content script handles everything via Page Visibility API + window focus/blur.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default enabled state on first install
    chrome.storage.sync.set({ enabled: true });
  }
});
