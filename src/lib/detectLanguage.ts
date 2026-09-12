/**
 * =============================================================================
 * File: src/lib/detectLanguage.ts
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { franc } from "franc";
import langs from "langs";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export type LangDetect = { code3: string; iso2?: string; name?: string } | null;

export function detectLanguage(text: string): LangDetect {
  if (!text || !text.trim()) return null;
  const code3 = franc(text, { minLength: 10 });
  if (code3 === "und") return null;
  try {
    const l = langs.where("3", code3);
    return { code3, iso2: (l as any)["1"], name: (l as any).name };
  } catch {
    return { code3 };
  }
}
