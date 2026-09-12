/**
 * =============================================================================
 * Edge Function: correct-text
 * Correção de ortografia/gramática das mensagens do chat (LanguageTool, grátis).
 *
 * Entrada:  { text: "...", lang?: "pt-BR" }
 * Saída:    { success, originalText, correctedText, hasErrors, issuesCount,
 *             issues[], language, languageName, warning? }
 *
 * Nunca falha de forma "dura": se o serviço estiver fora, devolve o texto
 * original com hasErrors=false, para a digitação nunca travar.
 * =============================================================================
 */

import {
  detectLanguageFromText,
  fetchWithTimeout,
  getLanguageInfo,
  json,
  normalizeLang,
  preflight,
} from "../_shared/dubbing.ts";

const LT_LOCALE: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es",
  fr: "fr",
  de: "de-DE",
  it: "it",
  nl: "nl",
  pl: "pl-PL",
  ru: "ru-RU",
};

interface LtMatch {
  message?: string;
  shortMessage?: string;
  offset: number;
  length: number;
  replacements?: { value: string }[];
  rule?: { id?: string; category?: { name?: string } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ success: false, error: "Use POST." }, 405);

  const body = await req.json().catch(() => ({}));
  const rawText = typeof body?.text === "string" ? body.text.trim() : "";

  if (!rawText) {
    return json({ success: false, error: "Texto vazio.", originalText: "", correctedText: "" }, 400);
  }

  // Base de resposta segura — usada se algo der errado no caminho.
  const safe = (warning?: string) =>
    json({
      success: true,
      originalText: rawText,
      correctedText: rawText,
      hasErrors: false,
      issuesCount: 0,
      issues: [],
      language: "unknown",
      languageName: "Desconhecido",
      ...(warning ? { warning } : {}),
    });

  try {
    let code = normalizeLang(typeof body?.lang === "string" ? body.lang : undefined);
    if (code === "unknown") code = await detectLanguageFromText(rawText);
    if (code === "unknown") code = "pt";

    const locale = LT_LOCALE[code] || code;

    const params = new URLSearchParams({
      text: rawText.slice(0, 4000),
      language: locale,
      enabledOnly: "false",
    });

    const res = await fetchWithTimeout(
      "https://api.languagetool.org/v2/check",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: params.toString(),
      },
      8000,
    );

    if (!res.ok) return safe(`LanguageTool respondeu ${res.status}.`);

    const data = await res.json();
    const matches: LtMatch[] = Array.isArray(data?.matches) ? data.matches : [];

    // Aplica as substituições de trás para frente, para não bagunçar os offsets.
    const applicable = matches
      .filter((m) => m.replacements?.length && m.replacements[0].value)
      .sort((a, b) => b.offset - a.offset);

    let corrected = rawText;
    const issues = [];

    for (const m of applicable) {
      const original = rawText.slice(m.offset, m.offset + m.length);
      const replacement = m.replacements![0].value;
      if (original === replacement) continue;

      corrected = corrected.slice(0, m.offset) + replacement + corrected.slice(m.offset + m.length);
      issues.push({
        message: m.message || "Possível erro.",
        shortMessage: m.shortMessage || m.message || "Correção sugerida",
        original,
        replacement,
        ruleId: m.rule?.id || null,
        category: m.rule?.category?.name || null,
      });
    }

    const info = getLanguageInfo(code);

    return json({
      success: true,
      originalText: rawText,
      correctedText: corrected,
      hasErrors: corrected !== rawText,
      issuesCount: issues.length,
      issues: issues.reverse(),
      language: info.code,
      languageName: info.name,
    });
  } catch (error) {
    return safe((error as Error)?.message);
  }
});
