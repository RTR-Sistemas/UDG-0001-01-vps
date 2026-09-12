/**
 * =============================================================================
 * File: src/components/chat/AudioDubbingSheet.tsx
 * Purpose: Painel de revisão da mensagem de voz com dublagem.
 *
 * Substitui o painel antigo que ficava embutido no MessageInput.tsx. O que
 * mudou, na prática, para quem usa:
 *
 *   • DUAS OPÇÕES CLARAS, logo no topo, antes de qualquer coisa:
 *       1) "Meu idioma"  — dubla para o idioma que o usuário marcou como padrão
 *       2) "Outro idioma" — abre a lista de idiomas com busca
 *   • Uma barra de etapas mostra onde o processo está (Ouvindo → Traduzindo →
 *     Gerando voz), em vez de um "Processando…" opaco.
 *   • Os dois áudios (original e dublado) ficam lado a lado, com barra de
 *     progresso e um selo dizendo QUAL voz foi usada.
 *   • O texto reconhecido pode ser corrigido a qualquer momento e re-dublado
 *     com um toque — antes o campo sumia depois da primeira dublagem.
 *   • Os botões de ação ficam fixos no rodapé, com o "Enviar dublado" em
 *     destaque só quando existe dublagem pronta.
 * =============================================================================
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Languages,
  Loader2,
  Mic,
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DubbingLanguage {
  code: string;
  name: string;
  flag?: string;
}

export const DUBBING_LANGUAGES: DubbingLanguage[] = [
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "en", name: "Inglês", flag: "🇺🇸" },
  { code: "es", name: "Espanhol", flag: "🇪🇸" },
  { code: "fr", name: "Francês", flag: "🇫🇷" },
  { code: "de", name: "Alemão", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "ru", name: "Russo", flag: "🇷🇺" },
  { code: "ja", name: "Japonês", flag: "🇯🇵" },
  { code: "zh", name: "Chinês", flag: "🇨🇳" },
  { code: "ar", name: "Árabe", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ko", name: "Coreano", flag: "🇰🇷" },
  { code: "nl", name: "Holandês", flag: "🇳🇱" },
  { code: "tr", name: "Turco", flag: "🇹🇷" },
  { code: "pl", name: "Polonês", flag: "🇵🇱" },
];

export function findDubbingLanguage(code?: string | null): DubbingLanguage {
  const short = (code || "").split(/[-_]/)[0].toLowerCase();
  return (
    DUBBING_LANGUAGES.find((l) => l.code === short) || {
      code: short || "??",
      name: short ? short.toUpperCase() : "Idioma",
      flag: "🌐",
    }
  );
}

/** Etapa atual do pipeline, para a barra de progresso. */
export type DubbingStage = "idle" | "listening" | "translating" | "voicing" | "done" | "error";

const STAGES: { key: DubbingStage; label: string }[] = [
  { key: "listening", label: "Ouvindo" },
  { key: "translating", label: "Traduzindo" },
  { key: "voicing", label: "Gerando voz" },
];

export interface DubbingResultInfo {
  audio?: string;
  method?: string;
  voice?: string;
  originalText?: string;
  translatedText?: string;
  detectedLanguage?: string;
  sameLanguage?: boolean;
  elapsedMs?: number;
}

export interface AudioDubbingSheetProps {
  recordedBlob: Blob | null;
  /** Duração da gravação em segundos (só para exibição). */
  durationSec: number;
  /** Idioma que o usuário marcou como padrão dele. */
  myLanguage: string;
  /** Idioma de destino atualmente escolhido. */
  targetLang: string;
  onTargetLangChange: (code: string) => void;
  /** Texto reconhecido pelo navegador (editável). */
  transcript: string;
  onTranscriptChange: (value: string) => void;
  isProcessing: boolean;
  stage: DubbingStage;
  result: DubbingResultInfo | null;
  errorMessage: string | null;
  onDub: () => void;
  onSendOriginal: () => void;
  onSendDubbed: () => void;
  onCancel: () => void;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Selo com o nome da voz que gerou a dublagem. */
function VoiceBadge({ method, voice }: { method?: string; voice?: string }) {
  if (!method || method === "none") return null;

  const presets: Record<string, { label: string; className: string }> = {
    cloned: {
      label: `${voice || "Sua voz"} ✨`,
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    edresson: {
      label: `${voice || "Voz Edresson"} 🇧🇷`,
      className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30",
    },
    elevenlabs: {
      label: "Voz neural ✨",
      className: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30",
    },
    human: {
      label: `Voz ${voice || "humana"} 🎙️`,
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    },
    google: {
      label: "Voz Google 🔊",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
  };

  const preset = presets[method] || {
    label: voice || "Voz sintetizada",
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold border", preset.className)}>
      {preset.label}
    </span>
  );
}

/** Player compacto com barra de progresso. Aceita Blob ou data URI. */
function MiniPlayer({
  source,
  label,
  sublabel,
  accent,
  fallbackDuration,
}: {
  source: Blob | string | null;
  label: string;
  sublabel?: React.ReactNode;
  accent?: boolean;
  fallbackDuration?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration || 0);

  useEffect(() => {
    if (!source) {
      setUrl(null);
      return;
    }
    if (typeof source === "string") {
      setUrl(source);
      return;
    }
    const objectUrl = URL.createObjectURL(source);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [source]);

  // Troca de faixa: zera o estado para não herdar o progresso da anterior.
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    audioRef.current?.pause();
    audioRef.current = null;
  }, [url]);

  // Pausa ao desmontar (evita áudio tocando depois de fechar o painel).
  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);

  const toggle = () => {
    if (!url) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    const audio = audioRef.current || new Audio(url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.ontimeupdate = () => {
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      setProgress(total > 0 ? Math.min(100, (audio.currentTime / total) * 100) : 0);
    };
    audio.onended = () => { setPlaying(false); setProgress(0); };
    audio.onerror = () => { setPlaying(false); };
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-2 transition-colors",
        accent ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/20",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Button
          type="button"
          variant={accent ? "default" : "outline"}
          size="icon"
          className="h-9 w-9 rounded-full flex-shrink-0"
          onClick={toggle}
          disabled={!url}
          aria-label={playing ? `Pausar ${label}` : `Ouvir ${label}`}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold truncate", accent && "text-primary")}>{label}</p>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {sublabel}
          </div>
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground flex-shrink-0">
          {formatTime(duration)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-border/60 overflow-hidden">
        <div
          className={cn("h-full transition-[width] duration-150", accent ? "bg-primary" : "bg-muted-foreground/50")}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function AudioDubbingSheet({
  recordedBlob,
  durationSec,
  myLanguage,
  targetLang,
  onTargetLangChange,
  transcript,
  onTranscriptChange,
  isProcessing,
  stage,
  result,
  errorMessage,
  onDub,
  onSendOriginal,
  onSendDubbed,
  onCancel,
}: AudioDubbingSheetProps) {
  const [showLanguageList, setShowLanguageList] = useState(false);
  const [query, setQuery] = useState("");

  const myLang = findDubbingLanguage(myLanguage);
  const target = findDubbingLanguage(targetLang);
  const usingMyLanguage = target.code === myLang.code;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DUBBING_LANGUAGES;
    return DUBBING_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.includes(q),
    );
  }, [query]);

  const dubbedAudio = result?.audio || null;
  const stageIndex = STAGES.findIndex((s) => s.key === stage);

  const chooseMyLanguage = () => {
    setShowLanguageList(false);
    if (!usingMyLanguage) onTargetLangChange(myLang.code);
  };

  const chooseOther = () => {
    setShowLanguageList((prev) => !prev);
    setQuery("");
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Mic className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold leading-tight">Mensagem de voz</h4>
            <p className="text-[10px] text-muted-foreground">
              {formatTime(durationSec)} gravados · escolha o idioma da dublagem
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={onCancel}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {/* ── AS DUAS OPÇÕES ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={chooseMyLanguage}
            disabled={isProcessing}
            className={cn(
              "rounded-xl border p-3 text-left transition-all disabled:opacity-60",
              usingMyLanguage
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border/50 hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base leading-none">{myLang.flag}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Meu idioma
              </span>
              {usingMyLanguage && <Check className="h-3 w-3 text-primary ml-auto" />}
            </div>
            <p className={cn("text-sm font-semibold leading-tight", usingMyLanguage && "text-primary")}>
              {myLang.name}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Recebe o áudio no seu idioma padrão
            </p>
          </button>

          <button
            type="button"
            onClick={chooseOther}
            disabled={isProcessing}
            className={cn(
              "rounded-xl border p-3 text-left transition-all disabled:opacity-60",
              !usingMyLanguage
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border/50 hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Languages className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Outro idioma
              </span>
              <ChevronRight
                className={cn(
                  "h-3 w-3 ml-auto text-muted-foreground transition-transform",
                  showLanguageList && "rotate-90",
                )}
              />
            </div>
            <p className={cn("text-sm font-semibold leading-tight", !usingMyLanguage && "text-primary")}>
              {!usingMyLanguage ? `${target.flag} ${target.name}` : "Escolher…"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Dubla a sua voz para outro idioma
            </p>
          </button>
        </div>

        {/* Lista de idiomas com busca */}
        {showLanguageList && (
          <div className="rounded-xl border border-border/50 bg-background/60 p-2 space-y-2 animate-in fade-in duration-150">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar idioma…"
                className="w-full h-8 pl-8 pr-2 rounded-lg bg-muted/40 border border-border/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-40 overflow-y-auto">
              {filtered.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    onTargetLangChange(l.code);
                    setShowLanguageList(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-left transition-colors",
                    targetLang === l.code
                      ? "bg-primary/15 text-primary font-semibold"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span className="text-sm leading-none">{l.flag}</span>
                  <span className="truncate">{l.name}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-full text-[11px] text-muted-foreground px-2 py-3 text-center">
                  Nenhum idioma encontrado.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Etapas do pipeline ────────────────────────────────────────── */}
        {isProcessing && (
          <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />
              <span className="text-muted-foreground">
                Preparando a dublagem para {target.flag} {target.name}…
              </span>
            </div>
            <div className="flex items-center gap-1">
              {STAGES.map((s, i) => (
                <div key={s.key} className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors",
                      i <= stageIndex ? "bg-primary" : "bg-border/60",
                      i === stageIndex && "animate-pulse",
                    )}
                  />
                  <p
                    className={cn(
                      "text-[9px] mt-1 truncate",
                      i <= stageIndex ? "text-primary font-medium" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Erro ──────────────────────────────────────────────────────── */}
        {!isProcessing && errorMessage && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Não foi possível dublar</p>
              <p className="opacity-80 mt-0.5 break-words">{errorMessage}</p>
              <p className="opacity-70 mt-1">
                Você ainda pode enviar a gravação original — ela vai normalmente.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] flex-shrink-0"
              onClick={onDub}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Tentar
            </Button>
          </div>
        )}

        {/* ── Idioma detectado → destino ────────────────────────────────── */}
        {!isProcessing && result?.detectedLanguage && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] bg-primary/5 border border-primary/15 rounded-xl px-3 py-2">
            <span className="text-sm leading-none">{findDubbingLanguage(result.detectedLanguage).flag}</span>
            <span className="text-muted-foreground">Detectado:</span>
            <span className="font-semibold">{findDubbingLanguage(result.detectedLanguage).name}</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm leading-none">{target.flag}</span>
            <span className="font-semibold text-primary">{target.name}</span>
            {typeof result.elapsedMs === "number" && result.elapsedMs > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                {(result.elapsedMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )}

        {result?.sameLanguage && !isProcessing && (
          <p className="text-[11px] text-muted-foreground bg-muted/30 border border-border/30 rounded-xl px-3 py-2">
            O áudio já está em {target.name} — não há o que dublar. Envie o original.
          </p>
        )}

        {/* ── Players ───────────────────────────────────────────────────── */}
        <div className={cn("grid gap-2", dubbedAudio ? "sm:grid-cols-2" : "grid-cols-1")}>
          <MiniPlayer
            source={recordedBlob}
            label="Gravação original"
            fallbackDuration={durationSec}
            sublabel={<span>Sua voz, como foi gravada</span>}
          />
          {dubbedAudio && (
            <MiniPlayer
              source={dubbedAudio}
              label={`Dublado · ${target.name}`}
              accent
              sublabel={
                <>
                  <Volume2 className="h-3 w-3" />
                  <VoiceBadge method={result?.method} voice={result?.voice} />
                </>
              }
            />
          )}
        </div>

        {/* ── Texto reconhecido (sempre editável) ───────────────────────── */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground ml-0.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Texto reconhecido
            <span className="opacity-70">— corrija se precisar e dublar de novo</span>
          </label>
          <textarea
            className="w-full rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[56px] resize-none placeholder:text-muted-foreground/60"
            placeholder="Escreva aqui o que você falou no áudio…"
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            disabled={isProcessing}
          />
        </div>

        {/* Tradução */}
        {result?.translatedText && (
          <div className="bg-muted/25 border border-border/30 rounded-xl px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
              Tradução ({target.name})
            </p>
            <p className="text-xs text-foreground/90 break-words">{result.translatedText}</p>
          </div>
        )}
      </div>

      {/* ── Rodapé de ações ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border/40 bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 text-destructive hover:bg-destructive/10 gap-1.5"
          onClick={onCancel}
          disabled={isProcessing}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Descartar
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={onDub}
          disabled={isProcessing || !recordedBlob}
        >
          {isProcessing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Languages className="h-3.5 w-3.5" />
          )}
          {dubbedAudio ? "Dublar de novo" : "Dublar"}
        </Button>

        <div className="flex-1" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={onSendOriginal}
          disabled={isProcessing || !recordedBlob}
        >
          <Send className="h-3.5 w-3.5" />
          Original
        </Button>

        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-95 shadow-md disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
          onClick={onSendDubbed}
          disabled={isProcessing || !dubbedAudio}
        >
          <Send className="h-3.5 w-3.5" />
          Enviar dublado
        </Button>
      </div>
    </div>
  );
}

export default AudioDubbingSheet;
