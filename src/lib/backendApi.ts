/**
 * =============================================================================
 * File: src/lib/backendApi.ts
 * Purpose: Ponto único de chamada às funções de backend do UndoinG.
 *
 * ATUALIZADO EM 06/09/2026 — SAÍDA DEFINITIVA DA NETLIFY
 *   O projeto nasceu na Netlify. Hoje TUDO roda no VPS próprio (Hostinger):
 *   o nginx entrega o site e faz proxy de /api/ para o runtime de funções
 *   (deploy/server.mjs, porta 8788), que carrega os arquivos de
 *   netlify/functions/ — o nome da pasta ficou por compatibilidade, mas nada
 *   ali depende da Netlify.
 *
 *   Ordem de resolução do endereço:
 *     1. Mesma origem            → /api/<nome>        (o SEU servidor)
 *     2. Gateway externo         → VITE_API_URL/api/<nome>  (se configurado)
 *     3. Supabase Edge Function  → <projeto>/functions/v1/<nome>  (reserva)
 *
 *   O primeiro que responder vence, e o resultado fica memorizado durante a
 *   sessão. Não existe mais nenhum endereço da Netlify aqui.
 * =============================================================================
 */

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";
const API_BASE_URL: string = import.meta.env.VITE_API_URL || "";

/** Endpoint que funcionou por último, por função. Evita repetir tentativas. */
const preferredEndpoint = new Map<string, string>();

function buildCandidates(fnName: string): string[] {
  const urls: string[] = [];

  const remembered = preferredEndpoint.get(fnName);
  if (remembered) urls.push(remembered);

  // 1) O próprio servidor (VPS). É o caminho normal em produção e em dev
  //    (o vite.config.ts faz proxy de /api para o runtime local na 8788).
  urls.push(`/api/${fnName}`);

  // 2) Gateway externo, se algum dia existir um domínio de API separado.
  if (API_BASE_URL) {
    urls.push(`${API_BASE_URL.replace(/\/$/, "")}/api/${fnName}`);
  }

  // 3) Supabase Edge Function como reserva (algumas funções vivem lá).
  if (SUPABASE_URL) {
    urls.push(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${fnName}`);
  }

  return Array.from(new Set(urls));
}

async function authHeaders(url: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  // O token do usuário vai em TODAS as chamadas: as funções do servidor
  // passaram a exigir identidade (nada de confiar num userId enviado pelo
  // cliente). As Edge Functions do Supabase exigem também a apikey.
  let token = "";
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch {
    /* sem sessão: a função decide se aceita anônimo */
  }

  if (url.includes("/functions/v1/")) {
    if (SUPABASE_ANON_KEY) headers.apikey = SUPABASE_ANON_KEY;
    if (!token) token = SUPABASE_ANON_KEY;
  }

  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export interface CallBackendOptions {
  /** Tempo máximo de espera por tentativa (ms). Padrão: 60s. */
  timeoutMs?: number;
  /**
   * Valida a resposta já convertida em JSON. Se devolver false, o helper
   * considera a tentativa como falha e passa para o próximo endpoint.
   */
  isValid?: (data: any) => boolean;
}

export class BackendError extends Error {
  constructor(message: string, public readonly detail?: unknown) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * Chama uma função de backend pelo nome (ex.: "voice-clone-translate"),
 * tentando todos os endereços conhecidos até um responder.
 */
export async function callBackend<T = any>(
  fnName: string,
  body: unknown,
  options: CallBackendOptions = {},
): Promise<T> {
  const { timeoutMs = 60000, isValid } = options;
  const candidates = buildCandidates(fnName);

  let lastError: Error | null = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: await authHeaders(url),
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });

      // 404/405 = função não existe nesse host. Vai para o próximo.
      if (response.status === 404 || response.status === 405) {
        lastError = new BackendError(`Função "${fnName}" não existe em ${url}`);
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Hospedagem SPA devolvendo index.html no lugar da função.
        lastError = new BackendError(`Resposta inválida de ${url}`);
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        lastError = new BackendError(
          data?.message || data?.error || `Erro ${response.status}`,
          data,
        );
        continue;
      }

      if (isValid && !isValid(data)) {
        // Respondeu, mas com um resultado inutilizável: tenta o próximo host.
        lastError = new BackendError(
          data?.message || data?.error || `Resposta incompleta de ${url}`,
          data,
        );
        continue;
      }

      preferredEndpoint.set(fnName, url);
      return data as T;
    } catch (error: any) {
      lastError = error instanceof Error ? error : new BackendError(String(error));
    }
  }

  throw lastError ||
    new BackendError(`Nenhum servidor respondeu à função "${fnName}".`);
}

/** true quando existe pelo menos um backend configurado. */
export function hasBackend(): boolean {
  return Boolean(SUPABASE_URL || API_BASE_URL);
}
