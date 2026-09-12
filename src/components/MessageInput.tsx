/**
 * =============================================================================
 * File: src/components/MessageInput.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Alterado em: 2026-06-13
 * Alterações:
 *  - Implementação de carrossel horizontal no menu "+".
 *  - Botão único de Câmera com opções de Foto/Vídeo e navegação interna (submenu).
 *  - Suporte condicional à tradução/dublagem de áudio.
 *  - Correção de erro de inicialização (TDZ) do estado isPlusMenuOpen no useEffect.
 * =============================================================================
 */

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { Send, Upload, X, Images, Bell, Mic, Square, Camera, Video, Languages, Loader2, ChevronDown, Trash2, Lock, Unlock, Wand2, CheckCircle2, BarChart3, ImagePlus, Sparkles, CalendarClock, PhoneCall, Navigation2, CircleDot, Plus } from "lucide-react";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { Button } from "@/components/ui/button";
import { CameraCaptureModal } from "@/components/camera/CameraCaptureModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AudioDubbingSheet, DubbingStage, findDubbingLanguage } from "@/components/chat/AudioDubbingSheet";
import { useTextCorrection, TextCorrectionResult } from "@/hooks/useTextCorrection";
import { useUnifiedTranslation, TextCorrectionResult as UnifiedTextCorrectionResult, TranslationResult } from "@/hooks/useUnifiedTranslation";
import { usePermissions } from "@/contexts/PermissionContext";


// --- Visualizador de Áudio Premium em Tempo Real para Gravação ---
const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    let audioCtx: AudioContext;
    try {
      audioCtx = new AudioContextClass();
    } catch (e) {
      console.error(e);
      return;
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64; // Visualização com mais detalhes
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvasRef.current) return;
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const padding = 2;
      const barWidth = (canvas.width / bufferLength) * 1.6;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = Math.max(3, percent * canvas.height * 0.95);
        const y = (canvas.height - barHeight) / 2;

        // Efeito degradê moderno
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#ef4444'); // Red
        gradient.addColorStop(1, '#f97316'); // Orange
        ctx.fillStyle = gradient;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth - padding, barHeight, 2);
        } else {
          ctx.rect(x, y, barWidth - padding, barHeight);
        }
        ctx.fill();

        x += barWidth;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={140} height={28} className="h-7 w-28 opacity-90 rounded-md" />;
};


// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

const LANGUAGES = [
  { code: 'pt', name: 'Português' },
  { code: 'en', name: 'Inglês' },
  { code: 'es', name: 'Espanhol' },
  { code: 'fr', name: 'Francês' },
  { code: 'de', name: 'Alemão' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Russo' },
  { code: 'ja', name: 'Japonês' },
  { code: 'zh', name: 'Chinês' },
  { code: 'ar', name: 'Árabe' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ko', name: 'Coreano' },
  { code: 'nl', name: 'Holandês' },
  { code: 'tr', name: 'Turco' }
];



/** Locales aceitos pela Web Speech API, por idioma padrão do usuário. */
const SPEECH_LOCALES: Record<string, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  ru: 'ru-RU',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ko: 'ko-KR',
  nl: 'nl-NL',
  tr: 'tr-TR',
  pl: 'pl-PL',
};

const DEFAULT_EMOJI_STICKERS = [
  "😂","😍","🥹","😎","😡","🤯","🥳","🤝","🙏","🔥","💯","❤️"
];

function loadStickerStore(userId?: string | null): { recent: string[]; mine: string[] } {
  try {
    const key = userId ? `stickers_store_v1:${userId}` : "stickers_store_v1";
    const raw = localStorage.getItem(key);
    if (!raw) return { recent: [], mine: [] };
    const parsed = JSON.parse(raw);
    return {
      recent: Array.isArray(parsed?.recent) ? parsed.recent : [],
      mine: Array.isArray(parsed?.mine) ? parsed.mine : [],
    };
  } catch {
    return { recent: [], mine: [] };
  }
}

function saveStickerStore(userId: string | null | undefined, next: { recent: string[]; mine: string[] }) {
  try {
    const key = userId ? `stickers_store_v1:${userId}` : "stickers_store_v1";
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// Cache local (por usuario) APENAS para figurinhas por imagem.
// Isso nao substitui o backend (Supabase user_stickers + Cloudinary), e sim evita que o usuario
// perca a lista na UI caso a consulta ao backend esteja temporariamente vazia.
function loadImageStickers(userId?: string | null): string[] {
  try {
    const key = userId ? `stickers_images_v1:${userId}` : 'stickers_images_v1';
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

function saveImageStickers(userId: string | null | undefined, urls: string[]) {
  try {
    const key = userId ? `stickers_images_v1:${userId}` : 'stickers_images_v1';
    localStorage.setItem(key, JSON.stringify((urls || []).slice(0, 200)));
  } catch {
    // ignore
  }
}

function isEmojiToken(v: string) {
  // Heurística simples: evita URLs/paths e strings grandes (ex.: "storage/..." )
  if (!v) return false;
  if (v.startsWith("http") || v.startsWith("/")) return false;
  if (v.includes("/")) return false;
  // emojis podem ter 1-4 codepoints, mas string length pode variar; limita por segurança
  return v.length <= 6;
}
interface MessageInputProps {
  onSendMessage: (message: string) => void;
  onAudioReady: (audioBlob: Blob, originalBlob?: Blob) => void;
  /** Idioma da dublagem escolhido pelo remetente (para marcar a mensagem enviada) */
  dubbedLanguage?: string | null;
  onMediaReady: (files: File[]) => void;
  /** Envia uma figurinha (emoji) */
  onSendEmojiSticker?: (emoji: string) => void;
  /** Envia uma figurinha (imagem) via URL */
  onSendImageSticker?: (stickerUrl: string) => void;
  /** Faz upload de figurinha (imagem) e retorna URL */
  onUploadStickerImage?: (file: File) => Promise<string>;
  /** Figurinhas (imagens) já salvas do usuário (persistidas no backend) */
  initialMineStickers?: string[];
  /** Para manter o storage/local cache separado por usuário */
  currentUserId?: string | null;
  /** Se informado, exibe o botão "Chamar atenção" dentro do chat */
  attentionReceiverId?: string | null;
  /** Controla se o botão de atenção aparece no input (padrão: true) */
  showAttentionButton?: boolean;
  /** Notifica o status de digitação (para o outro usuário ver) */
  onTypingChange?: (isTyping: boolean) => void;
  /** Callback para solicitar localização do outro usuário */
  onRequestLocation?: () => void;
  /** Traduz o texto atual do input */
  onTranslateRequest?: (text: string, targetLang: string) => Promise<string>;
  onScheduleClick?: () => void;
  onMakeCall?: (type: 'video' | 'voice') => void;
  disabled?: boolean;
  /** Liga a dublagem da SUA gravação ao enviar (mostra o painel de dublagem). */
  audioTranslateEnabled?: boolean;
  /**
   * Idioma que o usuário marcou como padrão dele. É a primeira das duas opções
   * do painel de dublagem ("Meu idioma"); a segunda é "Outro idioma".
   */
  myLanguage?: string;
  /** Quando ativo, sugere correção automática de erros de português/ortografia no texto digitado */
  autoCorrectEnabled?: boolean;
  /** Exibe botão de "Enquete" no menu + (abre o modal de criação no pai) */
  onPollClick?: () => void;
  /** Exibe a linha de chips de menção (@todos + membros do grupo) acima do campo */
  mentionAllEnabled?: boolean;
  /** Usernames dos membros do grupo para inserção rápida de menção */
  mentionableUsernames?: string[];
}

export function MessageInput({
  onSendMessage,
  onAudioReady,
  dubbedLanguage = null,
  onMediaReady,
  onSendEmojiSticker,
  onSendImageSticker,
  onUploadStickerImage,
  initialMineStickers = [],
  currentUserId = null,
  attentionReceiverId = null,
  showAttentionButton = true,
    onTypingChange,
  onRequestLocation,
  onTranslateRequest,
  onScheduleClick,
  onMakeCall,
  disabled = false,
  audioTranslateEnabled = true,
  myLanguage = 'pt',
  autoCorrectEnabled = true,
  onPollClick,
  mentionAllEnabled = false,
  mentionableUsernames = [],
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [isTranslatingInput, setIsTranslatingInput] = useState(false);
  const [savedLang, setSavedLang] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<"main" | "camera">("main");
  const [isPlusOpen, setIsPlusOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // States for audio translation and voice cloning
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [showVoiceTranslatePanel, setShowVoiceTranslatePanel] = useState(false);
  const [voiceTranslateTarget, setVoiceTranslateTarget] = useState("en");
  const [translatedAudioUrl, setTranslatedAudioUrl] = useState<string | null>(null);
  const [translationMethod, setTranslationMethod] = useState<string | null>(null);
  const [voiceTranslationResult, setVoiceTranslationResult] = useState<any | null>(null);
  const [playingAudioType, setPlayingAudioType] = useState<"original" | "translated" | null>(null);
  const [voiceTranslateError, setVoiceTranslateError] = useState<string | null>(null);
  /** Etapa exibida na barra de progresso do painel de dublagem. */
  const [dubStage, setDubStage] = useState<DubbingStage>("idle");
  const dubStageTimersRef = useRef<number[]>([]);

  // --- NATIVE ASR (Web Speech API) ---
  const [transcribedText, setTranscribedText] = useState("");
  const recognitionRef = useRef<any>(null);

  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const { requestPermission } = usePermissions();

  // Hook unificado de tradução (texto, áudio, correção)
  const { translateText, translateAudio: translateAudioUnified, correctText: correctTextUnified, detectLanguage, getLanguageInfo, isTranslatingText, isTranslatingAudio, isCorrectingText, LANGUAGES: UNIFIED_LANGUAGES } = useUnifiedTranslation(currentUserId);

  // Refs para evitar "stale closures" dentro do onstop do MediaRecorder
  // (a transcrição e o idioma alvo continuam mudando enquanto o usuário grava).
  const transcribedTextRef = useRef("");
  const voiceTranslateTargetRef = useRef(voiceTranslateTarget);
  useEffect(() => { voiceTranslateTargetRef.current = voiceTranslateTarget; }, [voiceTranslateTarget]);

  // Carrega o idioma de dublagem preferido do usuário (persistido por conta)
  useEffect(() => {
    if (!currentUserId) return;
    try {
      const saved = localStorage.getItem(`voice_dub_lang_${currentUserId}`);
      if (saved) setVoiceTranslateTarget(saved);
    } catch {}
  }, [currentUserId]);

  // --- Correção automática de texto (ortografia/gramática) ---
  const { correctText, isChecking: isCheckingText } = useTextCorrection();
  const { correctText: correctTextUnifiedHook, isCorrectingText: isCorrectingTextUnified } = useUnifiedTranslation(currentUserId);
  const [textCorrection, setTextCorrection] = useState<TextCorrectionResult | null>(null);
  const lastCheckedTextRef = useRef<string>("");

  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentUserId) {
      const lang = localStorage.getItem(`translate_lang_input_${currentUserId}`);
      if (lang) setSavedLang(lang);
    }
  }, [currentUserId]);

  // ⚠️ Importante: separar o cache local por usuário (evita misturar figurinhas entre contas)
  const [store, setStore] = useState(() => loadStickerStore(currentUserId));
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);

  // Figurinhas por imagem (persistidas no backend). Não salvamos URL no localStorage para não poluir
  // o grid de emoji e para garantir persistência por usuário no Supabase.
  const [myImageStickers, setMyImageStickers] = useState<string[]>(() => {
    const local = loadImageStickers(currentUserId);
    const initial = Array.isArray(initialMineStickers) ? initialMineStickers : [];
    return Array.from(new Set([...(initial || []), ...(local || [])])).slice(0, 120);
  });

  // Quando o usuário troca (logout/login), recarrega o storage local e reseta a lista de imagens.
  useEffect(() => {
    setStore(loadStickerStore(currentUserId));
    const local = loadImageStickers(currentUserId);
    const initial = Array.isArray(initialMineStickers) ? initialMineStickers : [];
    setMyImageStickers(Array.from(new Set([...(initial || []), ...(local || [])])).slice(0, 120));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Merge das figurinhas persistidas (backend) com as locais (somente imagens)
  useEffect(() => {
    if (!Array.isArray(initialMineStickers) || initialMineStickers.length === 0) return;
    setMyImageStickers((prev) => Array.from(new Set([...(prev || []), ...initialMineStickers])).slice(0, 120));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialMineStickers)]);

  // Persistir cache local por usuario (apenas imagens)
  useEffect(() => {
    // Evita sobrescrever o cache do usuario com lista vazia durante o boot (antes do backend responder)
    if (!currentUserId) return;
    if (!Array.isArray(myImageStickers) || myImageStickers.length === 0) return;
    saveImageStickers(currentUserId, myImageStickers);
  }, [currentUserId, myImageStickers]);

  // Altura inicial (~3 linhas). O auto-resize cresce conforme o usuário digita.
  const BASE_HEIGHT = 72;

  const allEmoji = useMemo(() => {
    const merged = [
      ...store.recent,
      ...store.mine,
      ...DEFAULT_EMOJI_STICKERS,
    ];
    const unique = Array.from(new Set(merged)).filter((v) => typeof v === "string" && isEmojiToken(v));
    return unique.slice(0, 60);
  }, [store]);

  useEffect(() => {
    saveStickerStore(currentUserId, store);
  }, [store, currentUserId]);

  useEffect(() => {
    if (!isPlusOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => { document.removeEventListener("mousedown", handleOutside); document.removeEventListener("touchstart", handleOutside); };
  }, [isPlusOpen]);

  const setTyping = (val: boolean) => {
    if (!onTypingChange) return;
    onTypingChange(val);
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage("");
      setTyping(false);
      setTextCorrection(null);
      lastCheckedTextRef.current = "";
      if (textareaRef.current) {
        textareaRef.current.style.height = `${BASE_HEIGHT}px`;
      }
    }
  };

  const insertText = (snippet: string) => {
    if (disabled) return;
    setMessage((prev) => {
      const base = (prev || "").trimEnd();
      return base ? `${base} ${snippet}` : snippet;
    });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setMessage(v);

    // Typing indicator (debounce)
    if (onTypingChange) {
      const isTypingNow = v.trim().length > 0;
      setTyping(isTypingNow);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => {
        setTyping(false);
      }, 1200);
    }

    // Auto-resize
    if (textareaRef.current) {
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = scrollHeight > BASE_HEIGHT ? Math.min(scrollHeight, 200) : BASE_HEIGHT;
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const pushRecent = (emoji: string) => {
    setStore((prev) => {
      const nextRecent = [emoji, ...prev.recent.filter((e) => e !== emoji)].slice(0, 18);
      return { ...prev, recent: nextRecent };
    });
  };

  const addToMine = (emojiOrUrl: string) => {
    setStore((prev) => {
      const nextMine = [emojiOrUrl, ...prev.mine.filter((e) => e !== emojiOrUrl)].slice(0, 60);
      return { ...prev, mine: nextMine };
    });
  };

  const handleSendEmojiSticker = (emoji: string) => {
    if (!onSendEmojiSticker || disabled) return;
    pushRecent(emoji);
    onSendEmojiSticker(emoji);
  };

  const handleStickerUpload = async (file: File) => {
    if (!onUploadStickerImage || !onSendImageSticker) return;
    try {
      setIsUploadingSticker(true);
      const url = await onUploadStickerImage(file);
      // Lista de imagens vem do backend; aqui fazemos um update otimista para aparecer na hora.
      setMyImageStickers((prev) => [url, ...prev.filter((u) => u !== url)].slice(0, 120));
      onSendImageSticker(url);
    } finally {
      setIsUploadingSticker(false);
    }
  };

  const [isStickerSubOpen, setIsStickerSubOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onMediaReady([file]);
    }
    e.target.value = "";
  };

  const handleVideoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onMediaReady([file]);
    }
    e.target.value = "";
  };

  // Voice translation and audio preview helpers
  const playAudioBlob = (blob: Blob, type: "original") => {
    if (playingAudioType === type && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPlayingAudioType(null);
      return;
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioPreviewRef.current = audio;
    setPlayingAudioType(type);
    // Sem catch, uma falha no play() deixava o botao preso em "pausar".
    audio.play().catch((err) => {
      console.warn('[MessageInput] nao foi possivel reproduzir o audio:', err);
      setPlayingAudioType(null);
      URL.revokeObjectURL(url);
    });
    audio.onended = () => {
      setPlayingAudioType(null);
      URL.revokeObjectURL(url);
    };
  };

  const playAudioUrl = (url: string, type: "translated") => {
    if (playingAudioType === type && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPlayingAudioType(null);
      return;
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    const audio = new Audio(url);
    audioPreviewRef.current = audio;
    setPlayingAudioType(type);
    audio.play().catch((err) => {
      console.warn('[MessageInput] nao foi possivel reproduzir o audio:', err);
      setPlayingAudioType(null);
    });
    audio.onended = () => {
      setPlayingAudioType(null);
    };
  };

  // Executa o pipeline de tradução/dublagem automaticamente assim que a
  // gravação termina (quando "Traduzir áudio" está ativado), sem precisar
  // que o usuário clique em "Traduzir & Dublar". Já exibe o resultado
  // dublado com a indicação do idioma original detectado.
  /** Limpa os timers que avançam a barra de etapas. */
  const clearDubStageTimers = () => {
    dubStageTimersRef.current.forEach((id) => window.clearTimeout(id));
    dubStageTimersRef.current = [];
  };

  useEffect(() => () => clearDubStageTimers(), []);

  /**
   * Roda o pipeline de dublagem uma única vez, alimentando a barra de etapas.
   * Usado tanto pela dublagem automática (fim da gravação) quanto pelo botão
   * "Dublar" / "Dublar de novo" do painel.
   *
   * As etapas são estimadas no tempo (o backend devolve tudo de uma vez), mas
   * refletem a ordem real do pipeline: transcrição → tradução → voz. A voz de
   * retaguarda entra sozinha se a clonagem passar de 3 s.
   */
  const runDubbing = async (blob: Blob, target: string, transcribedHint: string) => {
    if (!blob || !target) return;

    if (currentUserId) {
      try { localStorage.setItem(`voice_dub_lang_${currentUserId}`, target); } catch {}
    }

    setVoiceTranslateError(null);
    clearDubStageTimers();
    setDubStage('listening');
    dubStageTimersRef.current.push(
      window.setTimeout(() => setDubStage('translating'), 900),
      window.setTimeout(() => setDubStage('voicing'), 2200),
    );

    try {
      const result = await translateAudioUnified(blob, target, transcribedHint.trim() || undefined, {
        // É a gravação do próprio usuário: pode servir de amostra para clonar.
        useAudioAsSample: true,
        tryClone: true,
        silent: true, // o erro aparece dentro do painel, não em toast
      });

      if (result && result.success && result.audio) {
        setVoiceTranslationResult(result);
        setTranslatedAudioUrl(result.audio);
        setTranslationMethod(result.method || null);
        setVoiceTranslateError(null);
        setDubStage('done');
        // O servidor costuma reconhecer melhor que o navegador: adota o texto
        // dele quando o campo estava vazio.
        if (!transcribedHint.trim() && result.originalText) {
          setTranscribedText(result.originalText);
          transcribedTextRef.current = result.originalText;
        }
      } else {
        setVoiceTranslateError(result?.message || 'Não foi possível dublar o áudio. Tente novamente.');
        setDubStage('error');
      }
    } catch (err: any) {
      setVoiceTranslateError(err?.message || 'Não foi possível dublar o áudio. Tente novamente.');
      setDubStage('error');
    } finally {
      clearDubStageTimers();
    }
  };

  // Dublagem automática logo após a gravação (mantém o nome antigo).
  const runAutoDub = async (blob: Blob, transcribedHint: string) => {
    await runDubbing(blob, voiceTranslateTargetRef.current, transcribedHint);
  };

  // Botão "Dublar" / "Dublar de novo" do painel.
  const handleTranslateAudio = async () => {
    if (!recordedBlob || !voiceTranslateTarget) return;
    await runDubbing(recordedBlob, voiceTranslateTarget, transcribedText);
  };

  /**
   * Troca o idioma de destino. Se já existe uma dublagem pronta em outro
   * idioma, ela é descartada e o processo roda de novo automaticamente —
   * antes o usuário trocava o idioma e continuava ouvindo o áudio anterior.
   */
  const handleTargetLangChange = (code: string) => {
    if (!code || code === voiceTranslateTarget) return;
    setVoiceTranslateTarget(code);
    voiceTranslateTargetRef.current = code;
    setTranslatedAudioUrl(null);
    setVoiceTranslationResult(null);
    setTranslationMethod(null);
    setVoiceTranslateError(null);
    setDubStage('idle');
    if (recordedBlob) {
      void runDubbing(recordedBlob, code, transcribedText);
    }
  };

  const sendOriginalAudio = () => {
    if (recordedBlob) {
      onAudioReady(recordedBlob);
      cancelTranslationAndReset();
    }
  };

  const sendTranslatedAudio = () => {
    if (voiceTranslationResult?.audio) {
      try {
        const blob = dataURItoBlob(voiceTranslationResult.audio);
        // Marca o idioma da dublagem no próprio blob (meta) para o pai persistir na mensagem
        (blob as any).__dubLang = voiceTranslateTarget;
        onAudioReady(blob, recordedBlob || undefined);
        cancelTranslationAndReset();
      } catch (e) {
        console.error("Erro ao converter base64 para blob:", e);
      }
    }
  };

  const cancelTranslationAndReset = () => {
    clearDubStageTimers();
    setDubStage('idle');
    setRecordedDuration(0);
    setRecordedBlob(null);
    setShowVoiceTranslatePanel(false);
    setTranslatedAudioUrl(null);
    setTranslationMethod(null);
    setVoiceTranslationResult(null);
    setVoiceTranslateError(null);
    setPlayingAudioType(null);
    setTranscribedText("");
    transcribedTextRef.current = "";
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current = null;
    }
  };

  // Convert base64 dataURI back to Blob for sending
  const dataURItoBlob = (dataURI: string) => {
    const parts = dataURI.split(',');
    const byteString = atob(parts[1]);
    const mimeString = parts[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };


  // --- WhatsApp-style hold-to-record ---
  const [isHoldRecording, setIsHoldRecording] = useState(false);
  const [isLockedRecording, setIsLockedRecording] = useState(false);
  const [holdDuration, setHoldDuration] = useState(0);
  /** Duração final da gravação — `holdDuration` volta a zero ao parar. */
  const [recordedDuration, setRecordedDuration] = useState(0);
  const holdDurationRef = useRef(0);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const holdRecorderRef = useRef<MediaRecorder | null>(null);
  const holdChunksRef = useRef<BlobPart[]>([]);
  const holdTimerRef = useRef<any>(null);
  const holdStreamRef = useRef<MediaStream | null>(null);

  const formatRecTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const startHoldRecording = async () => {
    if (isHoldRecording) return;
    const micGranted = await requestPermission(
      'microphone',
      'Para enviar mensagens de voz e usar a tradução automática de áudios, o app precisa acessar o microfone.'
    );
    if (!micGranted) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      holdStreamRef.current = stream;
      setActiveStream(stream);
      setVoiceTranslateError(null);

      // --- Start Web Speech API Recognition ---
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setTranscribedText("");
        transcribedTextRef.current = "";
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        // Antes era fixo em 'pt-BR': quem fala outro idioma tinha a transcrição
        // saindo errada e a dublagem partia de um texto sem sentido. Agora segue
        // o idioma padrão do usuário.
        recognition.lang = SPEECH_LOCALES[(myLanguage || 'pt').split(/[-_]/)[0]] || 'pt-BR';
        recognition.onresult = (e: any) => {
          let finalTranscript = '';
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
              finalTranscript += e.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setTranscribedText(prev => {
              const next = (prev + ' ' + finalTranscript).trim();
              transcribedTextRef.current = next;
              return next;
            });
          }
        };
        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.warn("Speech recognition failed to start", err);
        }
      }

      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      holdChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) holdChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(holdChunksRef.current, { type: 'audio/webm' });
        setRecordedDuration(holdDurationRef.current);
        if (blob.size > 0) {
          if (audioTranslateEnabled) {
            setRecordedBlob(blob);
            setShowVoiceTranslatePanel(true);
            setVoiceTranslateError(null);
            // Roda o pipeline de tradução/dublagem automaticamente, sem
            // precisar que o usuário clique em "Traduzir & Dublar".
            // Pequeno atraso para o Web Speech consolidar a transcrição final.
            setTimeout(() => void runAutoDub(blob, transcribedTextRef.current), 600);
          } else {
            onAudioReady(blob);
          }
        }
        holdStreamRef.current?.getTracks().forEach(t => t.stop());
        holdStreamRef.current = null;
        setActiveStream(null);
      };

      holdRecorderRef.current = mr;
      mr.start();
      setIsHoldRecording(true);
      setIsLockedRecording(false);
      setHoldDuration(0);
      holdDurationRef.current = 0;
      holdTimerRef.current = setInterval(() => {
        setHoldDuration(prev => {
          const next = prev >= 120 ? 120 : prev + 1;
          holdDurationRef.current = next;
          if (prev >= 120) stopHoldRecording();
          return next;
        });
      }, 1000);
    } catch (e) {
      console.error('Mic error:', e);
    }
  };

  const stopHoldRecording = () => {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
    const mr = holdRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    holdRecorderRef.current = null;
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }

    setIsHoldRecording(false);
    setIsLockedRecording(false);
    setHoldDuration(0);
  };

  const cancelHoldRecording = () => {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
    const mr = holdRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      // Override onstop to NOT send
      mr.onstop = () => {
        holdStreamRef.current?.getTracks().forEach(t => t.stop());
        holdStreamRef.current = null;
        setActiveStream(null);
      };
      mr.stop();
    }
    holdRecorderRef.current = null;

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
      setTranscribedText("");
    }

    setIsHoldRecording(false);
    setIsLockedRecording(false);
    setHoldDuration(0);
  };

  const lockRecording = () => {
    setIsLockedRecording(true);
  };

  const handleTranslateInput = async (lang: string) => {
    if (!message.trim()) return;
    setIsTranslatingInput(true);
    try {
       const result = await translateText(message, lang);
       if (result.success && result.translatedText) {
         setMessage(result.translatedText);
         if (currentUserId) {
           localStorage.setItem(`translate_lang_input_${currentUserId}`, lang);
         }
         setSavedLang(lang);
       }
    } finally {
      setIsTranslatingInput(false);
    }
  };

  // --- Análise automática de erros no texto digitado (ortografia/gramática) ---
  useEffect(() => {
    if (!autoCorrectEnabled) {
      setTextCorrection(null);
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length < 4) {
      setTextCorrection(null);
      return;
    }
    if (trimmed === lastCheckedTextRef.current) return;

    const timer = window.setTimeout(async () => {
      const result = await correctTextUnifiedHook(trimmed);
      lastCheckedTextRef.current = trimmed;
      if (result && result.hasErrors && result.correctedText && result.correctedText !== trimmed) {
        setTextCorrection(result as TextCorrectionResult);
      } else {
        setTextCorrection(null);
      }
    }, 1200);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, autoCorrectEnabled, correctTextUnifiedHook]);

  const applyTextCorrection = () => {
    if (!textCorrection) return;
    const corrected = textCorrection.correctedText;
    setMessage(corrected);
    lastCheckedTextRef.current = corrected;
    setTextCorrection(null);
    if (textareaRef.current) {
      const ta = textareaRef.current;
      requestAnimationFrame(() => {
        const scrollHeight = ta.scrollHeight;
        const newHeight = scrollHeight > BASE_HEIGHT ? Math.min(scrollHeight, 200) : BASE_HEIGHT;
        ta.style.height = `${newHeight}px`;
      });
    }
  };

  const dismissTextCorrection = () => {
    if (textCorrection) lastCheckedTextRef.current = textCorrection.originalText;
    setTextCorrection(null);
  };

  // Verificação manual (botão "Corrigir texto")
  const handleManualTextCheck = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const result = await correctTextUnifiedHook(trimmed);
    lastCheckedTextRef.current = trimmed;
    if (result && result.hasErrors && result.correctedText && result.correctedText !== trimmed) {
      setTextCorrection(result as TextCorrectionResult);
    } else {
      setTextCorrection(null);
    }
  };

  return (
    <div className="w-full bg-transparent overflow-visible flex-shrink-0">
      <div className="p-1 sm:p-2 space-y-1.5">
        {/* Chips rápidos de menção (grupos): @todos + membros */}
        {mentionAllEnabled && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
            <button
              type="button"
              onClick={() => insertText("@all")}
              className="h-7 px-2.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors flex-shrink-0 flex items-center gap-1"
              title="Marcar todos os membros do grupo"
            >
              <Bell className="h-3 w-3" />
              @todos
            </button>
            {mentionableUsernames.map((username) => (
              <button
                key={username}
                type="button"
                onClick={() => insertText(`@${username}`)}
                className="h-7 px-2.5 rounded-full text-[11px] font-medium bg-muted/60 text-muted-foreground border border-border/50 hover:bg-accent hover:text-foreground transition-colors flex-shrink-0"
              >
                @{username}
              </button>
            ))}
          </div>
        )}
        {/* ── Painel de dublagem (novo) ───────────────────────────────
            Substitui o antigo bloco inline. Traz as DUAS opções pedidas:
            "Meu idioma" (o padrão do usuário) e "Outro idioma". */}
        {showVoiceTranslatePanel && recordedBlob && (
          <AudioDubbingSheet
            recordedBlob={recordedBlob}
            durationSec={recordedDuration || holdDuration || Math.round(recordedBlob.size / 16000)}
            myLanguage={myLanguage}
            targetLang={voiceTranslateTarget}
            onTargetLangChange={handleTargetLangChange}
            transcript={transcribedText}
            onTranscriptChange={(value) => {
              setTranscribedText(value);
              transcribedTextRef.current = value;
            }}
            isProcessing={isTranslatingAudio}
            stage={dubStage}
            result={voiceTranslationResult}
            errorMessage={voiceTranslateError}
            onDub={() => void handleTranslateAudio()}
            onSendOriginal={sendOriginalAudio}
            onSendDubbed={sendTranslatedAudio}
            onCancel={cancelTranslationAndReset}
          />
        )}

        {/* Sticker panel (shown when sticker button from + menu is clicked) */}
        {isStickerSubOpen && (onSendEmojiSticker || onSendImageSticker) && (

          <div className="rounded-xl border bg-popover shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
              <div className="text-sm font-semibold">Figurinhas</div>
              <div className="flex items-center gap-1">
                <label className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border cursor-pointer hover:bg-accent", disabled && "opacity-50 pointer-events-none")}>
                  <Images className="h-3.5 w-3.5" />
                  <span>{isUploadingSticker ? "Adicionando..." : "Galeria"}</span>
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      e.currentTarget.value = "";
                      setIsUploadingSticker(true);
                      try {
                        const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () => resolve(String(r.result || ''));
                          r.onerror = () => reject(new Error('read_error'));
                          r.readAsDataURL(file);
                        });
                        const dataUrls: string[] = [];
                        for (const f of files.slice(0, 12)) {
                          const du = await readAsDataUrl(f);
                          if (typeof du === 'string' && du.startsWith('data:image/')) dataUrls.push(du);
                        }
                        if (dataUrls.length) {
                          setMyImageStickers((prev) => Array.from(new Set([...dataUrls, ...(prev || [])])).slice(0, 120));
                        }
                      } finally {
                        setIsUploadingSticker(false);
                      }
                    }}
                  />
                </label>

                {onUploadStickerImage ? (
                  <label className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border cursor-pointer hover:bg-accent", disabled && "opacity-50 pointer-events-none")}>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Cloud</span>
                    <input
                      type="file"
                      accept="image/png,image/webp,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        void handleStickerUpload(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setStore({ recent: [], mine: store.mine });
                  }}
                  title="Limpar recentes"
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsStickerSubOpen(false)}
                  title="Fechar figurinhas"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-3 max-h-[300px] overflow-y-auto">
              <div className="text-xs text-muted-foreground mb-2">Toque para enviar</div>
              <div className="grid grid-cols-6 gap-2">
                {allEmoji.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="h-10 w-10 rounded-lg border bg-background hover:bg-accent flex items-center justify-center text-xl"
                    onClick={() => handleSendEmojiSticker(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {myImageStickers.length > 0 ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold mb-2">Minhas (imagens)</div>
                  <div className="grid grid-cols-4 gap-2">
                    {myImageStickers
                      .filter((u) => typeof u === "string" && (u.startsWith("data:image/") || u.startsWith("http")))
                      .slice(0, 20)
                      .map((url) => (
                        <button
                          key={url}
                          type="button"
                          className="h-16 w-16 rounded-lg border bg-background hover:bg-accent flex items-center justify-center overflow-hidden"
                          onClick={() => {
                            if (!onSendImageSticker || disabled) return;
                            onSendImageSticker(url);
                          }}
                        >
                          <img src={url} alt="sticker" className="h-full w-full object-cover" />
                        </button>
                      ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2">
                    Dica: use "Galeria" para adicionar várias figurinhas de uma vez. As figurinhas ficam salvas somente neste dispositivo.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Sugestão de correção automática de texto (ortografia/gramática) */}
        {textCorrection && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
              <Wand2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                {textCorrection.issuesCount === 1
                  ? `Encontramos 1 possível erro (${textCorrection.languageName}). Sugestão de correção:`
                  : `Encontramos ${textCorrection.issuesCount} possíveis erros (${textCorrection.languageName}). Sugestão de correção:`}
              </span>
            </div>
            <p className="text-foreground bg-background/60 rounded-lg px-2 py-1.5 border border-border/40 whitespace-pre-wrap">
              {textCorrection.correctedText}
            </p>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismissTextCorrection}>
                Manter original
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={applyTextCorrection}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aplicar correção
              </Button>
            </div>
          </div>
        )}

        {/* ── Botão + e painel flutuante de ações ── */}
        <div ref={plusMenuRef} className="relative">
          {/* Painel flutuante que abre ao clicar no + */}
          {isPlusOpen && (
            <div className="absolute bottom-full right-0 mb-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-popover border border-border shadow-2xl rounded-2xl p-3 flex flex-col gap-2 min-w-[200px]">
                <div className="grid grid-cols-3 gap-2">
                  {/* Galeria */}
                  <label className={cn("flex flex-col items-center gap-1 cursor-pointer group", disabled && "opacity-50 pointer-events-none")}>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/20 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 group-hover:border-blue-400/40 transition-all active:scale-90">
                      <ImagePlus className="h-4.5 w-4.5 text-blue-500" />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">Galeria</span>
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) onMediaReady(f); e.currentTarget.value = ""; setIsPlusOpen(false); }} />
                  </label>

                  {/* Câmera */}
                  <button type="button" disabled={disabled} onClick={() => { setActiveMenu("camera"); setIsPlusOpen(false); }} className={cn("flex flex-col items-center gap-1 group", disabled && "opacity-50 pointer-events-none")}>
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center border border-pink-500/20 group-hover:from-pink-500/30 group-hover:to-rose-500/30 group-hover:border-pink-400/40 transition-all active:scale-90">
                      <CircleDot className="h-4.5 w-4.5 text-pink-500" />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">Câmera</span>
                  </button>

                  {/* Figurinhas */}
                  {(onSendEmojiSticker || onSendImageSticker) && (
                    <button type="button" disabled={disabled} onClick={() => { setIsStickerSubOpen(!isStickerSubOpen); setIsPlusOpen(false); }} className={cn("flex flex-col items-center gap-1 group", disabled && "opacity-50 pointer-events-none")}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center border border-amber-500/20 group-hover:from-amber-500/30 group-hover:to-yellow-500/30 group-hover:border-amber-400/40 transition-all active:scale-90">
                        <Sparkles className="h-4.5 w-4.5 text-amber-500" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">Sticker</span>
                    </button>
                  )}

                  {/* Enquete */}
                  {onPollClick && (
                    <button type="button" disabled={disabled} onClick={() => { onPollClick(); setIsPlusOpen(false); }} className={cn("flex flex-col items-center gap-1 group", disabled && "opacity-50 pointer-events-none")}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center border border-orange-500/20 group-hover:from-orange-500/30 group-hover:to-red-500/30 group-hover:border-orange-400/40 transition-all active:scale-90">
                        <BarChart3 className="h-4.5 w-4.5 text-orange-500" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">Enquete</span>
                    </button>
                  )}

                  {/* Local */}
                  {onRequestLocation && (
                    <button type="button" disabled={disabled} onClick={() => { onRequestLocation(); setIsPlusOpen(false); }} className={cn("flex flex-col items-center gap-1 group", disabled && "opacity-50 pointer-events-none")}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 group-hover:from-emerald-500/30 group-hover:to-teal-500/30 group-hover:border-emerald-400/40 transition-all active:scale-90">
                        <Navigation2 className="h-4.5 w-4.5 text-emerald-500" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">Local</span>
                    </button>
                  )}

                  {/* Agendar */}
                  {onScheduleClick && (
                    <button type="button" disabled={disabled} onClick={() => { onScheduleClick(); setIsPlusOpen(false); }} className={cn("flex flex-col items-center gap-1 group", disabled && "opacity-50 pointer-events-none")}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-500/20 flex items-center justify-center border border-cyan-500/20 group-hover:from-cyan-500/30 group-hover:to-sky-500/30 group-hover:border-cyan-400/40 transition-all active:scale-90">
                        <CalendarClock className="h-4.5 w-4.5 text-cyan-500" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">Agendar</span>
                    </button>
                  )}

                  {/* Vídeo */}
                  {onMakeCall && (
                    <button type="button" disabled={disabled} onClick={() => { onMakeCall('video'); setIsPlusOpen(false); }} className={cn("flex flex-col items-center gap-1 group", disabled && "opacity-50 pointer-events-none")}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center border border-indigo-500/20 group-hover:from-indigo-500/30 group-hover:to-blue-500/30 group-hover:border-indigo-400/40 transition-all active:scale-90">
                        <Video className="h-4.5 w-4.5 text-indigo-500" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">Vídeo</span>
                    </button>
                  )}

                  {/* Chamada */}
                  {onMakeCall && (
                    <button type="button" disabled={disabled} onClick={() => { onMakeCall('voice'); setIsPlusOpen(false); }} className={cn("flex flex-col items-center gap-1 group", disabled && "opacity-50 pointer-events-none")}>
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center border border-teal-500/20 group-hover:from-teal-500/30 group-hover:to-cyan-500/30 group-hover:border-teal-400/40 transition-all active:scale-90">
                        <PhoneCall className="h-4.5 w-4.5 text-teal-500" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">Chamada</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submenu da Câmera (quando clicado) */}
        {activeMenu === "camera" && (
          <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 duration-150">
            <button
              type="button"
              disabled={disabled}
              onClick={() => { photoInputRef.current?.click(); setActiveMenu("main"); }}
              className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 transition-all hover:bg-accent/50 active:scale-[0.95]", disabled && "opacity-50")}
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg">
                <Camera className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-foreground">Tirar Foto</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => { videoInputRef.current?.click(); setActiveMenu("main"); }}
              className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 transition-all hover:bg-accent/50 active:scale-[0.95]", disabled && "opacity-50")}
            >
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white shadow-lg">
                <Video className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium text-foreground">Gravar Vídeo</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2">
          {isHoldRecording ? (
            <div className={cn(
              "flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-2xl border transition-all duration-300 shadow-sm",
              isLockedRecording 
                ? "bg-red-500/10 border-red-500/35 animate-pulse" 
                : "bg-destructive/5 border-destructive/20"
            )}>
              {/* Pulse recording dot */}
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              
              {/* Text label / duration */}
              <span className="text-[11px] font-bold text-red-500 tabular-nums uppercase tracking-wide">
                {isLockedRecording ? "Gravando Travado" : "Gravando"} {formatRecTime(holdDuration)}
              </span>
              
              {/* Waveform visualizer */}
              <div className="flex-1 flex justify-center min-w-0 px-2">
                <AudioVisualizer stream={activeStream} />
              </div>

              {/* Para onde vai ser dublado — evita a surpresa depois de gravar */}
              {audioTranslateEnabled && (
                <span
                  className="hidden sm:flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 flex-shrink-0"
                  title={`A dublagem sairá em ${findDubbingLanguage(voiceTranslateTarget).name}`}
                >
                  <Languages className="h-3 w-3" />
                  <span>{findDubbingLanguage(voiceTranslateTarget).flag} {findDubbingLanguage(voiceTranslateTarget).name}</span>
                </span>
              )}

              {/* Locked/Unlocking helper */}
              {!isLockedRecording && (
                <div className="hidden sm:flex items-center gap-1 text-[9px] text-muted-foreground animate-pulse mr-1">
                  <Lock className="h-3 w-3" />
                  <span>Toque/Deslize para travar</span>
                </div>
              )}

              {/* Trash/Cancel Button */}
              {isLockedRecording ? (
                <button
                  type="button"
                  onClick={cancelHoldRecording}
                  className="p-1.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors shadow-sm"
                  title="Excluir gravação"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancelHoldRecording}
                  className="text-xs font-semibold text-muted-foreground hover:text-red-500 transition-colors ml-auto flex-shrink-0"
                >
                  Cancelar
                </button>
              )}

              {/* Lock Toggle Button (for simple tap/click locking) */}
              {!isLockedRecording && (
                <button
                  type="button"
                  onClick={lockRecording}
                  className="p-1.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-all flex-shrink-0"
                  title="Travar gravação"
                >
                  <Unlock className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 min-w-0 relative">
              <MentionTextarea
                ref={textareaRef}
                value={message}
                onChange={handleInput}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                disabled={disabled}
                className="w-full min-h-[72px] max-h-[200px] resize-none rounded-[22px] border-none bg-accent/40 shadow-inner px-4 py-2.5 text-[15px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 pr-[70px] sm:pr-[120px] transition-all duration-300"
                style={{ height: `${BASE_HEIGHT}px` }}
              />
              {autoCorrectEnabled && message.trim().length > 3 && (
                <div className={cn(
                  "absolute top-1/2 -translate-y-1/2 flex items-center z-50",
                  onTranslateRequest ? "right-[78px] sm:right-[128px]" : "right-3"
                )}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-muted"
                    disabled={isCheckingText}
                    onClick={handleManualTextCheck}
                    title="Verificar e corrigir erros de português/ortografia"
                  >
                    {isCheckingText ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className={cn("h-4 w-4", textCorrection && "text-amber-500")} />
                    )}
                  </Button>
                </div>
              )}
              {onTranslateRequest && message.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center bg-background border rounded-full shadow-sm z-50">
                  {savedLang ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-[10px] font-medium text-primary hover:bg-primary/10 rounded-l-full rounded-r-none border-r border-border"
                        disabled={isTranslatingInput}
                        onClick={() => handleTranslateInput(savedLang)}
                        title={`Traduzir para ${LANGUAGES.find(l => l.code === savedLang)?.name || savedLang}`}
                      >
                        {isTranslatingInput ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Languages className="h-3 w-3 mr-1" />}
                        <span className="hidden sm:inline">{LANGUAGES.find(l => l.code === savedLang)?.name}</span>
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-6 rounded-r-full rounded-l-none hover:bg-muted" disabled={isTranslatingInput}>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-40 p-2 z-50">
                          <div className="text-xs font-semibold mb-2 px-2 text-muted-foreground">Mudar idioma:</div>
                           <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                            {LANGUAGES.map(l => (
                              <Button key={l.code} variant="ghost" size="sm" className={cn("justify-start text-xs h-7", savedLang === l.code && "bg-muted font-medium text-primary")} onClick={() => handleTranslateInput(l.code)}>
                                {l.name}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" disabled={isTranslatingInput}>
                          {isTranslatingInput ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-40 p-2 z-50">
                        <div className="text-xs font-semibold mb-2 px-2 text-muted-foreground">Traduzir para:</div>
                        <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                          {LANGUAGES.map(l => (
                            <Button key={l.code} variant="ghost" size="sm" className="justify-start text-xs h-7" onClick={() => handleTranslateInput(l.code)}>{l.name}</Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Botão + para abrir painel de ações */}
          {!message.trim() && !isHoldRecording && (
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 rounded-full border transition-all shadow-sm",
                isPlusOpen
                  ? "bg-primary/10 border-primary/30 text-primary rotate-45"
                  : "hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
              )}
              disabled={disabled}
              onClick={() => setIsPlusOpen((prev) => !prev)}
              title="Mais opções"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6 transition-transform" />
            </Button>
          )}

          {/* Send / Mic button: shows send when text exists, mic when empty */}
          {message.trim() ? (
            <Button
              onClick={handleSend}
              disabled={disabled}
              size="icon"
              className="bg-gradient-to-r from-primary to-secondary h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 rounded-full shadow-md active:scale-95 transition-all"
            >
              <Send className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </Button>
          ) : isHoldRecording ? (
            isLockedRecording ? (
              <Button
                onClick={stopHoldRecording}
                disabled={disabled}
                size="icon"
                className="bg-gradient-to-r from-green-500 to-emerald-600 h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 rounded-full shadow-lg hover:shadow-green-500/20 active:scale-95 transition-all animate-bounce"
                title="Enviar áudio gravado"
              >
                <Send className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-white" />
              </Button>
            ) : (
              <div className="relative">
                <Button
                  size="icon"
                  className="bg-destructive hover:bg-destructive/90 h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 rounded-full animate-pulse shadow-md"
                  onMouseUp={stopHoldRecording}
                  onTouchEnd={(e) => { e.preventDefault(); stopHoldRecording(); }}
                >
                  <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                </Button>
              </div>
            )
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 rounded-full border hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-600 transition-all shadow-sm"
              disabled={disabled}
              onMouseDown={startHoldRecording}
              onTouchStart={(e) => { e.preventDefault(); startHoldRecording(); }}
              onMouseUp={() => { if (!isLockedRecording) stopHoldRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); if (!isLockedRecording) stopHoldRecording(); }}
              title="Segure para gravar ou toque para falar"
            >
              <Mic className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Modal da Câmera Customizada */}
      <CameraCaptureModal 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(file) => {
          onMediaReady([file]);
          setIsCameraOpen(false);
        }} 
      />

      {/* Hidden inputs for native camera photo & video capture (for PWA / Mobile) */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "block", opacity: 0, position: "absolute", pointerEvents: "none", width: 0, height: 0, overflow: "hidden" }}
        ref={photoInputRef}
        onChange={handlePhotoCapture}
      />
      <input
        type="file"
        accept="video/*"
        capture="environment"
        style={{ display: "block", opacity: 0, position: "absolute", pointerEvents: "none", width: 0, height: 0, overflow: "hidden" }}
        ref={videoInputRef}
        onChange={handleVideoCapture}
      />

    </div>
  );
}
