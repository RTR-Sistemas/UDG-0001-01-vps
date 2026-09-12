/**
 * =============================================================================
 * File: src/utils/stealthDetector.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

// Universal Stealth Mode - Detect platform and setup reveal listeners

export type Platform = "android" | "ios" | "windows" | "mac" | "linux" | "unknown";

export function detectCurrentPlatform(): Platform {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (/android/.test(userAgent)) {
    return "android";
  }
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "ios";
  }
  
  if (/mac/.test(platform)) {
    return "mac";
  }
  
  if (/win/.test(platform)) {
    return "windows";
  }
  
  if (/linux/.test(platform)) {
    return "linux";
  }
  
  return "unknown";
}

export function setupRevealListeners(onReveal: (code: string) => void) {
  const platform = detectCurrentPlatform();
  
  // For web-based platforms (Windows, Mac, Linux) - use calculator sequence
  if (platform === "windows" || platform === "mac" || platform === "linux") {
    setupCalculatorListener(onReveal);
  }
  
  // For mobile platforms - detect URL schemes
  if (platform === "android" || platform === "ios") {
    setupMobileListener(onReveal, platform);
  }
}

function setupCalculatorListener(onReveal: (code: string) => void) {
  let sequence = "";
  let lastKeyTime = 0;
  
  const handleKeyPress = (e: KeyboardEvent) => {
    const currentTime = Date.now();
    
    // Reset sequence if more than 2 seconds passed
    if (currentTime - lastKeyTime > 2000) {
      sequence = "";
    }
    
    lastKeyTime = currentTime;
    
    // Only track number keys
    if (/^[0-9]$/.test(e.key)) {
      sequence += e.key;
      
      // Check if we have 6 digits
      if (sequence.length === 6) {
        onReveal(sequence);
        sequence = "";
      }
      
      // Prevent sequence from getting too long
      if (sequence.length > 6) {
        sequence = sequence.slice(-6);
      }
    }
  };
  
  window.addEventListener("keydown", handleKeyPress);
  
  return () => {
    window.removeEventListener("keydown", handleKeyPress);
  };
}

function setupMobileListener(onReveal: (code: string) => void, platform: Platform) {
  // For mobile, we'll use URL parameters
  // The app can be revealed by opening: app://reveal?code=123456
  
  const checkUrlForRevealCode = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("reveal");
    
    if (code && code.length === 6) {
      onReveal(code);
      
      // Clear the URL parameter
      const url = new URL(window.location.href);
      url.searchParams.delete("reveal");
      window.history.replaceState({}, "", url);
    }
  };
  
  // Check on load
  checkUrlForRevealCode();
  
  // Check on focus (when returning to app)
  window.addEventListener("focus", checkUrlForRevealCode);
  
  return () => {
    window.removeEventListener("focus", checkUrlForRevealCode);
  };
}

export function activateUniversalStealthMode(
  pin: string,
  onReveal: () => void
) {
  const cleanup = setupRevealListeners((code) => {
    if (code === pin) {
      onReveal();
    }
  });
  
  return cleanup;
}

export function hidePWAOnAllPlatforms() {
  // Hide the app UI
  const root = document.getElementById("root");
  if (root) {
    root.style.display = "none";
  }
  
  // Change document title to generic
  document.title = "New Tab";
  
  // Change or remove favicon
  const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  if (favicon) {
    favicon.href = "data:,";
  }
  
  // Add meta tags to prevent indexing
  const meta = document.createElement("meta");
  meta.name = "robots";
  meta.content = "noindex, nofollow";
  document.head.appendChild(meta);
}

export function revealHiddenApp() {
  const root = document.getElementById("root");
  if (root) {
    root.style.display = "block";
  }
  
  // Restore title
  document.title = "sistemasrtr";
  
  // Restore favicon
  const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
  if (favicon) {
    favicon.href = "/favicon.ico";
  }
  
  // Remove robots meta
  const robotsMeta = document.querySelector("meta[name='robots']");
  if (robotsMeta) {
    robotsMeta.remove();
  }
}
