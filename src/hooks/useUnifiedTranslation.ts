import { useCallback, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  detectedLang?: string;
  error?: string;
  fromCache?: boolean;
}

/** Opções da dublagem de áudio. */
export interface TranslateAudioOptions {
  /** URL pública da amostra de voz do usuário (Cloudinary). */
  sampleAudioUrl?: string | null;
  /**
   * Quando true (padrão), o próprio áudio enviado é usado como amostra de voz.
   * Correto ao dublar a SUA gravação (voz do usuário).
   * Deve ser false ao dublar um áudio RECEBIDO (a voz é de outra pessoa).
   */
  useAudioAsSample?: boolean;
  /** Não exibe toast de erro (dublagem automática trata o erro na própria bolha). */
  silent?: boolean;
  /** Idioma de origem, quando já conhecido (pula a detecção no servidor). */
  sourceLang?: string;
  /** Timbre da voz de retaguarda quando a clonagem não entra. */
  gender?: 'female' | 'male';
  /** Desliga a tentativa de clonagem (fica só com a voz de retaguarda). */
  tryClone?: boolean;
  /**
   * Prazo da clonagem antes de cair para a outra voz (padrão 3000 ms).
   * O backend dispara a voz de retaguarda EM PARALELO, então esse prazo não
   * vira espera extra para o usuário.
   */
  cloneTimeoutMs?: number;
  /** Tempo máximo total da requisição (ms). Padrão: 60000. */
  timeoutMs?: number;
}

/** Prazo padrão da clonagem de voz — combinado com o backend. */
export const CLONE_DEADLINE_MS = 3000;

export interface AudioTranslationResult {
  success: boolean;
  originalText?: string;
  detectedLanguage?: string;
  detectedLanguageInfo?: LanguageInfo;
  translatedText?: string;
  targetLang?: string;
  targetLanguageInfo?: LanguageInfo;
  audio?: string;
  audioBase64?: string;
  mimeType?: string;
  method?: string;
  /** Nome amigável da voz usada ("Sua voz", "Camila", "Voz Edresson (pt-BR)"). */
  voice?: string;
  /** Provedor técnico que gerou o áudio (diagnóstico). */
  voiceProvider?: string;
  /** true quando houve tentativa de clonar a voz do usuário. */
  cloneAttempted?: boolean;
  /** true quando origem e destino são o mesmo idioma. */
  sameLanguage?: boolean;
  /** Tempo total do pipeline no servidor (ms). */
  elapsedMs?: number;
  message?: string;
  error?: string;
  status?: string;
}

export interface TextCorrectionResult {
  success: boolean;
  originalText: string;
  correctedText: string;
  hasErrors: boolean;
  issuesCount: number;
  issues: Array<{
    message: string;
    shortMessage: string;
    original: string;
    replacement: string;
    ruleId: string | null;
    category: string | null;
  }>;
  language: string;
  languageName: string;
  warning?: string;
}

const LANGUAGES: LanguageInfo[] = [
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'Inglês', flag: '🇺🇸' },
  { code: 'es', name: 'Espanhol', flag: '🇪🇸' },
  { code: 'fr', name: 'Francês', flag: '🇫🇷' },
  { code: 'de', name: 'Alemão', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Russo', flag: '🇷🇺' },
  { code: 'ja', name: 'Japonês', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinês', flag: '🇨🇳' },
  { code: 'ar', name: 'Árabe', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ko', name: 'Coreano', flag: '🇰🇷' },
  { code: 'nl', name: 'Holandês', flag: '🇳🇱' },
  { code: 'tr', name: 'Turco', flag: '🇹🇷' },
];

const CACHE_KEY_PREFIX = 'udg_translation_cache_';
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

function getCacheKey(text: string, targetLang: string, type: 'text' | 'audio'): string {
  const hash = btoa(text.slice(0, 100)).replace(/[+/=]/g, '').slice(0, 32);
  return `${CACHE_KEY_PREFIX}${type}_${targetLang}_${hash}`;
}

function getFromCache(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { value, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_MAX_AGE) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function setCache(key: string, value: string) {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_KEY_PREFIX));
    if (keys.length >= CACHE_MAX_ENTRIES) {
      keys.sort((a, b) => {
        const ta = JSON.parse(localStorage.getItem(a) || '{}').timestamp || 0;
        const tb = JSON.parse(localStorage.getItem(b) || '{}').timestamp || 0;
        return ta - tb;
      });
      localStorage.removeItem(keys[0]);
    }
    localStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY_STATIC = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Endpoints em ordem de preferência.
 * 1. Supabase Edge Functions (sempre disponíveis)
 * 2. Mesma origem — Netlify Functions legado
 * 3. undoing.com.br — retaguarda
 *
 * `translate-audio` é a função atual da dublagem. `voice-clone-translate` é a
 * versão anterior com MESMA entrada/saída.
 */
function getEndpoints(base: string): string[] {
  const aliases = base === 'translate-audio' ? ['voice-clone-translate'] : [];
  const names = [base, ...aliases];

  const list: string[] = [];

  // 1. Supabase Edge Functions (confiáveis, verify_jwt=false)
  if (SUPABASE_URL) {
    for (const name of names) {
      list.push(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`);
    }
  }

  // 2. Mesma origem (Netlify local)
  for (const name of names) {
    list.push(`/api/${name}`);
  }

  // 3. Domínio de produção
  for (const name of names) {
    list.push(`https://undoing.com.br/api/${name}`);
  }

  return list;
}

async function fetchWithFallback(
  endpoints: string[],
  options: RequestInit,
  getHeaders?: (url: string) => Promise<Record<string, string>>,
  timeoutMs = 60000,
): Promise<Response> {
  let lastError: Error | null = null;
  let onlyNotFound = endpoints.length > 0;

  for (const endpoint of endpoints) {
    try {
      const extraHeaders = getHeaders ? await getHeaders(endpoint) : {};
      const res = await fetch(endpoint, {
        ...options,
        headers: { ...(options.headers as Record<string, string>), ...extraHeaders },
        // 180s deixava o usuário olhando para um spinner que nunca acabava
        // quando um endpoint pendurava. O pipeline inteiro leva ~2-6s.
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;

      if (res.status === 404) {
        lastError = new Error('HTTP 404');
        continue; // função ausente aqui: tenta a próxima
      }

      onlyNotFound = false;
      // Aproveita a explicação do próprio servidor quando houver, em vez de
      // mostrar só o número do status.
      let detail = '';
      try {
        const text = await res.clone().text();
        const parsed = text ? JSON.parse(text) : null;
        detail = parsed?.message || parsed?.error || text.slice(0, 200);
      } catch {
        // corpo vazio ou não-JSON: fica só com o status
      }
      lastError = new Error(detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`);
    } catch (e: any) {
      onlyNotFound = false;
      lastError = e;
    }
  }

  if (onlyNotFound) {
    throw new Error('Este recurso não está publicado no servidor. É preciso enviar as Netlify Functions.');
  }
  throw lastError || new Error('Serviço indisponível');
}

/**
 * Diagnóstico rápido da dublagem — diz qual provedor de voz está de pé.
 * No navegador: `import('@/hooks/useUnifiedTranslation').then(m => m.checkDubbingHealth().then(console.log))`
 */
export async function checkDubbingHealth(): Promise<any> {
  const endpoints = getEndpoints('dubbing-health');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SUPABASE_ANON_KEY_STATIC) {
    headers.apikey = SUPABASE_ANON_KEY_STATIC;
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY_STATIC}`;
  }
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) return await res.json();
    } catch { /* tenta o próximo */ }
  }
  return { ok: false, error: 'Nenhum endpoint de diagnóstico respondeu.' };
}

export function useUnifiedTranslation(currentUserId?: string | null) {
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [isTranslatingAudio, setIsTranslatingAudio] = useState(false);
  const [isCorrectingText, setIsCorrectingText] = useState(false);
  const { toast } = useToast();
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const getAuthHeader = useCallback(async (url?: string): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    // Supabase Edge Functions precisam do apikey + Authorization
    if (url && url.includes('/functions/v1/')) {
      headers.apikey = SUPABASE_ANON_KEY;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        } else {
          headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
        }
      } catch {
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }
    } else {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      } catch { /* ignore */ }
    }
    return headers;
  }, [SUPABASE_ANON_KEY]);

  const translateText = useCallback(async (
    text: string,
    targetLang: string,
    sourceLang: string = 'auto'
  ): Promise<TranslationResult> => {
    if (!text.trim()) return { success: true, translatedText: text, detectedLang: sourceLang };

    const cacheKey = getCacheKey(text, targetLang, 'text');
    const cached = getFromCache(cacheKey);
    if (cached) return { success: true, translatedText: cached, detectedLang: sourceLang, fromCache: true };

    setIsTranslatingText(true);
    try {
      const endpoints = getEndpoints('translate');
      const res = await fetchWithFallback(endpoints, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang, sourceLang, type: 'translate' }),
      }, getAuthHeader);
      const data = await res.json();
      if (data.success && data.data?.translatedText) {
        setCache(cacheKey, data.data.translatedText);
        return { success: true, translatedText: data.data.translatedText, detectedLang: data.data.detectedLang };
      }
      return { success: false, error: data.error || 'Falha na tradução' };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setIsTranslatingText(false);
    }
  }, [getAuthHeader]);

  const translateAudio = useCallback(async (
    audioBlob: Blob,
    targetLang: string,
    originalText?: string,
    options: TranslateAudioOptions = {}
  ): Promise<AudioTranslationResult | null> => {
    const {
      sampleAudioUrl = null,
      useAudioAsSample = true,
      silent = false,
      sourceLang,
      gender,
      tryClone = true,
      cloneTimeoutMs = CLONE_DEADLINE_MS,
      timeoutMs = 60000,
    } = options;
    const notify = (args: Parameters<typeof toast>[0]) => { if (!silent) toast(args); };
    setIsTranslatingAudio(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      const base64Audio = await base64Promise;

      // Amostra de voz: a registrada pelo usuário quando existir. O próprio
      // áudio só serve de amostra quando é a gravação DELE (envio) — e nesse
      // caso mandamos apenas a FLAG, porque o servidor já tem esse áudio.
      // (Antes o base64 ia duplicado no corpo, dobrando o upload de cada
      //  mensagem de voz sem necessidade nenhuma.)
      const endpoints = getEndpoints('translate-audio');
      const res = await fetchWithFallback(endpoints, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          audio: base64Audio,
          targetLang,
          originalText,
          useAudioAsSample,
          tryClone,
          cloneTimeoutMs,
          ...(sourceLang ? { sourceLang } : {}),
          ...(gender ? { gender } : {}),
          ...(sampleAudioUrl ? { sampleAudioUrl } : {}),
        }),
      }, getAuthHeader, timeoutMs);

      let result: AudioTranslationResult;
      try {
        result = await res.json();
      } catch {
        throw new Error(`Erro na API (${res.status})`);
      }

      if (res.ok && result?.success) return result;

      // Falha tratada pela função (HTTP 200 + success:false): o CÓDIGO do erro
      // vem em `error` e a mensagem legível em `message`. Preserva os dois.
      const code = result?.error || `HTTP_${res.status}`;
      const message = result?.message || result?.error || `Erro na API (${res.status})`;
      const isVoiceSample = code === 'VOICE_SAMPLE_REQUIRED';

      notify({
        title: isVoiceSample ? 'Amostra de voz necessária' : 'Erro na dublagem',
        description: isVoiceSample
          ? 'Para dublar é preciso da sua voz. Grave uma amostra nos Ajustes do chat.'
          : message,
        variant: isVoiceSample ? undefined : 'destructive',
      });

      return { success: false, error: code, message };
    } catch (err: any) {
      const errMsg = err?.message || 'Erro desconhecido ao processar áudio';
      const isVoiceSample = errMsg.includes('VOICE_SAMPLE_REQUIRED');
      notify({
        title: isVoiceSample ? 'Amostra de voz necessária' : 'Erro na dublagem',
        description: isVoiceSample
          ? 'Para dublar é preciso da sua voz. Grave uma amostra nos Ajustes do chat.'
          : errMsg,
        variant: isVoiceSample ? undefined : 'destructive',
      });
      return {
        success: false,
        error: isVoiceSample ? 'VOICE_SAMPLE_REQUIRED' : errMsg,
        message: errMsg,
      };
    } finally {
      setIsTranslatingAudio(false);
    }
  }, [getAuthHeader, toast]);

  const correctText = useCallback(async (
    text: string,
    lang?: string
  ): Promise<TextCorrectionResult | null> => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 4) return null;

    setIsCorrectingText(true);
    try {
      const endpoints = getEndpoints('correct-text');
      const res = await fetchWithFallback(endpoints, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, lang }),
      }, getAuthHeader);
      const result = await res.json();
      if (!res.ok) return null;
      return result as TextCorrectionResult;
    } catch (err) {
      console.warn('Erro ao corrigir texto:', err);
      return null;
    } finally {
      setIsCorrectingText(false);
    }
  }, [getAuthHeader]);

  const detectLanguage = useCallback(async (text: string): Promise<string | null> => {
    try {
      const endpoints = getEndpoints('detect-translate');
      const res = await fetchWithFallback(endpoints, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 500), targetLanguage: 'pt' }),
      });
      const data = await res.json();
      return data.source_language || data.detectedLang || null;
    } catch {
      return null;
    }
  }, []);

  const getLanguageInfo = useCallback((code: string): LanguageInfo | undefined => {
    return LANGUAGES.find(l => l.code === code.split('-')[0].toLowerCase());
  }, []);

  const cancelAll = useCallback(() => {
    abortControllersRef.current.forEach(c => c.abort());
    abortControllersRef.current.clear();
  }, []);

  return {
    translateText,
    translateAudio,
    correctText,
    detectLanguage,
    getLanguageInfo,
    isTranslatingText,
    isTranslatingAudio,
    isCorrectingText,
    cancelAll,
    LANGUAGES,
  };
}