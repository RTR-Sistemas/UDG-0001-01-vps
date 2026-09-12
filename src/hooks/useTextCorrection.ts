import { useCallback, useState } from "react";
import { callBackend } from "@/lib/backendApi";

export interface TextCorrectionIssue {
  message: string;
  shortMessage: string;
  original: string;
  replacement: string;
  ruleId: string | null;
  category: string | null;
}

export interface TextCorrectionResult {
  success: boolean;
  originalText: string;
  correctedText: string;
  hasErrors: boolean;
  issuesCount: number;
  issues: TextCorrectionIssue[];
  language: string;
  languageName: string;
  warning?: string;
}

export function useTextCorrection() {
  const [isChecking, setIsChecking] = useState(false);

  const correctText = useCallback(
    async (text: string, lang?: string): Promise<TextCorrectionResult | null> => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      setIsChecking(true);
      try {
        const result = await callBackend<TextCorrectionResult>(
          "correct-text",
          { text: trimmed, lang },
          { timeoutMs: 12000 }
        );
        return result?.success ? result : null;
      } catch (err) {
        console.warn("Correção de texto indisponível:", (err as Error)?.message);
        return null;
      } finally {
        setIsChecking(false);
      }
    },
    []
  );

  return { correctText, isChecking };
}