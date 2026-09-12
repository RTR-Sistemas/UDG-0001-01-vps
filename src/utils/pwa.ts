/**
 * =============================================================================
 * File: src/utils/pwa.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
