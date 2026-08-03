/**
 * YouTube Focus Pause — Popup Script
 *
 * Reads/writes the enabled toggle directly to chrome.storage.sync.
 * No message-passing through the background worker — the content script
 * listens to storage.onChanged directly to react live.
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle-switch');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // Read current state from storage
  chrome.storage.sync.get({ enabled: true }, (result) => {
    updateUI(result.enabled);
  });

  // Toggle handler — write directly to storage
  toggle.addEventListener('change', () => {
    const newState = toggle.checked;
    chrome.storage.sync.set({ enabled: newState });
    updateUI(newState);
  });

  // Also listen for external changes (e.g. another popup instance)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.enabled) {
      updateUI(changes.enabled.newValue);
    }
  });

  function updateUI(isEnabled) {
    toggle.checked = isEnabled;

    if (isEnabled) {
      statusDot.classList.add('enabled');
      statusDot.classList.remove('disabled');
      statusText.textContent = 'Enabled';
    } else {
      statusDot.classList.add('disabled');
      statusDot.classList.remove('enabled');
      statusText.textContent = 'Disabled';
    }
  }
});
