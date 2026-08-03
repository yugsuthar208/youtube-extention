# YouTube Focus Pause — Chrome Extension (Manifest V3)

A lightweight, event-driven Chrome Extension that automatically pauses YouTube videos when you switch tabs, minimize Chrome, or switch to another application, and resumes playback right where you left off when you return.

## Features

- **Pause on Tab Switch**: Instantly pauses playback when switching to another tab.
- **Resume on Tab Return**: Automatically resumes when switching back to the YouTube tab.
- **Pause on Window Unfocus / Alt-Tab**: Pauses when switching focus to another desktop application (VS Code, Discord, etc.).
- **Resume on Window Focus**: Resumes when returning focus to Chrome.
- **Pause on Minimize / Restore**: Pauses on minimize, resumes on restore.
- **Manual Pause Protection**: Respects user's manual pauses (will not auto-resume if you manually paused the video).
- **Auto-Skip Skippable Ads**: Automatically clicks YouTube's "Skip Ad" button as soon as it becomes available.
- **Single-Page App (SPA) Support**: Full support for YouTube navigation without page reloads, playlists, and fullscreen.
- **Zero Polling & Lightweight**: Built with Page Visibility API & Window Focus events for maximum efficiency.

## File Structure

```
├── manifest.json      # Manifest V3 extension configuration
├── background.js      # Service worker for default settings
├── content.js         # Core engine (State machine, visibility listeners, SPA handler)
├── popup.html         # Dark-themed extension popup interface
├── popup.js           # Popup toggle logic
├── popup.css          # Styled popup design
└── icons/             # Extension icons (16px, 48px, 128px)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## How to Install (Unpacked Extension)

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extension folder.
5. Open YouTube and enjoy automated smart pausing!

## Permissions Used

- `storage`: For saving the extension enable/disable toggle preference in `chrome.storage.sync`.
- `host_permissions` (`*://*.youtube.com/*`): To inject content script on YouTube pages.
