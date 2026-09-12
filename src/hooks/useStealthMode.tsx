/**
 * =============================================================================
 * File: src/hooks/useStealthMode.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useEffect } from "react";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export interface StealthModeConfig {
  enabled: boolean;
  pin: string;
  isHidden: boolean;
}

const STORAGE_KEY = "stealth_mode_config";
const HIDDEN_KEY = "app_is_hidden";

export function useStealthMode() {
  const [config, setConfig] = useState<StealthModeConfig>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return { enabled: false, pin: "", isHidden: false };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    
    if (config.isHidden) {
      localStorage.setItem(HIDDEN_KEY, "true");
      document.title = "Nova Aba";
      const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (favicon) {
        favicon.href = "data:,";
      }
    } else {
      localStorage.removeItem(HIDDEN_KEY);
      document.title = "sistemasrtr";
      const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (favicon) {
        favicon.href = "/favicon.ico";
      }
    }
  }, [config]);

  const enableStealthMode = (pin: string) => {
    setConfig({ enabled: true, pin, isHidden: false });
  };

  const disableStealthMode = () => {
    setConfig({ enabled: false, pin: "", isHidden: false });
  };

  const toggleHidden = (enteredPin: string) => {
    if (!config.enabled) return false;
    if (enteredPin !== config.pin) return false;
    
    setConfig((prev) => ({ ...prev, isHidden: !prev.isHidden }));
    return true;
  };

  const reveal = (code: string) => {
    if (!config.enabled || !config.isHidden) return false;
    if (code !== config.pin) return false;
    
    setConfig((prev) => ({ ...prev, isHidden: false }));
    return true;
  };

  return {
    config,
    enableStealthMode,
    disableStealthMode,
    toggleHidden,
    reveal,
  };
}
