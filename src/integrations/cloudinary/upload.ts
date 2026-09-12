/**
 * =============================================================================
 * File: src/integrations/cloudinary/upload.ts
 * Purpose: Upload de arquivos para o Cloudinary com suporte a upload assinado.
 *
 * FIX (A2-DEBUGGER): Removido hack de iframe cross-origin que causava
 * "Failed to fetch" em produção. Substituído por XMLHttpRequest nativo
 * que funciona em todos os contextos (web, PWA, Capacitor).
 * =============================================================================
 */

import { supabase } from "@/integrations/supabase/client";

// -----------------------------------------------------------------------------
// SECTION: Types
// -----------------------------------------------------------------------------

export type CloudinaryUploadKind =
  | "posts"
  | "messages"
  | "profiles"
  | "communities"
  | "debates"
  | "stories"
  | "ads"
  | "misc";

type SignResponse = {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  folder: string;
  timestamp: number;
  signature: string;
};

async function getSupabaseAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

function safeJsonParse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Resposta inválida do servidor (JSON)");
  }
}

function defaultFolder(kind: CloudinaryUploadKind, userId?: string) {
  const parts = [] as string[];
  if (kind && kind !== "misc") parts.push(kind);
  if (userId) parts.push(userId);
  return parts.join("/");
}

/**
 * A2-DEBUGGER FIX: Upload via XMLHttpRequest nativo.
 * Elimina o problema do iframe cross-origin que falhava em produção
 * com "Failed to fetch" ou retornava undefined como fetch function.
 */
function uploadViaXHR(
  url: string,
  formData: FormData,
  onProgress?: (pct: number) => void
): Promise<{ ok: boolean; status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener("load", () => {
      let json: any = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // ignore parse error
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Falha de rede ao fazer upload. Verifique sua conexão."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelado."));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Timeout no upload. O arquivo pode ser muito grande ou a conexão está lenta."));
    });

    // Timeout generoso para vídeos grandes: 5 minutos
    xhr.timeout = 5 * 60 * 1000;

    xhr.send(formData);
  });
}

export async function uploadToCloudinary(
  file: File,
  opts?: {
    kind?: CloudinaryUploadKind;
    folder?: string;
    userId?: string;
    publicId?: string;
    onProgress?: (pct: number) => void;
  }
): Promise<{ url: string; publicId?: string; bytes?: number; resourceType?: string }> {
  const kind = opts?.kind || "misc";
  const folder = opts?.folder || defaultFolder(kind, opts?.userId);

  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new Error("Usuário não autenticado. Faça login e tente novamente.");
  }

  const unsignedCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
  const unsignedPreset = (
    import.meta.env.VITE_CLOUDINARY_UNSIGNED_UPLOAD_PRESET ||
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  ) as string | undefined;
  const unsignedBaseFolder = (import.meta.env.VITE_CLOUDINARY_FOLDER || "") as string;

  // 1) Pede assinatura no backend (Netlify Function)
  let signed: SignResponse | null = null;
  try {
    const signRes = await fetch("/api/cloudinary-sign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ folder, public_id: opts?.publicId }),
    });

    if (!signRes.ok) {
      // 404 = servidor de funções fora do ar em dev (fallback para unsigned)
      if (signRes.status !== 404) {
        const txt = await signRes.text().catch(() => "");
        const err = txt ? safeJsonParse<{ error?: string }>(txt).error : null;
        throw new Error(err || `Falha ao assinar upload (${signRes.status})`);
      }
    } else {
      signed = (await signRes.json()) as SignResponse;
    }
  } catch (e: any) {
    // Falha de rede ao chamar a função de assinatura -> tenta unsigned
    if (e.message?.includes("assinar upload")) throw e;
    signed = null;
  }

  // 2) Valida fallback unsigned
  if (!signed) {
    if (!unsignedCloudName || !unsignedPreset) {
      throw new Error(
        "Serviço de upload temporariamente indisponível. Tente novamente em instantes."
      );
    }
  }

  // 3) Monta FormData
  const cloudName = signed?.cloudName || unsignedCloudName;
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const form = new FormData();
  form.append("file", file);

  if (signed) {
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("signature", signed.signature);
    form.append("upload_preset", signed.uploadPreset);
    form.append("folder", signed.folder);
    if (opts?.publicId) form.append("public_id", opts.publicId);
  } else {
    form.append("upload_preset", unsignedPreset!);
    const base = unsignedBaseFolder ? unsignedBaseFolder.replace(/\/+$/, "") : "";
    const sub = folder ? folder.replace(/^\/+/, "") : "";
    const finalFolder = base ? (sub ? `${base}/${sub}` : base) : sub;
    if (finalFolder) form.append("folder", finalFolder);
    if (opts?.publicId) form.append("public_id", opts.publicId);
  }

  // 4) A2-DEBUGGER FIX: usar XMLHttpRequest nativo (sem iframe hack)
  const result = await uploadViaXHR(endpoint, form, opts?.onProgress);

  if (!result.ok) {
    const msg = result.json?.error?.message || `Erro no upload (${result.status}). Tente novamente.`;
    throw new Error(msg);
  }

  const url: string | undefined = result.json?.secure_url || result.json?.url;
  if (!url) throw new Error("Upload concluído, mas URL não foi retornada. Contate o suporte.");

  return {
    url,
    publicId: result.json?.public_id,
    bytes: result.json?.bytes,
    resourceType: result.json?.resource_type,
  };
}

export function blobToFile(blob: Blob, filename: string, mime?: string) {
  return new File([blob], filename, { type: mime || blob.type || "application/octet-stream" });
}
