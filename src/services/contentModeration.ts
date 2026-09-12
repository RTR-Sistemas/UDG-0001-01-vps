/**
 * Content Moderation Service
 * Usa a função serverless (moderate_content) para detectar conteúdo proibido
 * (nudez, violência, discurso de ódio) e loga para auditoria de admin.
 */

import { supabase } from "@/integrations/supabase/client";

async function callModeration(body: Record<string, unknown>) {
  // ATUALIZADO EM 06/09/2026: a função de moderação passou a exigir o token do
  // usuário (antes era pública e aceitava qualquer userId enviado pelo cliente).
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  } catch {
    /* sem sessão: a função responde 401 e o chamador trata como pendente */
  }

  const res = await fetch("/api/moderate_content", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || `moderate_http_${res.status}`);
  }
  return res.json();
}

export type ModerationSeverity = "low" | "medium" | "high" | "critical";
export type ModerationAction = "allowed" | "blocked" | "pending_review";

export interface ModerationResult {
    allowed: boolean;
    action: ModerationAction;
    severity: ModerationSeverity;
    labels: Record<string, number>;
    reason?: string;
}

/**
 * Analyzes an image URL using Supabase Edge Function (HuggingFace)
 */
export async function moderateImageUrl(
    imageUrl: string,
    userId?: string,
    postId?: string
): Promise<ModerationResult> {
    const defaultResult: ModerationResult = {
        allowed: true,
        action: "allowed",
        severity: "low",
        labels: {},
    };

    try {
        const data = await callModeration({ action: 'moderate_image', imageUrl, userId, postId });

        if (data.error) {
            console.warn("[Moderation] Erro retornado pela função:", data.error);
            return { ...defaultResult, action: "pending_review", reason: "Moderation Error" };
        }

        return data as ModerationResult;
    } catch (error) {
        console.error("[Moderation] Erro de rede ou CORS:", error);
        return { ...defaultResult, action: "pending_review" };
    }
}

/**
 * Analyzes text for hate speech and offensive content using Supabase Edge Function
 */
export async function moderateText(
    text: string,
    userId?: string,
    postId?: string
): Promise<ModerationResult> {
    const defaultResult: ModerationResult = {
        allowed: true,
        action: "allowed",
        severity: "low",
        labels: {},
    };

    if (!text?.trim()) return defaultResult;

    try {
        const data = await callModeration({ action: 'moderate_text', text, userId, postId });

        if (data?.error) {
            return defaultResult; // If error on text, usually we just allow to not block user flow entirely
        }

        return data as ModerationResult;
    } catch {
        return defaultResult;
    }
}

/**
 * Full post moderation: check all images and text content
 */
export async function moderatePost(params: {
    content?: string;
    mediaUrls?: string[];
    userId?: string;
}): Promise<{ allowed: boolean; reason?: string; flaggedItems: ModerationResult[] }> {
    const flaggedItems: ModerationResult[] = [];

    // Moderate text
    if (params.content?.trim()) {
        const textResult = await moderateText(params.content, params.userId);
        if (textResult.severity !== "low") flaggedItems.push(textResult);
        if (!textResult.allowed) return { allowed: false, reason: textResult.reason, flaggedItems };
    }

    // Moderate each image
    for (const url of params.mediaUrls || []) {
        const ext = url.split("?")[0].toLowerCase();
        const isImage = ext.endsWith(".jpg") || ext.endsWith(".jpeg") ||
            ext.endsWith(".png") || ext.endsWith(".webp") || ext.endsWith(".gif");
        if (isImage) {
            const imgResult = await moderateImageUrl(url, params.userId);
            if (imgResult.severity !== "low") flaggedItems.push(imgResult);
            if (!imgResult.allowed) return { allowed: false, reason: imgResult.reason, flaggedItems };
        }
    }

    return { allowed: true, flaggedItems };
}
