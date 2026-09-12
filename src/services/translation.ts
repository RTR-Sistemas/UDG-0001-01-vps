/**
 * =============================================================================
 * File: src/services/translation.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

// src/services/translation.ts

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export async function translateText(text: string, target: string) {
  const res = await fetch("/api/detect-translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLanguage: target }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `translate_http_${res.status}`);
  }
  return (await res.json()) as { translated: string; source_language: string | null };
}
