/**
 * =============================================================================
 * File: src/hooks/useMovementStatus.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useEffect, useState } from "react";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export type MovementStatus = "hidden" | "stopped" | "walking" | "traveling";

const STORAGE_KEY = "movement_status_enabled";

function getInitialEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true; // padrão: ligado
  return stored === "true";
}

export function setMovementStatusEnabled(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent("movement-visibility-changed", {
      detail: { enabled: value },
    })
  );
}

export function useMovementStatus() {
  const [enabled, setEnabled] = useState<boolean>(() => getInitialEnabled());
  const [status, setStatus] = useState<MovementStatus>("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setEnabled(event.newValue !== "false");
      }
    };

    const handleCustom = (event: Event) => {
      const custom = event as CustomEvent<{ enabled: boolean }>;
      if (typeof custom.detail?.enabled === "boolean") {
        setEnabled(custom.detail.enabled);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("movement-visibility-changed", handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("movement-visibility-changed", handleCustom);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("hidden");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("hidden");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!enabled) {
          setStatus("hidden");
          return;
        }

        const speedMs = position.coords.speed ?? 0;
        const speedKmh = speedMs * 3.6;

        if (isNaN(speedKmh)) {
          setStatus("hidden");
          return;
        }

        if (speedKmh < 2) {
          setStatus("stopped");
        } else if (speedKmh < 25) {
          setStatus("walking");
        } else {
          setStatus("traveling");
        }
      },
      () => {
        setStatus("hidden");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  const toggleEnabled = (value: boolean) => {
    setMovementStatusEnabled(value);
    setEnabled(value);
    if (!value) {
      setStatus("hidden");
    }
  };

  return { status, enabled, setEnabled: toggleEnabled };
}
