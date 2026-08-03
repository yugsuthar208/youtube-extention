/**
 * YouTube Focus Pause — Content Script
 *
 * Manages automatic pause/resume of YouTube videos based on tab visibility
 * and window focus. Uses a state-machine approach to prevent race conditions
 * and correctly distinguish extension-triggered pauses from user-triggered ones.
 *
 * Architecture:
 *   - Page Visibility API (visibilitychange) handles tab switches + minimize/restore
 *   - window focus/blur handles OS-level Alt-Tab (Chrome losing/regaining focus)
 *   - These two together cover all five pause/resume triggers without needing
 *     chrome.tabs or chrome.windows APIs
 *   - MutationObserver + yt-navigate-finish event handle YouTube SPA navigation
 *   - A scoped observer on #movie_player catches dynamic video element changes
 *
 * State Machine (per video element):
 *   IDLE          → video is playing normally, extension hasn't intervened
 *   AUTO_PAUSED   → extension paused the video (user switched away)
 *   USER_PAUSED   → user manually paused; extension will NOT auto-resume
 *
 * The key insight: we set a flag (`_yfpProgrammatic`) on the video element
 * immediately before calling .pause() or .play(). The pause/play event listeners
 * check this flag to distinguish extension actions from user actions.
 */

;(() => {
  'use strict';

  // ─── Guard: prevent double-injection ───────────────────────────────────────
  if (window.__ytFocusPauseInjected) return;
  window.__ytFocusPauseInjected = true;

  // ─── Constants ─────────────────────────────────────────────────────────────
  const STATES = Object.freeze({
    IDLE: 'IDLE',               // Playing normally
    AUTO_PAUSED: 'AUTO_PAUSED', // Extension paused it
    USER_PAUSED: 'USER_PAUSED', // User manually paused
  });

  // ─── Extension state ──────────────────────────────────────────────────────
  let enabled = true;           // Mirrors chrome.storage.sync "enabled"
  let currentVideo = null;      // Reference to the active <video> element
  let videoState = STATES.IDLE; // Current state-machine state
  let playerObserver = null;    // MutationObserver on #movie_player
  let adObserver = null;        // MutationObserver for ad skip button

  // ─── Storage: read initial state & listen for live changes ─────────────────
  chrome.storage.sync.get({ enabled: true }, (result) => {
    enabled = result.enabled;
    if (enabled) {
      init();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.enabled) return;

    const wasEnabled = enabled;
    enabled = changes.enabled.newValue;

    if (enabled && !wasEnabled) {
      // Turned ON → initialize
      init();
    } else if (!enabled && wasEnabled) {
      // Turned OFF → if we're currently holding a video auto-paused, resume it
      if (videoState === STATES.AUTO_PAUSED && currentVideo) {
        programmaticPlay(currentVideo);
      }
      videoState = STATES.IDLE;
      teardown();
    }
  });

  // ─── Programmatic play/pause with flag ─────────────────────────────────────
  // These functions set a flag on the video element so our event listeners
  // can distinguish extension-triggered play/pause from user-triggered ones.

  function programmaticPause(video) {
    if (!video || video.paused) return;
    video._yfpProgrammatic = true;
    video.pause();
    // Flag is cleared in the 'pause' event handler
  }

  function programmaticPlay(video) {
    if (!video || !video.paused) return;
    video._yfpProgrammatic = true;
    // video.play() returns a Promise; catch autoplay-policy rejections silently
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Silently swallow autoplay policy errors
        // (e.g. user hasn't interacted with the page yet)
      });
    }
    // Flag is cleared in the 'play'/'playing' event handler
  }

  // ─── Video event handlers ─────────────────────────────────────────────────
  // Bound to the <video> element to track user-initiated play/pause

  function onVideoPause() {
    if (!enabled) return;

    if (currentVideo && currentVideo._yfpProgrammatic) {
      // This pause was triggered by us — update state and clear the flag
      currentVideo._yfpProgrammatic = false;
      videoState = STATES.AUTO_PAUSED;
    } else {
      // User manually paused — mark as user-paused so we don't auto-resume
      videoState = STATES.USER_PAUSED;
    }
  }

  function onVideoPlay() {
    if (!enabled) return;

    if (currentVideo && currentVideo._yfpProgrammatic) {
      // This play was triggered by us (auto-resume) — back to idle
      currentVideo._yfpProgrammatic = false;
      videoState = STATES.IDLE;
    } else {
      // User manually resumed (or YouTube auto-started a new video)
      // Either way, back to idle — the user is in control
      videoState = STATES.IDLE;
    }
  }

  // ─── Visibility & focus handlers ──────────────────────────────────────────
  // These two handlers together cover all five pause/resume triggers:
  //   1. Tab switch → visibilitychange fires (hidden/visible)
  //   2. Alt-Tab to another app → window blur/focus fires
  //   3. Minimize/restore → visibilitychange fires (hidden/visible)

  function shouldBePaused() {
    // Video should be paused if the page is hidden OR the window isn't focused
    return document.visibilityState === 'hidden' || !document.hasFocus();
  }

  function handleVisibilityOrFocus() {
    if (!enabled || !currentVideo) return;

    if (shouldBePaused()) {
      // User left — pause if video is currently playing
      if (!currentVideo.paused && videoState === STATES.IDLE) {
        programmaticPause(currentVideo);
      }
    } else {
      // User returned — resume only if WE paused it
      if (videoState === STATES.AUTO_PAUSED) {
        programmaticPlay(currentVideo);
      }
    }
  }

  // Small debounce to prevent rapid fire from overlapping visibility+focus events
  let visibilityTimer = null;
  function debouncedVisibilityHandler() {
    clearTimeout(visibilityTimer);
    visibilityTimer = setTimeout(handleVisibilityOrFocus, 50);
  }

  // ─── Video element binding ────────────────────────────────────────────────
  // Cleanly unbinds old listeners before binding new ones to prevent leaks

  function bindVideo(video) {
    if (!video) return;

    // Unbind previous video if different
    if (currentVideo && currentVideo !== video) {
      unbindVideo();
    }

    if (currentVideo === video) return; // Already bound

    currentVideo = video;
    videoState = video.paused ? STATES.USER_PAUSED : STATES.IDLE;

    video.addEventListener('pause', onVideoPause);
    video.addEventListener('play', onVideoPlay);
    video.addEventListener('playing', onVideoPlay);
  }

  function unbindVideo() {
    if (!currentVideo) return;

    currentVideo.removeEventListener('pause', onVideoPause);
    currentVideo.removeEventListener('play', onVideoPlay);
    currentVideo.removeEventListener('playing', onVideoPlay);
    currentVideo._yfpProgrammatic = false;
    currentVideo = null;
    videoState = STATES.IDLE;
  }

  // ─── Video element discovery ──────────────────────────────────────────────
  // Finds the primary YouTube video element inside #movie_player

  function findAndBindVideo() {
    const player = document.querySelector('#movie_player');
    const video = player
      ? player.querySelector('video')
      : document.querySelector('video');

    if (video) {
      bindVideo(video);
    }
  }

  // ─── Ad skip observer ────────────────────────────────────────────────────
  // Watches for YouTube's "Skip Ad" button and clicks it automatically.
  // Only targets the DOM skip button — does NOT block or shorten non-skippable ads.

  function trySkipAd() {
    // YouTube has multiple possible skip button selectors across different layouts
    const skipSelectors = [
      '.ytp-skip-ad-button',           // Standard skip button
      '.ytp-ad-skip-button',           // Alternate class
      '.ytp-ad-skip-button-modern',    // Modern redesign
      'button.ytp-ad-skip-button',     // Button element variant
      '.ytp-ad-skip-button-slot button', // Slot-based layout
    ];

    for (const selector of skipSelectors) {
      const btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) {
        // Button exists and is visible — click it
        btn.click();
        return true;
      }
    }
    return false;
  }

  function startAdObserver() {
    if (adObserver) return; // Already running

    const target = document.querySelector('#movie_player') || document.body;

    adObserver = new MutationObserver(() => {
      trySkipAd();
    });

    adObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // Also try immediately in case a skip button is already visible
    trySkipAd();
  }

  function stopAdObserver() {
    if (adObserver) {
      adObserver.disconnect();
      adObserver = null;
    }
  }

  // ─── Player MutationObserver ──────────────────────────────────────────────
  // Watches #movie_player for DOM changes that indicate a new <video> element
  // was inserted (e.g. playlist advancement, SPA navigation with new video)

  function startPlayerObserver() {
    if (playerObserver) return;

    const player = document.querySelector('#movie_player');
    if (!player) return;

    playerObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if any added nodes contain a video element
        for (const node of mutation.addedNodes) {
          if (node.nodeName === 'VIDEO') {
            bindVideo(node);
            return;
          }
          if (node.nodeType === Node.ELEMENT_NODE && node.querySelector) {
            const video = node.querySelector('video');
            if (video) {
              bindVideo(video);
              return;
            }
          }
        }
      }
    });

    playerObserver.observe(player, {
      childList: true,
      subtree: true,
    });
  }

  function stopPlayerObserver() {
    if (playerObserver) {
      playerObserver.disconnect();
      playerObserver = null;
    }
  }

  // ─── SPA navigation handler ───────────────────────────────────────────────
  // YouTube is a single-page app — it dispatches 'yt-navigate-finish' after
  // internal navigation. We re-discover the video element each time.

  function onYTNavigate() {
    // Brief delay to let the new page's player DOM settle
    setTimeout(() => {
      findAndBindVideo();
      startPlayerObserver();
      startAdObserver();
    }, 500);
  }

  // ─── Init / Teardown ─────────────────────────────────────────────────────

  function init() {
    // Bind visibility & focus listeners
    document.addEventListener('visibilitychange', debouncedVisibilityHandler);
    window.addEventListener('focus', debouncedVisibilityHandler);
    window.addEventListener('blur', debouncedVisibilityHandler);

    // Listen for YouTube SPA navigation
    document.addEventListener('yt-navigate-finish', onYTNavigate);

    // Find and bind the current video element
    findAndBindVideo();

    // Start observers
    startPlayerObserver();
    startAdObserver();

    // If the page is already hidden/blurred when the script loads, pause
    if (shouldBePaused() && currentVideo && !currentVideo.paused) {
      programmaticPause(currentVideo);
    }
  }

  function teardown() {
    // Remove all event listeners
    document.removeEventListener('visibilitychange', debouncedVisibilityHandler);
    window.removeEventListener('focus', debouncedVisibilityHandler);
    window.removeEventListener('blur', debouncedVisibilityHandler);
    document.removeEventListener('yt-navigate-finish', onYTNavigate);

    // Stop observers
    stopPlayerObserver();
    stopAdObserver();

    // Unbind video
    unbindVideo();

    // Clear debounce timer
    clearTimeout(visibilityTimer);
  }

  // ─── Fallback: wait for #movie_player if it doesn't exist yet ─────────────
  // On initial page load, the player might not be in the DOM yet.
  // We use a temporary observer on <body> to wait for it.

  if (!document.querySelector('#movie_player')) {
    const bodyObserver = new MutationObserver(() => {
      if (document.querySelector('#movie_player')) {
        bodyObserver.disconnect();
        if (enabled) {
          findAndBindVideo();
          startPlayerObserver();
          startAdObserver();
        }
      }
    });

    bodyObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
})();
