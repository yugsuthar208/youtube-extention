<div align="center">

  <img src="assets/banner.png" alt="YouTube Focus Pause Banner" width="100%" />

  # ⏸️ YouTube Focus Pause

  **Automated, event-driven Chrome Extension (Manifest V3) that intelligently pauses YouTube videos when you switch tabs or leave Chrome — and seamlessly resumes them when you return.**

  [![Chrome Extension](https://img.shields.io/badge/Manifest-V3-brightgreen.svg?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
  [![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
  [![Zero Polling](https://img.shields.io/badge/Architecture-Zero%20Polling-ff69b4.svg?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

</div>

---

## 🌟 Key Features

- **⚡ Instant Pause on Tab Switch**: Automatically pauses YouTube playback as soon as you switch to another Chrome tab.
- **🔄 Auto-Resume on Tab Return**: Playback resumes from the exact timestamp when you return to the YouTube tab.
- **🖥️ Chrome OS Focus Detection**: Pauses video when you switch away to another application (VS Code, Discord, Spotify, etc.) via `Alt-Tab`.
- **🪟 Minimize & Restore Handling**: Minimizing Chrome pauses the video; restoring the window auto-resumes playback.
- **🧠 Smart Manual Pause Respect**: Never auto-resumes if *you* manually paused the video yourself.
- **⏩ Auto-Skip Skippable Ads**: Automatically clicks YouTube's native "Skip Ad" button as soon as it becomes available.
- **🚀 Single-Page App (SPA) Support**: Full support for internal YouTube navigation, playlists, and video switching without page reloads.

---

## 📊 Visual State Machine Architecture

The extension uses an event-driven state machine per `<video>` element with zero polling overhead.

```mermaid
stateDiagram-v2
    [*] --> IDLE
    
    state IDLE {
        [*] --> Playing: Video Playing
        Playing --> UserPaused: User clicks Pause
    }

    state USER_PAUSED {
        UserPaused --> Playing: User clicks Play
    }

    state AUTO_PAUSED {
        AutoPaused --> Playing: Tab visible & focused
    }

    Playing --> AUTO_PAUSED: Tab Hidden / Window Blurred (programmatic pause)
    AUTO_PAUSED --> Playing: Tab Visible & Window Focused (programmatic play)
```

---

## 🏗️ Architecture & Component Flow

```mermaid
graph TD
    A["Page Visibility API<br>(visibilitychange)"] --> D["debouncedVisibilityHandler"]
    B["Window Focus Events<br>(focus / blur)"] --> D
    
    D --> E{"Is Page Hidden OR Window Blurred?"}
    
    E -- Yes --> F{"Is Video Playing & State == IDLE?"}
    F -- Yes --> G["programmaticPause()<br>Set _yfpProgrammatic flag<br>Transition to AUTO_PAUSED"]
    
    E -- No --> H{"Is State == AUTO_PAUSED?"}
    H -- Yes --> I["programmaticPlay()<br>Set _yfpProgrammatic flag<br>Transition to IDLE"]
    H -- No --> J["Do Nothing<br>(Preserve User's Manual Pause)"]

    K["YouTube Navigation<br>(yt-navigate-finish)"] --> L["bindVideo() & reset State"]
    M["MutationObserver<br>(#movie_player)"] --> N["trySkipAd()"]

    style G fill:#ef4444,color:#fff
    style I fill:#10b981,color:#fff
    style J fill:#6b7280,color:#fff
```

---

## 📂 Directory Structure

```
youtube-extention/
├── assets/
│   └── banner.png       # High-resolution project header banner
├── icons/
│   ├── icon16.png       # 16x16 Extension toolbar icon
│   ├── icon48.png       # 48x48 Extension management icon
│   └── icon128.png      # 128x128 Web Store display icon
├── manifest.json        # Manifest V3 extension definition
├── background.js        # Minimal service worker (default storage init)
├── content.js           # Core engine: event listeners, state machine, ad skipper
├── popup.html           # Dark-themed extension control popup
├── popup.js             # Live storage sync & toggle controller
├── popup.css            # Glassmorphic UI styles
└── README.md            # Repository documentation
```

---

## 🛠️ Installation Guide (Unpacked Extension)

1. **Clone or Download** this repository:
   ```bash
   git clone https://github.com/yugsuthar208/youtube-extention.git
   ```
2. Open **Google Chrome** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `youtube-extention` directory.
5. Open any video on [YouTube](https://www.youtube.com) and experience automatic focus pausing!

---

## 🔐 Permissions Explanation

| Permission | Purpose |
|---|---|
| `storage` | Persists user enable/disable toggle setting across sessions via `chrome.storage.sync`. |
| `host_permissions` (`*://*.youtube.com/*`) | Allows content script injection strictly on YouTube domains. No access to other websites. |

*No `tabs` or invasive permissions requested — operates entirely within content script scope.*

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
