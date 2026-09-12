/**
 * =============================================================================
 * File: src/pages/Messages.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Alterado em: 2026-06-13
 * Alterações:
 *  - Tradução automática refeita com API Google Translate (sem chave de API).
 *  - Header do chat redesenhado: mood badge ao lado do nome, botão Ações
 *    (dropdown com SaveMode + Tradução automática), lixeira corrigida (z-index).
 *  - Botão de 3 pontinhos (MoreVertical) removido do header.
 *  - handleTranslate: traduz sempre, independente da detecção de idioma.
 *  - callTranslateApi usa Google Translate client-side como primário.
 *  - Botão de solicitação de localização reativado.
 *  - Sincronização em tempo real de solicitações de localização via broadcast channel.
 *  - Toggle "Traduzir Áudio" adicionado no menu de Ações.
 *  - Adicionado suporte a modo de seleção inline e exclusão de mensagens individuais
 *    diretamente na tela do chat, com menu de opções na lixeira (excluir toda a conversa vs selecionar).
 * =============================================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openDb } from "@/lib/openDb";
import { PqBadge } from "@/components/security/PqBadge";
import {
  isEncryptedContent,
  pqDecryptBatch,
  pqEnsureIdentityPublished,
  pqTryEncryptForGroup,
  pqTryEncryptText,
} from "@/lib/pq";
import {
  Search,
  MoreVertical,
  Mic,
  Wand2,
  UserPlus,
  MessageSquarePlus,
  Users,
  MessageCircle,
  ArrowDown,
  ChevronLeft,
  User,
  Inbox,
  Loader2,
  Clock,
  Play,
  Pause,
  Languages,
  Globe,
  Check,
  ChevronDown,
  X,
  ArrowRight,
  Volume2,
  VolumeX,
  MapPin,
  Trash2,
  Menu,
  Sun,
  Moon,
  Zap,
  Phone,
  Video,
  CheckSquare,
  Square,
  ChevronUp,
  AlertTriangle,
  Headphones,
  Lock,
  Info,
  Pencil,
  ShieldX,
  ShieldCheck,
  MessageSquare,
  Star,
  Sparkles,
  Heart
} from "lucide-react";
import AttentionButton from "@/components/realtime/AttentionButton";
import BackButton from "@/components/BackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserLink } from "@/components/UserLink";
import { MoodStatusBadge } from "@/components/mood/MoodStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { MentionText } from "@/components/MentionText";
import { ScrollArea } from "@/components/ui/scroll-area";
import AddFriend from "@/components/AddFriend";
import ContactsList from "@/components/ContactsList";
import FriendRequests from "@/components/FriendRequests";
import CreatePrivateRoom from "@/components/CreatePrivateRoom";
import { MessageInput } from "@/components/MessageInput";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useSearchParams, useNavigate } from "react-router-dom";
import { deleteAttentionCall, markAttentionCallViewed } from "@/utils/push";
import { uploadToCloudinary, blobToFile } from "@/integrations/cloudinary/upload";
import { SaveModeToggle, useSaveModeStatus } from "@/components/chat/SaveModeToggle";
import { Switch } from "@/components/ui/switch";
import { DeleteConversationModal } from "@/components/chat/DeleteConversationModal";
import { ScheduleMessageModal } from "@/components/chat/ScheduleMessageModal";
import { VoiceSampleDialog } from "@/components/chat/VoiceSampleDialog";
import { usePlatformSounds } from "@/hooks/usePlatformSounds";
import { useCalls } from "@/hooks/useCalls";
import { usePermissions } from "@/contexts/PermissionContext";
import { useUnifiedTranslation, type AudioTranslationResult } from "@/hooks/useUnifiedTranslation";
import { BlockUserModal } from "@/components/chat/BlockUserModal";
import { useBlockedUsers, useBlockUser } from "@/hooks/useUserBlocks";
import { useFriendRequestsReceived, useSendFriendRequest, useAcceptFriendRequest, useRejectFriendRequest } from "@/hooks/useFriendRequests";
import { FriendRequestWithMessage } from "@/components/chat/FriendRequestWithMessage";
import { EmojiPicker } from "@/components/chat/EmojiPicker";

import { ReactionPicker } from "@/components/reactions/ReactionPicker";
import { ReactionBar, type ReactionRow } from "@/components/reactions/ReactionBar";
import { PollCard, type PollRow, type PollOptionRow } from "@/components/polls/PollCard";
import { CreatePollModal, type CreatePollPayload } from "@/components/polls/CreatePollModal";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import { GroupInfoSheet } from "@/components/groups/GroupInfoSheet";
import { Textarea } from "@/components/ui/textarea";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


// --- Interfaces ---
interface MessageTimer {
  messageId: string;
  timeLeft: number;
  expiryTime: number;
  status: 'counting' | 'deleting' | 'showingUndoing' | 'deleted';
  currentText?: string;
  messageType: 'text' | 'audio' | 'media' | 'sticker' | 'location_request' | 'location';
}

interface AttentionTimer {
  callId: string;
  timeLeft: number;
  expiryTime: number;
  status: 'counting' | 'deleting' | 'showingUndoing' | 'deleted';
  originalText: string;
  currentText?: string;
}

interface TranslationState {
  messageId: string;
  originalText: string;
  translatedText: string;
  isTranslated: boolean;
  isLoading: boolean;
  targetLang: string;
  sourceLang?: string;
  isManual?: boolean;
  hasFailed?: boolean;
  revealOriginal?: boolean;
}

interface DubbingState {
  messageId: string;
  dubbingId?: string;
  dubbedAudioUrl?: string;
  originalText?: string;
  translatedText?: string;
  sourceLang?: string;
  targetLang?: string;
  activeAudioType?: 'dubbed' | 'original';
  stage?: string;
  errorMessage?: string;
  sourceUrl?: string;
  isLoading: boolean;
  hasFailed: boolean;
  showTranscription?: boolean;
  /** Como a voz foi gerada: cloned | edresson | human | google. */
  method?: string;
  /** Nome amigavel da voz ("Sua voz", "Camila", "Voz Edresson (pt-BR)"). */
  voice?: string;
}

interface CustomAudioPlayerProps {
  audioUrl: string;
  className?: string;
  onPlay: () => void;
  isOwn: boolean;
}

interface SpeechState {
  messageId: string;
  isSpeaking: boolean;
}

interface AttentionCallRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  viewed_at: string | null;
  created_at: string;
}

// Lista de idiomas disponíveis
const AVAILABLE_LANGUAGES = [
  { code: 'pt', name: 'Português (BR)', flag: '🇧🇷', nativeName: 'Português', speechLang: 'pt-BR' },
  { code: 'en', name: 'Inglês', flag: '🇺🇸', nativeName: 'English', speechLang: 'en-US' },
  { code: 'es', name: 'Espanhol', flag: '🇪🇸', nativeName: 'Español', speechLang: 'es-ES' },
  { code: 'fr', name: 'Francês', flag: '🇫🇷', nativeName: 'Français', speechLang: 'fr-FR' },
  { code: 'de', name: 'Alemão', flag: '🇩🇪', nativeName: 'Deutsch', speechLang: 'de-DE' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', nativeName: 'Italiano', speechLang: 'it-IT' },
  { code: 'ja', name: 'Japonês', flag: '🇯🇵', nativeName: '日本語', speechLang: 'ja-JP' },
  { code: 'ko', name: 'Coreano', flag: '🇰🇷', nativeName: '한국어', speechLang: 'ko-KR' },
  { code: 'zh', name: 'Chinês', flag: '🇨🇳', nativeName: '中文', speechLang: 'zh-CN' },
  { code: 'ru', name: 'Russo', flag: '🇷🇺', nativeName: 'Русский', speechLang: 'ru-RU' },
  { code: 'ar', name: 'Árabe', flag: '🇸🇦', nativeName: 'العربية', speechLang: 'ar-SA' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी', speechLang: 'hi-IN' },
];

// Funções auxiliares para idiomas...
const getLanguageName = (code: string): string => {
  const lang = AVAILABLE_LANGUAGES.find(l => l.code === code);
  return lang ? lang.name : code.toUpperCase();
};

const getLanguageNativeName = (code: string): string => {
  const lang = AVAILABLE_LANGUAGES.find(l => l.code === code);
  return lang ? lang.nativeName : code.toUpperCase();
};

const getSpeechLang = (code: string): string => {
  const lang = AVAILABLE_LANGUAGES.find(l => l.code === code);
  return lang ? lang.speechLang : 'pt-BR';
};

const normalizeLang = (code?: string): string =>
  (code || '').toLowerCase().trim().replace(/[-_].*$/, '');

const getLanguageFlag = (code?: string): string => {
  const lang = AVAILABLE_LANGUAGES.find(l => l.code === normalizeLang(code));
  return lang ? lang.flag : '🌐';
};

// Codigos de erro da funcao translate-audio -> texto que o usuario entende.
const DUBBING_ERROR_LABELS: Record<string, string> = {
  VOICE_SAMPLE_REQUIRED: 'Para dublar, registre uma amostra da sua voz',
  NO_SPEECH: 'Não foi possível entender a fala deste áudio',
  ASR_FAILED: 'Não foi possível transcrever o áudio agora',
  TRANSLATION_FAILED: 'Serviço de tradução indisponível no momento',
  TTS_FAILED: 'Não foi possível gerar a voz agora',
  ELEVENLABS_UNAUTHORIZED: 'Serviço de voz indisponível no momento',
  ELEVENLABS_NOT_CONFIGURED: 'Serviço de voz indisponível no momento',
  ELEVENLABS_PLAN_REQUIRED: 'Serviço de voz indisponível no momento',
  FISH_UNAUTHORIZED: 'Serviço de voz indisponível no momento',
  FISH_NOT_CONFIGURED: 'Serviço de voz indisponível no momento',
  FISH_LIMIT: 'Limite gratuito de voz atingido. Tente mais tarde.',
  FREEAI_LIMIT: 'Limite gratuito de voz atingido. Tente mais tarde.',
  VOICE_CLONE_FAILED: 'Não foi possível registrar a sua voz. Grave outra amostra.',
  VOICE_SAMPLE_TOO_SHORT: 'A amostra de voz ficou curta demais (mínimo 3s)',
  BACKEND_NOT_CONFIGURED: 'Serviço de dublagem indisponível no momento',
};

const getDubbingErrorLabel = (code?: string): string =>
  (code && DUBBING_ERROR_LABELS[code]) || code || 'Dublagem indisponível';

const DUBBING_STAGE_LABELS: Record<string, string> = {
  fetching: 'Baixando áudio...',
  voice_clone: 'Preparando a sua voz...',
  transcribing: 'Transcrevendo áudio...',
  translating: 'Traduzindo texto...',
  dubbing: 'Gerando a dublagem...',
};

/** Selo com a voz que gerou a dublagem, exibido na bolha do áudio. */
const DUBBING_VOICE_BADGES: Record<string, { label: (voice?: string) => string; className: string }> = {
  cloned: {
    label: (voice) => `${voice || 'Sua voz'} ✨`,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  edresson: {
    label: (voice) => `${voice || 'Voz Edresson'} 🇧🇷`,
    className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
  },
  elevenlabs: {
    label: () => 'Voz neural ✨',
    className: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30',
  },
  human: {
    label: (voice) => `Voz ${voice || 'humana'} 🎙️`,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  google: {
    label: () => 'Voz Google 🔊',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
};

// Componente compacto para escolher o idioma de tradução/dublagem
const LanguageQuickPicker = ({ value, onChange }: { value: string; onChange: (code: string) => void }) => {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const current = AVAILABLE_LANGUAGES.find(l => l.code === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-medium bg-muted/50 border border-border/50 rounded-full px-2.5 py-1 hover:bg-muted transition-colors"
        title="Escolher idioma de tradução"
      >
        <span className="text-sm leading-none">{current?.flag || '🌐'}</span>
        <span className="max-w-[70px] truncate">{current?.name?.split(' ')[0] || 'Idioma'}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 bg-popover border border-border shadow-xl rounded-2xl p-2 w-56 max-h-[260px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pb-1">Idioma de tradução</p>
            {AVAILABLE_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                type="button"
                onClick={() => { onChange(lang.code); setOpen(false); }}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-xs rounded-lg flex items-center gap-2 hover:bg-accent transition-colors",
                  value === lang.code && "bg-accent/60"
                )}
              >
                <span className="text-sm leading-none">{lang.flag}</span>
                <span className="flex-1">{lang.name}</span>
                {value === lang.code && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </div>
      )}
    </div>
  );
};

// --- Componente do Menu de Idiomas ---
const LanguageMenuModal = ({
  messageId,
  originalText,
  currentTranslation,
  onTranslate,
  onClose,
  title = "Traduzir mensagem",
  footerHint = "A tradução é feita pelo Google Translate, sem custo."
}: {
  messageId: string;
  originalText: string;
  currentTranslation?: TranslationState;
  onTranslate: (messageId: string, text: string, targetLang: string) => void;
  onClose: () => void;
  title?: string;
  footerHint?: string;
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'popular' | 'all'>('popular');

  const popularLanguages = AVAILABLE_LANGUAGES.filter(lang =>
    ['pt', 'en', 'es', 'fr', 'de', 'it'].includes(lang.code)
  );

  const handleLanguageSelect = (targetLang: string) => {
    onTranslate(messageId, originalText, targetLang);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-popover border shadow-2xl rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b bg-muted/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">{title}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 pt-3 flex-shrink-0">
          <Tabs value={selectedCategory} onValueChange={(v: any) => setSelectedCategory(v)} className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-9">
              <TabsTrigger value="popular" className="text-sm">Populares</TabsTrigger>
              <TabsTrigger value="all" className="text-sm">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 mt-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-1 pb-4">
            {currentTranslation?.isTranslated && (
              <button
                className="w-full text-left px-3 py-3 text-sm hover:bg-accent hover:text-accent-foreground rounded-md flex items-center gap-3 font-medium text-primary border border-primary/20 mb-2"
                onClick={() => handleLanguageSelect('original')}
              >
                <X className="h-4 w-4" />
                <div className="flex-1">
                  <div>Ver Original</div>
                  <div className="text-xs text-muted-foreground">{getLanguageNativeName(currentTranslation.sourceLang || 'auto')}</div>
                </div>
                <Check className="h-4 w-4 text-primary" />
              </button>
            )}

            {(selectedCategory === 'popular' ? popularLanguages : AVAILABLE_LANGUAGES).map((lang) => (
              <button
                key={lang.code}
                className={cn(
                  "w-full text-left px-3 py-3 text-sm hover:bg-accent hover:text-accent-foreground rounded-md flex items-center gap-3 transition-colors",
                  currentTranslation?.targetLang === lang.code && currentTranslation.isTranslated && "bg-accent/50"
                )}
                onClick={() => handleLanguageSelect(lang.code)}
              >
                <span className="text-base pointer-events-none">{lang.flag}</span>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden items-start pointer-events-none">
                  <span className="font-medium">{lang.name}</span>
                  <span className="text-xs text-muted-foreground">{lang.nativeName}</span>
                </div>
                {currentTranslation?.targetLang === lang.code && currentTranslation.isTranslated && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0 pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t bg-muted/10 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Globe className="h-3 w-3" />
            <span>{footerHint}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CustomAudioPlayer Component ---
const CustomAudioPlayer = ({ audioUrl, className, onPlay, isOwn }: CustomAudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasTriggeredOnPlay = useRef(false);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
        if (!hasTriggeredOnPlay.current) {
          hasTriggeredOnPlay.current = true;
          onPlay(); // Dispara o início do timer apenas no primeiro Play
        }
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentTime(current);
      setDuration(dur);
      const progressValue = (current / dur) * 100;
      setProgress(isNaN(progressValue) ? 0 : progressValue);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTimePlayer = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || isNaN(duration) || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percent * 100);
  };

  return (
    <div className={cn("flex items-center gap-3 p-2 rounded-full shadow-lg transition-all duration-200 border", isOwn ? "bg-primary text-primary-foreground" : "bg-card border text-foreground/80", className)}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onLoadedMetadata={handleLoadedMetadata}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
        src={audioUrl}
      />
      <Button
        variant={isOwn ? "secondary" : "default"}
        size="icon"
        onClick={handlePlayPause}
        className={cn("flex-shrink-0 h-9 w-9 rounded-full hover:bg-opacity-80 transition-colors duration-150", isOwn ? "text-primary" : "text-primary-foreground")}
      >
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-[1px]" />}
      </Button>
      <div className="flex-1 min-w-0 space-y-1 pr-2">
        <div className="w-full h-5 relative rounded-full overflow-hidden cursor-pointer bg-muted/40" onClick={handleSeek}>
          <div className={cn("absolute inset-y-0 left-0 transition-all duration-100 ease-linear", isOwn ? "bg-background/70" : "bg-primary/60")} style={{ width: `${progress}%` }} />
          <div className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full shadow-md transition-all duration-100 ease-linear", isOwn ? "bg-secondary" : "bg-primary")} style={{ left: `calc(${progress}% - 8px)` }} />
        </div>
        <div className="flex justify-between text-xs font-medium opacity-80">
          <span className={isOwn ? "text-primary-foreground/80" : "text-primary"}>{formatTimePlayer(currentTime)}</span>
          <span className={isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}>{formatTimePlayer(duration)}</span>
        </div>
      </div>
    </div>
  );
};

// --- Componente Principal Messages ---
export default function Messages() {
  const { user } = useAuth();
  const { markAsRead: markMessagesAsRead } = useUnreadMessages();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { playSend, playReceive } = usePlatformSounds();
  const { makeCall } = useCalls();
  const { requestPermission } = usePermissions();
  
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("udg_theme") as "light" | "dark") || 
      (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light");
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("udg_theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  };

  // Zera o contador do menu quando a tela de mensagens é aberta
  useEffect(() => {
    if (!user) return;
    void markMessagesAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Presença global (corrige 'todos sempre online' usando key por usuário)
  useEffect(() => {
    if (!user?.id) return;

    // Evita recriar a cada render
    if (presenceChannelRef.current) return;

    const channel = supabase.channel("udg_global_presence", {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;

    const track = async () => {
      try {
        const nowIso = new Date().toISOString();
        await channel.track({ last_seen: nowIso });

        // Presence do Supabase só mostra usuários conectados. Para exibir "última vez online"
        // mesmo quando o usuário está offline, persistimos no perfil.
        // (requer coluna profiles.last_seen no Supabase)
        void supabase
          .from('profiles')
          .update({ last_seen: nowIso })
          .eq('id', user.id)
          .then(() => undefined, () => undefined);
      } catch {
        // ignore
      }
    };

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as any;
      const next: Record<string, { last_seen?: string }> = {};
      Object.entries(state).forEach(([key, arr]: any) => {
        const meta = arr?.[0]?.metas?.[0] ?? arr?.[0];
        next[key] = { last_seen: meta?.last_seen };
      });
      setPresenceMap(next);
    });

    let interval: any = null;
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await track();
        interval = setInterval(track, 20000);
      }
    });

    return () => {
      if (interval) clearInterval(interval);
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "contacts">("chats");
  const [searchParams, setSearchParams] = useSearchParams();

  const selectConversation = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set('conversation', id);
      } else {
        next.delete('conversation');
      }
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const conv = searchParams.get('conversation');
    const tab = searchParams.get('tab') as any;
    if (tab === 'contacts' || tab === 'chats') setSidebarTab(tab);
    setSelectedConversation(conv || null);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedConversation) return;
    try { localStorage.setItem("udg_last_conversation", selectedConversation); } catch { /* ignore */ }
  }, [selectedConversation]);

  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [messageTimers, setMessageTimers] = useState<MessageTimer[]>([]);
  const [deletedMessages, setDeletedMessages] = useState<Set<string>>(new Set());

  const [attentionTimers, setAttentionTimers] = useState<AttentionTimer[]>([]);
  const [deletedAttentionCalls, setDeletedAttentionCalls] = useState<Set<string>>(new Set());

  const [translations, setTranslations] = useState<TranslationState[]>([]);
  const [dubbingStates, setDubbingStates] = useState<DubbingState[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [speechStates, setSpeechStates] = useState<SpeechState[]>([]);

  // Hook unificado de tradução/dublagem
  const { translateAudio: translateAudioUnified, isTranslatingAudio } = useUnifiedTranslation(user?.id || null);

  //        Fase 1 social: grupos, reações, edição de mensagem, enquetes       
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEditMsg, setIsSavingEditMsg] = useState(false);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [isReactionBusyId, setIsReactionBusyId] = useState<string | null>(null);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  // Novas features sociais
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string; avatar?: string | null } | null>(null);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [selectedEmojiPack, setSelectedEmojiPack] = useState("reactions");

  const { mutate: blockUser } = useBlockUser();
  const { data: blockedUsers } = useBlockedUsers();
  const { data: receivedRequests } = useFriendRequestsReceived();
  const sendFriendRequest = useSendFriendRequest();
  const acceptFriendRequest = useAcceptFriendRequest();
  const rejectFriendRequest = useRejectFriendRequest();

  // Auto-translate toggle     when ON, all incoming messages are translated automatically
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(() => {
    try { return localStorage.getItem('chat_auto_translate') === '1'; } catch { return false; }
  });
  const autoTranslateSkipRef = useRef<Set<string>>(new Set());

  const [autoTranslateLang, setAutoTranslateLang] = useState<string>(() => {
    // Sempre um codigo de 2 letras suportado ('pt-BR' -> 'pt'). Codigos com regiao
    // quebravam a API de traducao e a busca de nome/bandeira do idioma.
    const supported = AVAILABLE_LANGUAGES.map(l => l.code);
    try {
      const stored = normalizeLang(localStorage.getItem('chat_auto_translate_lang') || '');
      if (stored && supported.includes(stored)) return stored;
      const navLang = normalizeLang(navigator.language || 'pt-BR');
      return supported.includes(navLang) ? navLang : 'pt';
    } catch { return 'pt'; }
  });

  // Persiste o idioma escolhido (antes a escolha se perdia ao recarregar).
  useEffect(() => {
    try { localStorage.setItem('chat_auto_translate_lang', autoTranslateLang); } catch { /* storage cheio/bloqueado */ }
  }, [autoTranslateLang]);

  // Trocou o idioma alvo: libera as mensagens para serem traduzidas de novo.
  const changeAutoTranslateLang = useCallback((code: string) => {
    const next = normalizeLang(code) || 'pt';
    setAutoTranslateLang(prev => {
      if (prev !== next) autoTranslateSkipRef.current.clear();
      return next;
    });
  }, []);


  const toggleAutoTranslate = () => {
    setAutoTranslateEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_auto_translate', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // ── DUBLAGEM: duas opções independentes ────────────────────────────────────
  //
  // 1. RECEBER (`dubbingEnabled`)     — todo áudio que chega é dublado para o
  //                                     idioma que o usuário marcou como padrão
  //                                     dele (`autoTranslateLang`).
  // 2. ENVIAR  (`dubOutgoingEnabled`) — ao gravar um áudio, abre o painel de
  //                                     dublagem para mandar a sua voz em outro
  //                                     idioma.
  //
  // Antes as duas coisas viviam no MESMO interruptor: desligar a dublagem dos
  // áudios recebidos também tirava a opção de dublar o que você grava (e
  // vice-versa). Agora cada uma tem a sua chave.
  const [dubbingEnabled, setDubbingEnabled] = useState(() => {
    try { return localStorage.getItem('chat_translate_audio') !== '0'; } catch { return true; }
  });

  const [dubOutgoingEnabled, setDubOutgoingEnabled] = useState(() => {
    try { return localStorage.getItem('chat_dub_outgoing') !== '0'; } catch { return true; }
  });

  const toggleDubbing = () => {
    setDubbingEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_translate_audio', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const toggleDubOutgoing = () => {
    setDubOutgoingEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_dub_outgoing', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  //        Amostra de voz do usuário (para clonagem Instant Clone na ElevenLabs)       
  const [voiceSampleUrl, setVoiceSampleUrl] = useState<string | null>(() => {
    try { return localStorage.getItem(`udg_voice_sample_${user?.id || ''}`) || null; } catch { return null; }
  });
  const [voiceSampleDialogOpen, setVoiceSampleDialogOpen] = useState(false);
  const [recentOwnAudioUrl, setRecentOwnAudioUrl] = useState<string | null>(null);
  const voiceSamplePromptedRef = useRef(false);

  const openVoiceSampleDialog = useCallback(async () => {
    setVoiceSampleDialogOpen(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('media_urls')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) return;
      for (const row of data || []) {
        const urls = Array.isArray(row.media_urls) ? row.media_urls : null;
        if (!urls || urls.length === 0) continue;
        const candidate = urls.length > 1 ? urls[urls.length - 1] : urls[0];
        if (typeof candidate === 'string' && candidate) {
          setRecentOwnAudioUrl(candidate);
          return;
        }
      }
    } catch { /* sem histórico */ }
  }, [user?.id]);

  const voiceSampleRef = useRef<string | null>(voiceSampleUrl);

  // A amostra fica salva por usuario. No primeiro render o `user` ainda pode nao
  // ter carregado, entao recarrega assim que o id existir (senao a dublagem pedia
  // a voz de novo mesmo com amostra ja registrada).
  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(`udg_voice_sample_${user.id}`);
      if (stored) {
        voiceSampleRef.current = stored;
        setVoiceSampleUrl(stored);
      }
    } catch { /* storage bloqueado */ }
  }, [user?.id]);

  // Correção automática de texto (ortografia/gramática)
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(() => {
    try { return localStorage.getItem('chat_auto_correct') !== '0'; } catch { return true; }
  });

  const toggleAutoCorrect = () => {
    setAutoCorrectEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_auto_correct', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Modal de exclusão de conversa
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessagesForDeletion, setSelectedMessagesForDeletion] = useState<Set<string>>(new Set());
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  // Dropdown de ações no header do chat
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const deleteMenuRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Fecha os menus do header ao clicar fora (a barra tem backdrop-blur, que
  // quebra overlays `fixed inset-0`     por isso o listener global com refs)
  useEffect(() => {
    if (!showActionsMenu && !showDeleteMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (showActionsMenu && actionsMenuRef.current && !actionsMenuRef.current.contains(t)) setShowActionsMenu(false);
      if (showDeleteMenu && deleteMenuRef.current && !deleteMenuRef.current.contains(t)) setShowDeleteMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showActionsMenu, showDeleteMenu]);

  // Presence & Typing
  const [presenceMap, setPresenceMap] = useState<Record<string, { last_seen?: string }>>({});
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const uiChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const stickerSendLockRef = useRef<{ token: string; ts: number; msgId: string } | null>(null);
  const stickerInFlightRef = useRef(false);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- TTS Functions ---
  const speakText = useCallback((text: string, messageId: string, targetLang: string = 'pt') => {
    const synth = window.speechSynthesis || (window as any).webkitSpeechSynthesis;
    if (!synth) {
      toast({ title: "Erro", description: "Seu navegador não suporta leitura de voz.", variant: "destructive" });
      return;
    }

    try {
      synth.cancel();
      setSpeechStates(prev => {
        const others = prev.filter(s => s.messageId !== messageId).map(s => ({ ...s, isSpeaking: false }));
        return [...others, { messageId, isSpeaking: true }];
      });

      const utterance = new SpeechSynthesisUtterance(text);
      const speechLang = getSpeechLang(targetLang);
      utterance.lang = speechLang;
      utterance.rate = 0.9;

      const voices = synth.getVoices();
      if (voices.length > 0) {
        const preferredVoice = voices.find(v => v.lang === speechLang);
        if (preferredVoice) utterance.voice = preferredVoice;
      }

      utterance.onend = () => setSpeechStates(prev => prev.map(s => s.messageId === messageId ? { ...s, isSpeaking: false } : s));
      utterance.onerror = () => setSpeechStates(prev => prev.map(s => s.messageId === messageId ? { ...s, isSpeaking: false } : s));

      synth.speak(utterance);
    } catch (error) {
      console.error("TTS Error:", error);
      setSpeechStates(prev => prev.map(s => s.messageId === messageId ? { ...s, isSpeaking: false } : s));
    }
  }, [toast]);

  const stopSpeech = useCallback((messageId?: string) => {
    const synth = window.speechSynthesis || (window as any).webkitSpeechSynthesis;
    if (messageId) {
      setSpeechStates(prev => prev.map(s => s.messageId === messageId ? { ...s, isSpeaking: false } : s));
    } else {
      setSpeechStates(prev => prev.map(s => ({ ...s, isSpeaking: false })));
    }
    if (synth) synth.cancel();
  }, []);

  useEffect(() => {
    return () => {
      const synth = window.speechSynthesis || (window as any).webkitSpeechSynthesis;
      if (synth) synth.cancel();
    };
  }, []);

  const getSpeechState = (messageId: string) => speechStates.find(s => s.messageId === messageId);

  // --- TRANSLATION LOGIC ---
  // Primário: Netlify Function same-origin (/.netlify/functions/translate). Ela chama o
  // Google Translate no SERVIDOR (sem CORS) e ainda cai para o MyMemory se o Google falhar.
  // Fallback 1: mesma função no domínio de produção (útil em dev sem Netlify local).
  // Fallback 2: Google Translate direto do browser (só funciona quando o CORS permite).
  //
  // Observação: chamar translate.googleapis.com direto da página costuma ser bloqueado
  // pelo CORS (a resposta não traz Access-Control-Allow-Origin), e era por isso que a
  // tradução "não fazia nada" — o erro era engolido e o texto original era devolvido.

  const TRANSLATE_ENDPOINTS = (() => {
    const list = ['/.netlify/functions/translate'];
    try {
      if (typeof window !== 'undefined' && window.location.origin !== 'https://undoing.com.br') {
        list.push('https://undoing.com.br/.netlify/functions/translate');
      }
    } catch { /* sem window */ }
    return list;
  })();

  /** Chama a Netlify Function de tradução. Retorna null se nenhuma responder. */
  const netlifyTranslate = async (
    text: string,
    targetLang: string,
    type: 'translate' | 'detect' = 'translate'
  ): Promise<{ translatedText?: string; detectedLang?: string } | null> => {
    for (const endpoint of TRANSLATE_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLang, type }),
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) continue;
        const result = await response.json();
        if (type === 'detect') {
          const lang = result?.data?.[0]?.language;
          if (lang && lang !== 'unknown') return { detectedLang: lang };
          continue;
        }
        // success:false significa que TODOS os serviços do servidor falharam
        // (o corpo devolve o texto original) — tenta o próximo endpoint.
        if (result?.success && result?.data?.translatedText) {
          return { translatedText: result.data.translatedText, detectedLang: result.data.detectedLang };
        }
      } catch {
        // tenta o próximo endpoint
      }
    }
    return null;
  };

  /**
   * Translate a single chunk via Google Translate unofficial endpoint (client-side).
   * Returns { translatedText, detectedLang } or null on failure.
   */
  const googleTranslateClient = async (
    text: string,
    targetLang: string,
    sourceLang = 'auto'
  ): Promise<{ translatedText: string; detectedLang: string } | null> => {
    try {
      const url =
        `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx` +
        `&sl=${encodeURIComponent(sourceLang)}` +
        `&tl=${encodeURIComponent(targetLang)}` +
        `&dt=t&dt=ld` +
        `&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
      const translatedText = (data[0] as any[])
        .map((p: any) => (Array.isArray(p) ? p[0] : ''))
        .filter(Boolean)
        .join('');
      if (!translatedText) return null;
      const detectedLang = sourceLang === 'auto' ? (data[2] as string || 'unknown') : sourceLang;
      return { translatedText, detectedLang };
    } catch {
      return null;
    }
  };

  const callTranslateApi = async (
    textChunk: string,
    targetLang: string
  ): Promise<{ text: string; detectedLang?: string; failed?: boolean }> => {
    const safeChunk = typeof textChunk === 'string' ? textChunk : String(textChunk || '');
    const target = normalizeLang(targetLang) || 'pt';

    // 1) Netlify Function (same-origin -> producao). Traduz no SERVIDOR: sem CORS.
    const serverResult = await netlifyTranslate(safeChunk, target, 'translate');
    if (serverResult?.translatedText) {
      return { text: serverResult.translatedText, detectedLang: serverResult.detectedLang };
    }

    // 2) Google Translate direto do browser (funciona quando o CORS permite)
    const googleResult = await googleTranslateClient(safeChunk, target, 'auto');
    if (googleResult) return { text: googleResult.translatedText, detectedLang: googleResult.detectedLang };

    // Nada respondeu: devolve o original MARCADO como falha, para a UI avisar
    // em vez de fingir que traduziu.
    console.warn('[Tradução] Todos os serviços falharam. Idioma alvo:', target);
    return { text: safeChunk, failed: true };
  };

  /**
   * Detects the language of a text. Uses Google Translate for speed and accuracy.
   * Returns an ISO language code (e.g. 'pt', 'en') or 'unknown'.
   */
  const detectLanguage = async (text: string): Promise<string> => {
    const safeText = typeof text === 'string' ? text : String(text || '');
    if (!safeText.trim()) return 'unknown';
    // 1) Netlify Function same-origin (deteccao feita no servidor)
    const server = await netlifyTranslate(safeText.slice(0, 200), 'en', 'detect');
    if (server?.detectedLang) return server.detectedLang;
    // 2) Google Translate direto do browser
    const result = await googleTranslateClient(safeText.slice(0, 200), 'en', 'auto');
    if (result?.detectedLang && result.detectedLang !== 'und') return result.detectedLang;
    return 'unknown';
  };

  const translateText = async (
    text: string,
    targetLang: string
  ): Promise<{ translatedText: string; detectedLang?: string }> => {
    const safeText = typeof text === 'string' ? text : String(text || '');
    if (!safeText.trim()) return { translatedText: safeText };

    // Google Translate handles up to ~5000 chars, but we chunk at 1000 for safety
    const CHUNK_SIZE = 1000;

    if (safeText.length <= CHUNK_SIZE) {
      const result = await callTranslateApi(safeText, targetLang);
      if (result.failed) throw new Error('TRANSLATION_UNAVAILABLE');
      return { translatedText: result.text, detectedLang: result.detectedLang };
    }

    // Large text: split by sentences and translate in parallel
    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = safeText.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [safeText];
    sentences.forEach(sentence => {
      if ((currentChunk + sentence).length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      currentChunk += sentence;
    });
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());

    const results = await Promise.all(chunks.map(chunk => callTranslateApi(chunk, targetLang)));
    if (results.every(r => r.failed)) throw new Error('TRANSLATION_UNAVAILABLE');
    return {
      translatedText: results.map(r => r.text).join(' '),
      detectedLang: results.find(r => r.detectedLang)?.detectedLang,
    };
  };

  const handleTranslate = async (messageId: string, textArg: string, targetLangArg: string, isManual: boolean = true) => {
    setOpenMenuId(null);
    const safeText = typeof textArg === 'string' ? textArg : String(textArg || '');
    // Sempre trabalha com codigo de 2 letras ('pt-br' -> 'pt'): e o que a API
    // aceita e o que as listas de idiomas/bandeiras usam.
    const targetLang = targetLangArg === 'original' ? 'original' : (normalizeLang(targetLangArg) || 'pt');
    const existingTranslation = translations.find(t => t.messageId === messageId);

    if (targetLang === 'original') {
      if (existingTranslation) setTranslations(prev => prev.map(t => t.messageId === messageId ? { ...t, isTranslated: false, isManual } : t));
      return;
    }

    if (existingTranslation?.translatedText && existingTranslation.targetLang === targetLang) {
      setTranslations(prev => prev.map(t => t.messageId === messageId ? { ...t, isTranslated: !t.isTranslated, isManual } : t));
      return;
    }

    setTranslations(prev => {
      const existing = prev.find(t => t.messageId === messageId);
      if (existing) return prev.map(t => t.messageId === messageId ? { ...t, isLoading: true, targetLang, isTranslated: false, isManual, hasFailed: false } : t);
      return [...prev, { messageId, originalText: safeText, translatedText: '', isTranslated: false, isLoading: true, targetLang, isManual, hasFailed: false }];
    });

    try {
      // translateText auto-detects language internally via Google Translate.
      // We always translate regardless of detection result     if text is already
      // in targetLang, Google will return it unchanged (no visible side-effects).
      const { translatedText, detectedLang: sourceLang } = await translateText(safeText, targetLang);

      setTranslations(prev => prev.map(t => t.messageId === messageId ? {
        ...t,
        translatedText,
        isTranslated: true,
        isLoading: false,
        targetLang,
        sourceLang: sourceLang || 'unknown',
        isManual,
        hasFailed: false,
      } : t));
      if (selectedConversation) {
        localStorage.setItem(`translate_lang_${selectedConversation}`, targetLang);
      }
    } catch (error) {
      console.error('Erro na tradução do chat:', error);
      // No modo automatico nao enche a tela de toasts: a bolha ja mostra o estado.
      if (isManual) {
        toast({ title: 'Erro na tradução', description: 'Não foi possível traduzir esta mensagem agora. Tente de novo.', variant: 'destructive' });
      }
      setTranslations(prev => prev.map(t => t.messageId === messageId ? { ...t, isLoading: false, isTranslated: false, hasFailed: true } : t));
      // Libera para tentar de novo depois (ex.: internet voltou).
      autoTranslateSkipRef.current.delete(`${messageId}|${targetLang}`);
    }
  };

  const getTranslationState = (messageId: string) => translations.find(t => t.messageId === messageId);
  const getDubbingState = (messageId: string) => dubbingStates.find(d => d.messageId === messageId);

  const getMessageType = useCallback((msg: any): 'text' | 'audio' | 'media' | 'video' | 'sticker' | 'location_request' | 'location' | 'poll' => {
    if (typeof msg?.content === 'string') {
      if (msg.content === '__location_request__') return 'location_request';
      if (msg.content.startsWith('__location__')) return 'location';
      if (msg.content === '__poll__' || msg.content.startsWith('__poll_')) return 'poll';
      if (
        msg.content === '__sticker__' ||
        msg.content === '__temp_sticker__' ||
        msg.content.startsWith('__sticker_emoji__')
      ) return 'sticker';
    }
    if (msg.content) return 'text';
    if (msg.media_urls && msg.media_urls.some((url: string) =>
      url.includes(".mp4") || url.includes(".mov") || url.includes("video_")
    )) return 'video';
    if (msg.media_urls && msg.media_urls.some((url: string) =>
      url.includes("audio_") || url.includes(".webm") || url.includes("audio") || url.includes(".mp3") || url.includes(".wav") || url.includes(".m4a")
    )) return 'audio';
    return 'media';
  }, []);

  // ====================================================================
  // DUBBING LOGIC
  // ====================================================================
  // (Moved further down below to fix reference errors)

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // --- Scroll Logic ---
  const scrollToBottom = useCallback((instant: boolean = false) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: instant ? "auto" : "smooth",
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setIsAtBottom(Math.abs(scrollHeight - scrollTop - clientHeight) <= 50);
    setShowScrollButton(Math.abs(scrollHeight - scrollTop - clientHeight) > 50);
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // --- Queries ---
  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("friend_code").eq("id", user!.id).single();
      return data;
    },
  });

  // Figurinhas personalizadas do usuário (persistidas no backend)
  const { data: userStickers, refetch: refetchUserStickers } = useQuery({
    queryKey: ["user-stickers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // OBS: não podemos selecionar coluna inexistente (ex.: sticker_url) pois a API retorna 400.
      // Fazemos uma tentativa com "url" e, se falhar por coluna não existir, tentamos "sticker_url".
      const queryStickers = (cols: string) => openDb.from('user_stickers').select(cols).eq('user_id', user!.id).order('created_at', { ascending: false });

      const tryUrl = await queryStickers('id, url, created_at');
      if (!tryUrl.error) {
        return (tryUrl.data || []).map((r: any) => ({
          ...r,
          sticker_url: r?.url,
        }));
      }

      // Fallback para ambientes antigos
      const tryStickerUrl = await queryStickers('id, sticker_url, created_at');
      if (tryStickerUrl.error) {
        console.warn('user_stickers query error:', tryStickerUrl.error);
        return [] as any[];
      }

      return (tryStickerUrl.data || []).map((r: any) => ({
        ...r,
        url: r?.sticker_url,
      }));
    },
  });

  // CORREÇÃO AQUI: Filtrar conversas apenas do usuário atual
  const { data: rawConversations, refetch: refetchConversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Primeiro, obter IDs das conversas onde o usuário atual é participante
      const { data: participantData, error: participantError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);

      if (participantError) throw participantError;

      if (!participantData || participantData.length === 0) {
        return [];
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      // Buscar conversas apenas onde o usuário é participante
      const { data, error } = await supabase
        .from("conversations")
        .select(`*, conversation_participants!inner(user_id, profiles(username, avatar_url, last_seen, full_name)), messages(id, content, created_at, media_urls, user_id, deleted_at, viewed_at)`)
        .in("id", conversationIds)
        // Garante que messages[0] seja sempre a última mensagem (corrige ordem/confusão na lista)
        .order('created_at', { foreignTable: 'messages', ascending: false })
        .limit(20, { foreignTable: 'messages' })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar mensagens salvas e aprovadas para o usuário logado
      const { data: savedData } = await supabase
        .from("saved_messages")
        .select("original_message_id")
        .eq("status", "approved")
        .or(`requester_id.eq.${user!.id},owner_id.eq.${user!.id}`);

      const savedMessageIds = new Set(
        savedData?.map(s => s.original_message_id).filter(Boolean) || []
      );

      // Mapear cada conversa para incluir o campo is_saved nas mensagens
      const conversationsWithSaved = (data || []).map(conv => ({
        ...conv,
        messages: conv.messages?.map((msg: any) => ({
          ...msg,
          is_saved: savedMessageIds.has(msg.id)
        }))
      }));

      return conversationsWithSaved;
    },
  });

  // Função para verificar se uma conversa tem mensagens válidas (ativas)
  const hasValidMessages = useCallback((conv: any) => {
    // Se não tem mensagens (sala recém-criada), é válida para iniciar chat
    if (!conv.messages || conv.messages.length === 0) return true;

    // Se tem mensagens, pelo menos uma deve ser ativa (não deletada e (não visualizada ou salva))
    const activeMessages = conv.messages.filter((msg: any) =>
      msg.deleted_at === null && (msg.viewed_at === null || msg.is_saved === true)
    );

    return activeMessages.length > 0;
  }, []);

  const processedConversations = useMemo(() => {
    if (!rawConversations || !user) return [];

    const uniqueMap = new Map();

    rawConversations.forEach((conv) => {
      const activeLastMessage = conv.messages?.find((m: any) => m.deleted_at === null);
      const lastMsgDate = activeLastMessage?.created_at
        ? new Date(activeLastMessage.created_at).getTime()
        : new Date(conv.created_at).getTime();

      const convWithDate = {
        ...conv,
        sortTime: lastMsgDate,
        // Adiciona contador de mensagens não visualizadas
        unreadCount: conv.messages?.filter((msg: any) =>
          msg.user_id !== user.id &&
          msg.viewed_at === null &&
          msg.deleted_at === null
        ).length || 0
      };

      if (conv.is_group) {
        uniqueMap.set(conv.id, convWithDate);
      } else {
        const otherParticipant = conv.conversation_participants.find((p: any) => p.user_id !== user.id);
        if (otherParticipant?.user_id) {
          const existing = uniqueMap.get(otherParticipant.user_id);
          if (!existing || lastMsgDate > existing.sortTime) {
            uniqueMap.set(otherParticipant.user_id, convWithDate);
          }
        }
      }
    });

    return Array.from(uniqueMap.values())
      .sort((a, b) => b.sortTime - a.sortTime);
  }, [rawConversations, user]);

  const { data: messages, refetch: refetchMessages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["messages", selectedConversation],
    enabled: !!selectedConversation && selectedConversation !== "null",
    queryFn: async () => {
      if (!selectedConversation || selectedConversation === "null") return [];
      const { data, error } = await supabase.from("messages")
        .select(`*, profiles:user_id(username, avatar_url)`)
        .eq("conversation_id", selectedConversation)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // 🔐 Abre os envelopes pós-quânticos ANTES de qualquer coisa a jusante.
      // Tradução, busca, menções e render passam a ver texto puro; o que
      // trafega e o que fica no banco continua cifrado.
      if (user?.id && data && data.length > 0) {
        try {
          const identity = await pqEnsureIdentityPublished(user.id);
          return (await pqDecryptBatch(data as any[], identity, user.id)) as typeof data;
        } catch (err) {
          console.warn("[pq] histórico carregado sem decifrar:", err);
        }
      }
      return data;
    },
  });

  const conversationMsgIdsRef = useRef<string[]>([]);
  useEffect(() => {
    conversationMsgIdsRef.current = ((messages as any[]) || []).map((m) => m.id);
  }, [messages]);

  const msgsKey = useMemo(() => ((messages as any[]) || []).map((m) => m.id).join(","), [messages]);
  const hasMessagesLoaded = !!messages && messages.length > 0;

  // Reações das mensagens da conversa selecionada
  const { data: reactionsData, refetch: refetchReactions } = useQuery({
    queryKey: ["message_reactions", selectedConversation, msgsKey],
    enabled: !!selectedConversation && selectedConversation !== "null" && hasMessagesLoaded,
    queryFn: async () => {
      if (!selectedConversation || selectedConversation === "null") return [] as ReactionRow[];
      const ids = conversationMsgIdsRef.current;
      if (!ids.length) return [] as ReactionRow[];
      const { data, error } = await openDb
        .from("message_reactions")
        .select("id, message_id, user_id, emoji, created_at, profiles:user_id(username, avatar_url)")
        .in("message_id", ids);
      if (error) throw error;
      return (data || []) as unknown as ReactionRow[];
    },
  });

  // Enquetes das mensagens da conversa selecionada
  const { data: pollRows, refetch: refetchPolls } = useQuery({
    queryKey: ["polls_data", selectedConversation, msgsKey],
    enabled: !!selectedConversation && selectedConversation !== "null" && hasMessagesLoaded,
    queryFn: async () => {
      if (!selectedConversation || selectedConversation === "null") return [] as PollRow[];
      const ids = conversationMsgIdsRef.current;
      if (!ids.length) return [] as PollRow[];
      const { data, error } = await openDb
        .from("polls")
        .select(`id, message_id, question, is_anonymous, expires_at, created_at,
          poll_options(id, text, poll_votes(id, option_id, user_id, created_at, profiles:user_id(username)))`)
        .in("message_id", ids);
      if (error) throw error;
      return ((data || []) as unknown as any[]).map((p) => ({
        id: p.id,
        message_id: p.message_id,
        question: p.question,
        is_anonymous: !!p.is_anonymous,
        expires_at: p.expires_at ?? null,
        created_at: p.created_at,
        poll_options: ((p.poll_options || []) as unknown as any[]).map((o) => ({
          id: o.id,
          text: o.text,
          votes: ((o.poll_votes || []) as unknown as any[]).map((v) => ({
            id: v.id,
            option_id: v.option_id,
            user_id: v.user_id,
            username: v.profiles?.username ?? null,
          })),
        })),
      })) as PollRow[];
    },
  });

  const reactionsForMessage = useCallback(
    (msgId: string) => (reactionsData || []).filter((r) => r.message_id === msgId),
    [reactionsData]
  );

  const myReactionsForMessage = useCallback(
    (msgId: string) => {
      if (!user?.id) return [] as string[];
      return reactionsForMessage(msgId)
        .filter((r) => r.user_id === user.id)
        .map((r) => r.emoji);
    },
    [reactionsForMessage, user?.id]
  );

  const pollOptionsForMessage = useCallback(
    (msgId: string): PollOptionRow[] => {
      const poll = (pollRows || []).find((p) => p.message_id === msgId);
      return (poll as any)?.poll_options || [];
    },
    [pollRows]
  );

  const myVoteOptionFor = useCallback(
    (msgId: string): string | null => {
      if (!user?.id) return null;
      const opt = pollOptionsForMessage(msgId).find((o) => o.votes.some((v) => v.user_id === user.id));
      return opt?.id ?? null;
    },
    [pollOptionsForMessage, user?.id]
  );

  // Query to fetch save requests for message saving synchronization
  const { data: saveRequests, refetch: refetchSaveRequests } = useQuery({
    queryKey: ["save_requests", selectedConversation],
    enabled: !!selectedConversation && selectedConversation !== "null",
    queryFn: async () => {
      if (!selectedConversation || selectedConversation === "null") return [];
      const { data, error } = await supabase
        .from("saved_messages")
        .select("*")
        .eq("conversation_id", selectedConversation);
      if (error) return [];
      return data || [];
    }
  });

  // Dados da conversa selecionada (para chats privados)
  const selectedConvData = useMemo(() => {
    if (!selectedConversation || !rawConversations) return null;
    return rawConversations.find(c => c.id === selectedConversation) || null;
  }, [rawConversations, selectedConversation]);

  const privatePeer = useMemo(() => {
    if (!selectedConvData || !user || selectedConvData.is_group) return null;
    return selectedConvData.conversation_participants?.find((p: any) => p.user_id !== user.id) || null;
  }, [selectedConvData, user]);

  const privatePeerId = (privatePeer?.user_id as string | undefined) ?? null;
  const privatePeerProfile = privatePeer?.profiles ?? null;
  const isPrivateChat = !!privatePeerId && !selectedConvData?.is_group;
  const isGroupChat = !!selectedConvData?.is_group;

  //        Grupo: membros, avatar e usernames disponíveis para @menção       
  const { data: groupMembers, refetch: refetchGroupMembers } = useQuery({
    queryKey: ["group_members", selectedConversation],
    enabled: !!selectedConversation && selectedConversation !== "null" && isGroupChat,
    queryFn: async () => {
      if (!selectedConversation || selectedConversation === "null") return [];
      const { data, error } = await openDb
        .from("conversation_participants")
        .select("user_id, role, created_at, profiles:user_id(username, avatar_url)")
        .eq("conversation_id", selectedConversation);
      if (error) return [];
      return ((data || []) as unknown as any[]).map((m) => ({
        user_id: m.user_id,
        role: m.role ?? "member",
        username: m.profiles?.username ?? null,
        avatar_url: m.profiles?.avatar_url ?? null,
      }));
    },
  });

  const groupMentionUsernames = useMemo(() => {
    if (!groupMembers || !user) return [];
    return groupMembers
      .filter((m: any) => m.user_id !== user.id && !!m.username)
      .map((m: any) => m.username as string);
  }, [groupMembers, user]);

  const groupAvatar = useMemo(() => {
    if (!selectedConversation || !rawConversations) return null;
    const base = rawConversations.find((c: any) => c.id === selectedConversation);
    return (base as any)?.group_avatar ?? null;
  }, [rawConversations, selectedConversation]);

  const groupMemberCount = useMemo(() => (groupMembers ? groupMembers.length : 0), [groupMembers]);

  // Modo salvar conversa ativo (interruptor global)
  const saveModeData = useSaveModeStatus(isPrivateChat ? selectedConversation : null);

  
  // Query to fetch all approved save mode periods (including historical deactivated ones)
  const { data: saveModePeriods, refetch: refetchSaveModePeriods } = useQuery({
    queryKey: ["save_mode_periods", selectedConversation],
    enabled: !!selectedConversation,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_save_mode")
        .select("started_at, deactivated_at")
        .eq("conversation_id", selectedConversation)
        .not("started_at", "is", null);
      if (error) return [];
      return data || [];
    }
  });

  const isMessageSavedByGlobalMode = useCallback((msgCreatedAt: string) => {
    if (!saveModePeriods || saveModePeriods.length === 0) return false;
    return saveModePeriods.some((period: any) => {
      const start = new Date(period.started_at).getTime();
      const end = period.deactivated_at
        ? new Date(period.deactivated_at).getTime()
        : Infinity;
      const msgTime = new Date(msgCreatedAt).getTime();
      return msgTime >= start && msgTime <= end;
    });
  }, [saveModePeriods]);

  // Escuta broadcast de save mode para atualizar queries em tempo real
  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase.channel(`save-mode-${selectedConversation}`)
      .on("broadcast", { event: "save_mode_update" }, () => {
        refetchSaveRequests();
        refetchSaveModePeriods();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, refetchSaveRequests, refetchSaveModePeriods]);

  // Escuta alterações de banco de dados para save mode em tempo real
  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase.channel(`save-mode-db-${selectedConversation}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_save_mode",
          filter: `conversation_id=eq.${selectedConversation}`,
        },
        () => {
          refetchSaveModePeriods();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, refetchSaveModePeriods]);

  // Marca como visualizadas (viewed_at) assim que o chat abrir
  useEffect(() => {
    if (!user?.id || !messages || !selectedConversation) return;

    const toMark = messages.filter((m: any) => m.user_id !== user.id && m.viewed_at == null);
    if (toMark.length === 0) return;

    const ids = toMark.map((m: any) => m.id);
    const viewedAt = new Date().toISOString();

    // Otimização: atualiza cache imediatamente
    queryClient.setQueryData(["messages", selectedConversation], (old: any) =>
      Array.isArray(old)
        ? old.map((m: any) => (ids.includes(m.id) ? { ...m, viewed_at: viewedAt } : m))
        : old
    );

    // Para figurinhas temporárias, após visualizar iniciamos a contagem de 2 minutos.
    const tempIds = toMark
      .filter((m: any) => typeof m?.content === 'string' && m.content === '__temp_sticker__')
      .map((m: any) => m.id);
    const normalIds = ids.filter((id: any) => !tempIds.includes(id));

    const markViaNetlify = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        await fetch('/.netlify/functions/mark-messages-viewed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            conversation_id: selectedConversation,
            normal_ids: normalIds,
            temp_ids: tempIds,
            viewed_at: viewedAt,
          }),
        });
      } catch {
        // silencioso
      }
    };

    (async () => {
      let hadError = false;

      if (normalIds.length) {
        const { error } = await supabase
          .from('messages')
          .update({ viewed_at: viewedAt })
          .in('id', normalIds);
        if (error) hadError = true;
      }

      if (tempIds.length) {
        const savedTempIds = tempIds.filter((id: any) => {
          const m = messages.find((msg: any) => msg.id === id);
          if (!m) return false;
          return isMessageSavedByGlobalMode(m.created_at);
        });
        const notSavedTempIds = tempIds.filter((id: any) => !savedTempIds.includes(id));

        if (savedTempIds.length > 0) {
          const { error } = await supabase.from('messages').update({ viewed_at: viewedAt }).in('id', savedTempIds);
          if (error) hadError = true;
        }

        if (notSavedTempIds.length > 0) {
          const { error } = await supabase.from('messages').update({
            viewed_at: viewedAt,
            expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString()
          }).in('id', notSavedTempIds);
          if (error) hadError = true;
        }
      }

      // Fallback (quando RLS não permite UPDATE, ou quando há inconsistência)
      if (hadError) {
        await markViaNetlify();
      }

      void refetchConversations();
    })();
  }, [messages, selectedConversation, user?.id, saveModeData, saveModePeriods]);

  // Remove figurinhas temporárias expiradas (do banco e do cache local do navegador)
  useEffect(() => {
    if (!user?.id || !selectedConversation) return;
    if (!messages || messages.length === 0) return;

    const now = Date.now();
    const expired = messages.filter((m: any) => {
      if (m?.content !== '__temp_sticker__') return false;
      if (!m?.expires_at) return false;
      const t = new Date(m.expires_at).getTime();
      return Number.isFinite(t) && t <= now;
    });

    if (expired.length === 0) return;
    const ids = expired.map((m: any) => m.id);

    // Remove do cache do navegador
    try {
      for (const id of ids) sessionStorage.removeItem(`temp_sticker:${id}`);
    } catch {
      // ignore
    }

    // Atualiza cache de mensagens imediatamente
    queryClient.setQueryData(["messages", selectedConversation], (old: any) =>
      Array.isArray(old) ? old.filter((m: any) => !ids.includes(m.id)) : old
    );

    supabase
      .from('messages')
      .delete()
      .in('id', ids)
      .then(() => {
        void refetchConversations();
      }, () => undefined);
  }, [messages, selectedConversation, user?.id]);

  // Cache local (navegador) das figurinhas temporárias, e agendamento de limpeza.
  // Isso garante que, mesmo se a mensagem for removida rapidamente do banco,
  // a imagem ainda consiga ser exibida no dispositivo por até 2 minutos.
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    try {
      for (const m of messages as any[]) {
        if (m?.content !== '__temp_sticker__') continue;
        const dataUrl = Array.isArray(m?.media_urls) ? m.media_urls?.[0] : null;
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          sessionStorage.setItem(`temp_sticker:${m.id}`, dataUrl);
        }
      }
    } catch {
      // ignore
    }
  }, [messages]);


  const peerPresence = useMemo(() => {
    if (!privatePeerId) return null;
    return presenceMap[privatePeerId] ?? null;
  }, [presenceMap, privatePeerId]);

  const onlineUserIds = useMemo(() => {
    const set = new Set<string>();
    const now = Date.now();
    for (const [uid, meta] of Object.entries(presenceMap)) {
      if (uid === user?.id) continue;
      const ls = meta?.last_seen;
      if (!ls) continue;
      const t = new Date(ls).getTime();
      if (Number.isFinite(t) && now - t < 60 * 1000) set.add(uid);
    }
    return set;
  }, [presenceMap, user?.id]);

  const peerOnline = useMemo(() => {
    const ls = peerPresence?.last_seen;
    if (!ls) return false;
    const dt = new Date(ls).getTime();
    if (!Number.isFinite(dt)) return false;
    return Date.now() - dt < 60 * 1000; // 60s
  }, [peerPresence, privatePeerProfile]);

  const peerLastSeenLabel = useMemo(() => {
    // Preferência: presença (quando online) -> fallback: profiles.last_seen (persistente)
    const ls = peerPresence?.last_seen || (privatePeerProfile as any)?.last_seen;
    if (!ls) return null;
    const d = new Date(ls);
    if (isNaN(d.getTime())) return null;
    // Exibe data + hora (pedido do usuário)
    const datePart = d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  }, [peerPresence, privatePeerProfile]);

  // Canal de UI do chat (typing, etc.)
  useEffect(() => {
    if (!selectedConversation || !user?.id) return;

    // limpa canal anterior
    if (uiChannelRef.current) {
      supabase.removeChannel(uiChannelRef.current);
      uiChannelRef.current = null;
    }

    const channel = supabase.channel(`chat-ui-${selectedConversation}`, {
      config: { broadcast: { ack: false } },
    });
    uiChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, is_typing, conversation_id } = (payload as any).payload || {};
        if (!conversation_id || conversation_id !== selectedConversation) return;
        if (!privatePeerId || user_id !== privatePeerId) return;
        setIsPeerTyping(!!is_typing);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (is_typing) {
          typingTimeoutRef.current = setTimeout(() => setIsPeerTyping(false), 3500);
        }
      })
      .on('broadcast', { event: 'save_request_update' }, () => {
        refetchSaveRequests();
        refetchConversations();
      })
      .on('broadcast', { event: 'location_update' }, () => {
        void refetchMessages();
      })
      .subscribe();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      uiChannelRef.current = null;
    };
  }, [selectedConversation, user?.id, privatePeerId]);

  //        Realtime de reações e votos de enquetes       
  useEffect(() => {
    if (!selectedConversation || selectedConversation === "null") return;
    const channel = supabase
      .channel(`social-${selectedConversation}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row?.message_id && conversationMsgIdsRef.current.includes(row.message_id)) {
            void refetchReactions();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row?.poll_id) void refetchPolls();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, refetchReactions, refetchPolls]);

  // Para renderizar "bolha" de Chamar Atenção dentro do chat
  const { data: attentionCalls, refetch: refetchAttentionCalls } = useQuery({
    queryKey: ["attention_calls_in_chat", selectedConversation, user?.id, privatePeerId],
    enabled: !!selectedConversation && !!user?.id && !!privatePeerId && isPrivateChat,
    queryFn: async () => {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
      const { data, error } = await supabase
        .from("attention_calls")
        .select("id,sender_id,receiver_id,message,viewed_at,created_at")
        .or(
          `and(sender_id.eq.${user!.id},receiver_id.eq.${privatePeerId}),and(sender_id.eq.${privatePeerId},receiver_id.eq.${user!.id})`
        )
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as AttentionCallRow[];
    },
  });

  useEffect(() => {
    if (!user || !privatePeerId || !selectedConversation) return;
    if (!isPrivateChat) return;
    const channel = supabase
      .channel(`attention-calls-chat-${selectedConversation}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attention_calls" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row) {
            refetchAttentionCalls();
            return;
          }
          const matches =
            (row.sender_id === user.id && row.receiver_id === privatePeerId) ||
            (row.sender_id === privatePeerId && row.receiver_id === user.id);
          if (!matches) return;
          refetchAttentionCalls();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, privatePeerId, selectedConversation, isPrivateChat, refetchAttentionCalls]);

  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase
      .channel(`saved-messages-chat-${selectedConversation}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_messages", filter: `conversation_id=eq.${selectedConversation}` },
        () => {
          refetchSaveRequests();
          refetchConversations();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, refetchSaveRequests, refetchConversations]);

// ====================================================================
   // DUBBING LOGIC     usa hook unificado (translate-audio Netlify Function)
   // Pipeline: STT (Whisper)     Tradução (Google)     TTS com VOZ DO PRÓPRIO USUÁRIO
   // (ElevenLabs     Fish Audio     free.ai). Sem fallback de voz sintética.

   const dubAudioMessage = useCallback(async (
     messageId: string,
     audioUrl: string,
     targetLang: string,
     opts: { silent?: boolean; sampleAudioUrl?: string } = {}
   ) => {
     const setState = (patch: Partial<DubbingState>) => {
       setDubbingStates(prev => {
         const existing = prev.find(d => d.messageId === messageId);
         if (existing) return prev.map(d => d.messageId === messageId ? { ...d, ...patch } : d);
         return [...prev, { messageId, isLoading: true, hasFailed: false, ...patch }];
       });
     };

     setState({ isLoading: true, hasFailed: false, errorMessage: undefined, targetLang, sourceUrl: audioUrl, stage: 'fetching' });

     const target = normalizeLang(targetLang);
     const safeTarget = target || 'pt';
     const sampleAudioUrl = opts.sampleAudioUrl || voiceSampleRef.current || undefined;

     try {
       setState({ stage: sampleAudioUrl ? 'voice_clone' : 'transcribing' });

       // Baixa o áudio original para enviar como Blob
       const audioRes = await fetch(audioUrl);
       if (!audioRes.ok) throw new Error(`Falha ao baixar áudio (HTTP ${audioRes.status})`);
       const audioBlob = await audioRes.blob();

       // Audio RECEBIDO: a voz e de outra pessoa, entao ele NUNCA serve de amostra.
       // A amostra e sempre a voz registrada pelo proprio usuario (quando existir).
       const dubResult = await translateAudioUnified(audioBlob, safeTarget, undefined, {
         sampleAudioUrl,
         // A voz do audio recebido e de OUTRA pessoa: nunca serve de amostra.
         useAudioAsSample: false,
         // So tenta clonar quando existe amostra registrada pelo proprio
         // usuario. Sem amostra, ir direto para a voz de retaguarda evita
         // ate 3s de espera inutil em cada audio recebido.
         tryClone: Boolean(sampleAudioUrl),
         silent: true, // o erro aparece na propria bolha do audio
       });

       // Checa o CODIGO do erro ANTES de lancar: e ele que abre o dialogo de voz.
       if (dubResult?.error === 'VOICE_SAMPLE_REQUIRED') {
         setState({
           isLoading: false,
           hasFailed: true,
           stage: 'error',
           errorMessage: 'VOICE_SAMPLE_REQUIRED',
           sourceUrl: audioUrl,
         });
         if (!voiceSamplePromptedRef.current) {
           voiceSamplePromptedRef.current = true;
           setTimeout(() => void openVoiceSampleDialog(), 400);
         }
         if (!opts.silent) {
           toast({ title: 'Voz necessária', description: 'Registre uma amostra da sua voz para dublar os áudios.' });
         }
         return;
       }

       if (!dubResult || !dubResult.success) {
         // Carrega o CODIGO do erro junto: a bolha usa ele p/ mostrar texto amigavel.
         const dubErr: any = new Error(dubResult?.message || dubResult?.error || 'Serviço de dublagem indisponível');
         dubErr.code = dubResult?.error;
         throw dubErr;
       }

       const sourceLang = dubResult.detectedLanguage ? normalizeLang(dubResult.detectedLanguage) : undefined;
       const sameLang = sourceLang === safeTarget;

       let dubbedAudioUrl: string | undefined;
       if (!sameLang && dubResult.audio) {
         setState({ stage: 'dubbing' });
         dubbedAudioUrl = dubResult.audio;
       }

       setState({
         isLoading: false,
         hasFailed: false,
         errorMessage: undefined,
         stage: 'completed',
         dubbedAudioUrl,
         originalText: dubResult.originalText,
         translatedText: dubResult.translatedText,
         sourceLang: sourceLang && sourceLang !== 'unknown' ? sourceLang : undefined,
         targetLang: safeTarget,
         sourceUrl: audioUrl,
         activeAudioType: dubbedAudioUrl ? 'dubbed' : 'original',
         showTranscription: sameLang ? true : false,
         method: dubResult.method,
         voice: dubResult.voice,
       });
} catch (error: any) {
        const msg = error?.message || '';
        const code = error?.code || '';
        const isNoSpeech = code === 'NO_SPEECH' || msg.includes('detectar fala') || msg.includes('NO_SPEECH');
        if (code === 'VOICE_SAMPLE_REQUIRED' || msg === 'VOICE_SAMPLE_REQUIRED') {
          setState({
            isLoading: false,
            hasFailed: true,
            stage: 'error',
            errorMessage: 'VOICE_SAMPLE_REQUIRED',
            sourceUrl: audioUrl,
          });
          if (!voiceSamplePromptedRef.current) {
            voiceSamplePromptedRef.current = true;
            setTimeout(() => void openVoiceSampleDialog(), 400);
          }
          if (!opts.silent) {
            toast({ title: 'Voz necessária', description: 'Registre uma amostra da sua voz para dublar os áudios.' });
          }
          return;
        }
        if (isNoSpeech) {
          // Áudio sem fala detectável     marca como falhou silenciosamente para não retententar em loop
          setState({
            isLoading: false,
            hasFailed: true,
            stage: 'error',
            errorMessage: 'NO_SPEECH',
            sourceUrl: audioUrl,
          });
          return;
        }
        console.error('Erro na dublagem:', error);
       setState({
         isLoading: false,
         hasFailed: true,
         stage: 'error',
         errorMessage: code || msg || 'Não foi possível dublar este áudio agora.',
         sourceUrl: audioUrl,
       });
       if (!opts.silent) {
         toast({
           title: 'Dublagem indisponível',
           description: 'O serviço de transcrição/dublagem está temporariamente fora do ar. Tente novamente em instantes.',
           variant: 'destructive',
         });
       }
     }
   }, [translateAudioUnified, toast, openVoiceSampleDialog]);

  // Registra a amostra de voz e re-tenta as dublagens pendentes (VOICE_SAMPLE_REQUIRED)
  const handleVoiceSampleReady = useCallback(async (url: string) => {
    voiceSampleRef.current = url;
    setVoiceSampleUrl(url);
    try { localStorage.setItem(`udg_voice_sample_${user?.id || ''}`, url); } catch {}
    setVoiceSampleDialogOpen(false);
    setDubbingStates(prev => {
      for (const d of prev) {
        if (d.hasFailed && d.errorMessage === 'VOICE_SAMPLE_REQUIRED' && d.sourceUrl && d.targetLang) {
          void dubAudioMessage(d.messageId, d.sourceUrl, d.targetLang, { silent: true, sampleAudioUrl: url });
        }
      }
      return prev;
    });
    toast({ title: 'Voz registrada', description: 'Agora os áudios serão dublados com a sua voz.' });
  }, [user?.id, toast, dubAudioMessage]);

  // Dublagem automática: só quando o toggle de dublagem está ativo.
  // LÇGICA CORRETA: se o remetente JÃ� enviou dublado (msg.dub_language definido),
  // o áudio [0] já está no idioma que ELE escolheu — NÃO re-dublar; apenas marcar.
  // Só dublamos automaticamente áudios SEM dub_language (gravações simples).
  useEffect(() => {
    if (!dubbingEnabled || !messages || messages.length === 0) return;

    const target = autoTranslateLang;
    messages.forEach((msg: any) => {
      const isOwn = msg.user_id === user?.id;
      if (isOwn) return;

      const msgType = getMessageType(msg);
      if (msgType !== 'audio') return;

      const existingDubbing = dubbingStates.find(d => d.messageId === msg.id);
      if (existingDubbing?.hasFailed) return;
      // CORRECAO: antes era `if (existingDubbing) return;` sem olhar o idioma.
      // Depois que um estado existia, trocar o idioma da dublagem nunca
      // redisparava nada (a traducao de TEXTO ja considerava o idioma na chave
      // de skip; a dublagem nao).
      if (existingDubbing && normalizeLang(existingDubbing.targetLang) === normalizeLang(target)) return;

      // CORRECAO PRINCIPAL — era AQUI que a dublagem morria.
      //
      // O remetente dubla no envio (o interruptor vem ligado por padrao), entao
      // quase todo audio recebido chega com `dub_language` preenchido. Este
      // atalho entao marcava a mensagem como "dublada" e fazia `return` — sem
      // NUNCA chamar dubAudioMessage. Resultado: nenhuma requisicao de rede
      // acontecia, e o destinatario ouvia a dublagem no idioma que o REMETENTE
      // escolheu, nao no dele.
      //
      // Agora o atalho so vale quando o idioma do remetente é o MESMO que o
      // destinatario quer. Sendo diferente, segue adiante e dubla de verdade,
      // a partir da gravacao original.
      const senderDubLang = msg.dub_language ? normalizeLang(msg.dub_language) : null;
      if (senderDubLang && senderDubLang === normalizeLang(target)) {
        setDubbingStates(prev => {
          // Substitui o estado antigo em vez de ignorar: se o usuario trocou de
          // idioma e agora ele coincide com o do remetente, o registro precisa
          // refletir isso (antes ficava preso ao idioma anterior).
          const semEste = prev.filter(d => d.messageId !== msg.id);
          return [...semEste, {
            messageId: msg.id,
            isLoading: false,
            hasFailed: false,
            stage: 'completed',
            dubbedAudioUrl: undefined,
            sourceLang: undefined,
            targetLang: msg.dub_language,
            translatedText: undefined,
            originalText: undefined,
            activeAudioType: 'dubbed' as const,
            showTranscription: false,
            sourceUrl: Array.isArray(msg.media_urls) ? msg.media_urls[0] : undefined,
          } as any];
        });
        return;
      }

      // Par [dublado, original]: dublar a partir da GRAVAÇÃO ORIGINAL (2   URL),
      // assim a dublagem sai no idioma do destinatário, não no do remetente.
      const sourceUrl = Array.isArray(msg.media_urls) && msg.media_urls.length > 1 ? msg.media_urls[1] : msg.media_urls?.[0];

      if (sourceUrl) {
        void dubAudioMessage(msg.id, sourceUrl, target, { silent: true });
      }
    });
  }, [messages, dubbingEnabled, autoTranslateLang, user?.id, getMessageType, dubbingStates, dubAudioMessage]);

  const getSelectedMessageText = () => messages?.find(m => m.id === openMenuId)?.content || '';

// LOGICA DO TIMER (Mantida versão LocalStorage/Visualização)
  // ====================================================================

  // Inicia timer de audio MANUALMENTE (ao dar play)
  const startAudioTimer = useCallback((messageId: string) => {
    // 1. Encontrar a mensagem correspondente
    const message = messages?.find((m: any) => m.id === messageId);
    if (!message) return;

    // 2. Não inicia se está aprovada individualmente para salvar
    const approvedIds = new Set(
      saveRequests
        ?.filter((r) => r.status === "approved")
        .map((r) => r.original_message_id)
        .filter(Boolean) || []
    );
    if (approvedIds.has(messageId)) return;

    // 3. Não inicia se foi enviada durante qualquer período em que o modo salvar global esteve ativo
    const isSavedByGlobalMode = isMessageSavedByGlobalMode(message.created_at);
    if (isSavedByGlobalMode) return;

    setMessageTimers(prev => {
      if (prev.find(timer => timer.messageId === messageId)) return prev;

      // Define expiração para 2 minutos a partir de AGORA (momento do Play)
      const now = Date.now();
      const expiryTime = now + 120000; // 120 segundos

      const storageKey = `timer_${user?.id}_${messageId}`;
      localStorage.setItem(storageKey, expiryTime.toString());

      return [...prev, {
        messageId,
        timeLeft: 120,
        expiryTime: expiryTime,
        status: 'counting',
        messageType: 'audio'
      }];
    });
  }, [user, messages, saveRequests, saveModePeriods]);

  // Gerencia inicialização e contagem dos timers
  useEffect(() => {
    if (!messages || !user) return;

    setMessageTimers(prev => {
      const now = Date.now();
      const newTimers: MessageTimer[] = [];
      const currentTimerIds = new Set(prev.map(t => t.messageId));

      const approvedIds = new Set(
        saveRequests
          ?.filter((r) => r.status === "approved")
          .map((r) => r.original_message_id)
          .filter(Boolean) || []
      );

      messages.forEach(message => {
        // Não inicia timer se a mensagem já estiver salva (approved via SaveMessageButton)
        if (approvedIds.has(message.id)) return;

        //     Não inicia timer se a mensagem foi enviada durante qualquer período em que o modo salvar global esteve ativo
        const isSavedByGlobalMode = isMessageSavedByGlobalMode(message.created_at);

        if (isSavedByGlobalMode) return;

        if (message.user_id === user.id || deletedMessages.has(message.id) || currentTimerIds.has(message.id)) return;

        const messageType = getMessageType(message);

        if (messageType === 'poll') return;

        const storageKey = `timer_${user.id}_${message.id}`;
        const storedExpiry = localStorage.getItem(storageKey);

        let expiryTime = 0;

        if (storedExpiry) {
          expiryTime = parseInt(storedExpiry, 10);
        } else {
          if (messageType === 'text' || messageType === 'media' || messageType === 'sticker' || messageType === 'location_request' || messageType === 'location') {
            expiryTime = now + 120000; // 2 minutos a partir da visualização
            localStorage.setItem(storageKey, expiryTime.toString());
          } else {
            return; // Audio espera play
          }
        }

        const timeLeft = Math.max(0, Math.ceil((expiryTime - now) / 1000));

        if (timeLeft > 0 || (now - expiryTime < 5000)) {
          newTimers.push({
            messageId: message.id,
            timeLeft: timeLeft,
            expiryTime: expiryTime,
            status: timeLeft <= 0 ? 'deleting' : 'counting',
            messageType: (messageType as string) === 'poll' || messageType === 'video' ? 'media' : messageType
          });
        }
      });

      if (newTimers.length === 0) return prev;
      return [...prev, ...newTimers];
    });

  }, [messages, user, deletedMessages, getMessageType, saveRequests, saveModeData, saveModePeriods]);

  // Loop de contagem
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageTimers(prev => {
        if (prev.length === 0) return prev;

        const now = Date.now();
        const updatedTimers: MessageTimer[] = [];
        const messagesToDelete: string[] = [];
        let hasChanges = false;

        const pendingIds = new Set(
          saveRequests
            ?.filter((r) => r.status === "pending")
            .map((r) => r.original_message_id)
            .filter(Boolean) || []
        );

        prev.forEach(timer => {
          if (timer.status === 'deleted') {
            hasChanges = true;
            return;
          }

          // Se a mensagem está pendente de aprovação para salvar, congela o timer
          if (pendingIds.has(timer.messageId)) {
            timer.expiryTime = Date.now() + (timer.timeLeft * 1000);
            updatedTimers.push(timer);
            return;
          }

          const realTimeLeft = Math.max(0, Math.ceil((timer.expiryTime - now) / 1000));

          if (realTimeLeft <= 0 && timer.status === 'counting') {
            hasChanges = true;
            if (timer.messageType === 'text') {
              updatedTimers.push({
                ...timer,
                timeLeft: 0,
                status: 'deleting',
                currentText: messages?.find(m => m.id === timer.messageId)?.content || '',
              });
            } else {
              updatedTimers.push({ ...timer, timeLeft: 5, status: 'showingUndoing' });
            }
          }
          else if (timer.status === 'deleting') {
            const timeSinceExpiry = Math.floor((now - timer.expiryTime) / 1000);

            if (timeSinceExpiry > 5) {
              updatedTimers.push({ ...timer, status: 'showingUndoing', timeLeft: 5, currentText: undefined });
            } else {
              if (timer.currentText) {
                const originalText = messages?.find(m => m.id === timer.messageId)?.content || '';
                const ratio = Math.min(1, timeSinceExpiry / 5);
                const lettersToKeep = Math.floor(originalText.length * (1 - ratio));
                updatedTimers.push({ ...timer, currentText: originalText.slice(0, lettersToKeep) });
              } else {
                updatedTimers.push(timer);
              }
            }
            hasChanges = true;
          }
          else if (timer.status === 'showingUndoing') {
            if (timer.timeLeft <= 0) {
              messagesToDelete.push(timer.messageId);
              if (user) localStorage.removeItem(`timer_${user.id}_${timer.messageId}`);
              updatedTimers.push({ ...timer, status: 'deleted' });
            } else {
              updatedTimers.push({ ...timer, timeLeft: timer.timeLeft - 1 });
            }
            hasChanges = true;
          }
          else {
            if (timer.timeLeft !== realTimeLeft) {
              updatedTimers.push({ ...timer, timeLeft: realTimeLeft });
              hasChanges = true;
            } else {
              updatedTimers.push(timer);
            }
          }
        });

        if (messagesToDelete.length > 0) deleteMessages(messagesToDelete);
        return hasChanges ? updatedTimers : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [messages, user, saveRequests]);

  // Remove timers para mensagens cujo pedido de salvar foi aprovado (bilateralmente salvas)
  useEffect(() => {
    if (!saveRequests || !user?.id) return;
    
    const approvedIds = new Set(
      saveRequests
        .filter((r) => r.status === "approved")
        .map((r) => r.original_message_id)
        .filter(Boolean)
    );

    if (approvedIds.size === 0) return;

    setMessageTimers((prev) => {
      const filtered = prev.filter((t) => !approvedIds.has(t.messageId));
      if (filtered.length !== prev.length) {
        prev.forEach((t) => {
          if (approvedIds.has(t.messageId)) {
            localStorage.removeItem(`timer_${user.id}_${t.messageId}`);
          }
        });
        return filtered;
      }
      return prev;
    });
  }, [saveRequests, user?.id]);

  // Remove timers para mensagens salvas pelo modo global ativo
  useEffect(() => {
    if (!saveModePeriods || !messages || !user?.id) return;

    setMessageTimers((prev) => {
      if (prev.length === 0) return prev;
      
      const filtered = prev.filter((timer) => {
        const message = messages.find((m: any) => m.id === timer.messageId);
        if (!message) return true;

        const isSavedByGlobalMode = isMessageSavedByGlobalMode(message.created_at);

        if (isSavedByGlobalMode) {
          localStorage.removeItem(`timer_${user.id}_${timer.messageId}`);
          return false;
        }
        return true;
      });

      if (filtered.length !== prev.length) {
        return filtered;
      }
      return prev;
    });
  }, [saveModePeriods, messages, user?.id]);

  // Reseta o timer para 2 minutos se o pedido de salvar for recusado
  useEffect(() => {
    if (!saveRequests || !user?.id) return;

    const rejectedRequests = saveRequests.filter((r) => r.status === "rejected");
    if (rejectedRequests.length === 0) return;

    setMessageTimers((prev) => {
      const now = Date.now();
      let hasChanges = false;
      const next = prev.map((t) => {
        const req = rejectedRequests.find((r) => r.original_message_id === t.messageId);
        if (req) {
          const storageKey = `timer_${user.id}_${t.messageId}`;
          const isResetKey = `timer_reset_${user.id}_${t.messageId}`;
          
          if (!localStorage.getItem(isResetKey)) {
            const newExpiry = now + 120000;
            localStorage.setItem(storageKey, newExpiry.toString());
            localStorage.setItem(isResetKey, "true");
            hasChanges = true;
            return {
              ...t,
              expiryTime: newExpiry,
              timeLeft: 120,
              status: "counting" as const
            };
          }
        }
        return t;
      });
      return hasChanges ? next : prev;
    });
  }, [saveRequests, user?.id]);

  // Attention calls: auto-destrói 2min após o destinatário visualizar (mesma lógica das mensagens)
  useEffect(() => {
    if (!attentionCalls || !user?.id) return;

    const receiverId = user.id;
    const senderDisplayName = privatePeerProfile?.username || privatePeerProfile?.full_name || 'Usuário';

    // Se o destinatário já visualizou e o prazo de 2m já passou, limpa na hora
    // (evita ficar reaparecendo ao reabrir o app/navegador)
    try {
      const now = Date.now();
      attentionCalls.forEach((call) => {
        if (call.receiver_id !== receiverId) return;
        if (deletedAttentionCalls.has(call.id)) return;

        const storageKey = `timer_attention_${receiverId}_${call.id}`;
        const stored = localStorage.getItem(storageKey);
        const storedExpiry = stored ? Number(stored) : NaN;
        const viewedExpiry = call.viewed_at ? (new Date(call.viewed_at).getTime() + 5 * 1000) : NaN;
        const expiryTime = Number.isFinite(storedExpiry)
          ? storedExpiry
          : Number.isFinite(viewedExpiry)
            ? viewedExpiry
            : NaN;

        if (Number.isFinite(expiryTime) && expiryTime <= now) {
          void deleteAttentionCall(call.id)
            .catch(() => undefined)
            .finally(() => {
              setDeletedAttentionCalls((prev) => {
                if (prev.has(call.id)) return prev;
                const next = new Set(prev);
                next.add(call.id);
                return next;
              });
              localStorage.removeItem(storageKey);
            });
        }
      });
    } catch {
      // noop
    }

    // Init timers (somente para o destinatário)
    setAttentionTimers(prev => {
      const now = Date.now();
      const next = [...prev];

      attentionCalls.forEach(call => {
        if (call.receiver_id !== receiverId) return;
        if (deletedAttentionCalls.has(call.id)) return;
        if (next.some(t => t.callId === call.id)) return;

        const storageKey = `timer_attention_${receiverId}_${call.id}`;
        const stored = localStorage.getItem(storageKey);
        const expiry = stored ? Number(stored) : NaN;
        const viewedExpiry = call.viewed_at ? new Date(call.viewed_at).getTime() + 5 * 1000 : NaN;
        const expiryTime = Number.isFinite(expiry)
          ? expiry
          : Number.isFinite(viewedExpiry)
            ? viewedExpiry
            : now + 5 * 1000;

        if (!stored) {
          localStorage.setItem(storageKey, String(expiryTime));
          if (!call.viewed_at) {
            void markAttentionCallViewed(call.id).catch(() => undefined);
          }
        }

        const title = `${senderDisplayName} chamou sua atenção`;
        const originalText = call.message ? `${title}: ${call.message}` : title;
        const timeLeft = Math.max(0, Math.ceil((expiryTime - now) / 1000));

        next.push({
          callId: call.id,
          timeLeft,
          expiryTime,
          status: 'counting',
          originalText,
        });
      });

      return next;
    });

    // Loop de contagem
    const interval = setInterval(() => {
      setAttentionTimers(prev => {
        if (prev.length === 0) return prev;

        const now = Date.now();
        const updated: AttentionTimer[] = [];
        const callsToDelete: string[] = [];
        let hasChanges = false;

        prev.forEach(timer => {
          if (timer.status === 'deleted') return;

          if (timer.status === 'counting') {
            const realTimeLeft = Math.max(0, Math.ceil((timer.expiryTime - now) / 1000));
            if (realTimeLeft <= 0) {
              hasChanges = true;
              updated.push({
                ...timer,
                status: 'deleting',
                timeLeft: 5,
                currentText: timer.originalText,
              });
            } else if (timer.timeLeft !== realTimeLeft) {
              hasChanges = true;
              updated.push({ ...timer, timeLeft: realTimeLeft });
            } else {
              updated.push(timer);
            }
            return;
          }

          if (timer.status === 'deleting') {
            const timeSinceExpiry = Math.floor((now - timer.expiryTime) / 1000);
            if (timeSinceExpiry > 5) {
              hasChanges = true;
              updated.push({
                ...timer,
                status: 'showingUndoing',
                timeLeft: 5,
                currentText: undefined,
              });
              return;
            }

            const ratio = Math.min(1, Math.max(0, timeSinceExpiry / 5));
            const lettersToKeep = Math.floor(timer.originalText.length * (1 - ratio));
            hasChanges = true;
            updated.push({
              ...timer,
              timeLeft: Math.max(0, 5 - timeSinceExpiry),
              currentText: timer.originalText.slice(0, lettersToKeep),
            });
            return;
          }

          if (timer.status === 'showingUndoing') {
            const nextTimeLeft = timer.timeLeft - 1;
            if (nextTimeLeft <= 0) {
              hasChanges = true;
              callsToDelete.push(timer.callId);
              updated.push({ ...timer, status: 'deleted', timeLeft: 0 });
            } else {
              hasChanges = true;
              updated.push({ ...timer, timeLeft: nextTimeLeft });
            }
            return;
          }
        });

        if (callsToDelete.length > 0 && user) {
          callsToDelete.forEach(callId => {
            localStorage.removeItem(`timer_attention_${user.id}_${callId}`);
            setDeletedAttentionCalls(prevSet => {
              const s = new Set(prevSet);
              s.add(callId);
              return s;
            });
            void deleteAttentionCall(callId).catch(() => undefined);
          });
        }

        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [attentionCalls, deletedAttentionCalls, privatePeerProfile, user]);

  const deleteMessages = async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    try {
      const deletedAt = new Date().toISOString();

      // 1. Buscar dados completos das mensagens antes de apagar (para arquivamento)
      const { data: msgData } = await supabase
        .from('messages')
        .select('id, content, media_urls, user_id, conversation_id, created_at')
        .in('id', messageIds);

      // 2. Arquivar no deleted_messages_archive (acessível SOMENTE por admins)
      if (msgData && msgData.length > 0 && user?.id) {
        const archiveRecords = msgData.map((msg) => ({
          original_message_id: msg.id,
          conversation_id: msg.conversation_id || selectedConversation,
          sender_id: msg.user_id,
          deleted_by: user.id,
          content: msg.content,
          media_urls: msg.media_urls,
          original_created_at: msg.created_at,
          deleted_at: deletedAt,
          deletion_context: 'timer_expired',
        }));

        // Insert silencioso     não bloqueia o fluxo se falhar
        await supabase
          .from('deleted_messages_archive')
          .insert(archiveRecords)
          .then(() => undefined, (err) => console.warn('[Archive] Erro ao arquivar mensagens:', err));
      }

      // 3. Soft-delete da mensagem (remove conteúdo visível ao usuário)
      await supabase
        .from('messages')
        .update({ deleted_at: deletedAt, content: null, media_urls: null })
        .in('id', messageIds);

      setDeletedMessages(prev => {
        const newSet = new Set(prev);
        messageIds.forEach(id => newSet.add(id));
        return newSet;
      });
    } catch (error) {
      console.error('Erro ao excluir mensagens:', error);
    }
  };


  const getMessageState = (messageId: string) => messageTimers.find(timer => timer.messageId === messageId);
  const getAttentionState = (callId: string) => attentionTimers.find(timer => timer.callId === callId);

  // Auto-translate effect: automaticamente traduz todas as mensagens recebidas quando a tradução estiver ligada
  useEffect(() => {
    if (!autoTranslateEnabled || !messages || messages.length === 0) return;

    messages.forEach((msg: any) => {
      const isOwn = msg.user_id === user?.id;
      if (isOwn) return;

      const msgType = getMessageType(msg);
      if (msgType !== 'text') return;

      const existing = translations.find(t => t.messageId === msg.id);
      const skipKey = `${msg.id}|${autoTranslateLang}`;
      if (autoTranslateSkipRef.current.has(skipKey)) return;
      if (existing?.isTranslated && existing.targetLang === autoTranslateLang) return;

      const plain = typeof msg?.content === 'string' ? msg.content : '';
      if (!plain || plain.trim() === '' || plain.startsWith('__')) return;

      autoTranslateSkipRef.current.add(skipKey);

      const existingNow = translations.find(t => t.messageId === msg.id);
      if (!existingNow || existingNow.targetLang !== autoTranslateLang || (!existingNow.isTranslated && !existingNow.hasFailed)) {
        if (!existingNow?.isLoading) {
          void handleTranslate(msg.id, plain, autoTranslateLang, false);
        }
      }
    });
  }, [messages, autoTranslateEnabled, autoTranslateLang, user?.id, translations, handleTranslate]);

  // --- Realtime & View Update ---
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`global-messages-${user.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload: any) => {
        refetchMessages();
        refetchConversations();
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new;
          if (newMsg && newMsg.user_id !== user.id && newMsg.conversation_id === selectedConversation) {
            playReceive();
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => { refetchConversations(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchMessages, refetchConversations, user, playReceive, selectedConversation]);

  // Realtime subscription for saved_messages requests changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`saved-messages-changes-${user.id}-${Date.now()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "saved_messages",
      }, () => {
        void refetchSaveRequests();
        void refetchConversations();
        void refetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation, user, refetchSaveRequests, refetchMessages]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      if (isAtBottom) setTimeout(() => scrollToBottom(false), 100);
    }
  }, [messages, isAtBottom, scrollToBottom]);

  useEffect(() => {
    if (!attentionCalls || attentionCalls.length === 0) return;
    if (isAtBottom) setTimeout(() => scrollToBottom(false), 100);
  }, [attentionCalls, isAtBottom, scrollToBottom]);

  useEffect(() => {
    if (selectedConversation) setTimeout(() => scrollToBottom(true), 200);
  }, [selectedConversation, scrollToBottom]);

  const handleTypingChange = useCallback((isTyping: boolean) => {
    if (!selectedConversation || !user?.id) return;
    if (!uiChannelRef.current) return;

    // envia para o outro lado saber que você está digitando
    void uiChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        conversation_id: selectedConversation,
        user_id: user.id,
        is_typing: !!isTyping,
      },
    });
  }, [selectedConversation, user?.id]);

  const handleSendSticker = async (token: string) => {
    if (!selectedConversation || !user?.id) return;

    // Evita envio duplicado (toque duplo/eventos duplicados)
    const now = Date.now();
    const last = stickerSendLockRef.current;
    if (stickerInFlightRef.current) return;
    // 1) Bloqueia toque duplo
    if (last && last.token === token && (now - last.ts) < 900) return;

    // 2) Se por algum motivo o handler disparar duas vezes com o mesmo token,
    // reutilizamos o mesmo id para que o segundo INSERT colida no PK e nao duplica no banco.
    const makeId = () => {
      const c: any = globalThis as any;
      return (c.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    };
    const msgId = (last && last.token === token && (now - last.ts) < 2500) ? last.msgId : makeId();

    stickerSendLockRef.current = { token, ts: now, msgId };
    stickerInFlightRef.current = true;

    try {
      if (token.startsWith('emoji:')) {
        const emoji = token.slice('emoji:'.length);
        await supabase
          .from('messages')
          .insert({ id: msgId, conversation_id: selectedConversation, user_id: user.id, content: `__sticker_emoji__${emoji}` })
          .select()
          .single();
      } else if (typeof token === 'string' && token.startsWith('data:image/')) {
        // Figurinha (imagem) LOCAL: vai no banco só para entregar ao destinatário,
        // e é removida após visualizar + 2 minutos.
        await supabase
          .from('messages')
          .insert({
            id: msgId,
            conversation_id: selectedConversation,
            user_id: user.id,
            content: '__temp_sticker__',
            media_urls: [token],
          })
          .select()
          .single();
      } else {
        await supabase
          .from('messages')
          .insert({ id: msgId, conversation_id: selectedConversation, user_id: user.id, content: '__sticker__', media_urls: [token] })
          .select()
          .single();
      }

      // Atualiza UI
      playSend();
      void refetchMessages();
      void refetchConversations();
      setTimeout(() => scrollToBottom(false), 50);
    } catch (error: any) {
      // Se o segundo disparo tentar inserir com o mesmo id, o banco retorna violacao de PK.
      // Nesse caso, ignoramos silenciosamente.
      const code = error?.code ?? error?.details?.code;
      if (code === '23505') return;
      console.error('Erro ao enviar figurinha:', error);
      toast({ title: 'Erro', description: 'Não foi possível enviar a figurinha.', variant: 'destructive' });
    } finally {
      stickerInFlightRef.current = false;
    }
  };

  // Upload de figurinha (imagem) e retorna URL
  // Armazenamento: Cloudinary (mesmo padrão das demais mídias do sistema).
  const handleUploadStickerImage = useCallback(async (file: File) => {
    if (!user?.id) throw new Error('Usuário não autenticado');

    const { url } = await uploadToCloudinary(file, {
      kind: 'messages',
      userId: user.id,
      folder: `messages/stickers/${user.id}`,
    });

    // Persiste no backend para ficar armazenado no perfil do usuário
    // Primeiro tenta no esquema atual (coluna url). Se o ambiente tiver o legado
    // (coluna sticker_url), faz fallback.
    const ins1 = await supabase
      .from('user_stickers')
      .insert({ user_id: user.id, url })
      .select()
      .single();

    if (ins1.error) {
      const ins2 = await supabase
        .from('user_stickers')
        .insert({ user_id: user.id, sticker_url: url } as any)
        .select()
        .single();
      if (ins2.error) {
        console.warn('user_stickers insert error:', ins2.error);
        throw ins2.error;
      }
    }
    await refetchUserStickers();

    return url;
  }, [user?.id, refetchUserStickers]);

  const handleRequestLocation = async () => {
    if (!selectedConversation || !user) return;
    await supabase.from('messages').insert({
      conversation_id: selectedConversation,
      user_id: user.id,
      content: '__location_request__',
    });
    await refetchMessages();
    if (uiChannelRef.current) {
      void uiChannelRef.current.send({
        type: 'broadcast',
        event: 'location_update',
        payload: { conversation_id: selectedConversation },
      });
    }
    setTimeout(() => scrollToBottom(true), 100);
    toast({ title: 'Solicitação enviada', description: 'Aguardando resposta...' });
  };

  const handleAcceptLocation = async (requestMsgId: string) => {
    if (!selectedConversation || !user) return;
    if (!navigator.geolocation) {
      toast({ title: 'Erro', description: 'Seu dispositivo não suporta geolocalização.', variant: 'destructive' });
      return;
    }
    const locationGranted = await requestPermission(
      'location',
      'Você está compartilhando sua localização nesta conversa. A posição é enviada somente após a sua confirmação.'
    );
    if (!locationGranted) return;
    toast({ title: 'Obtendo localização...', description: 'Aguarde enquanto obtemos sua posição.' });
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapImageUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=400x300&markers=${lat},${lng},red-pushpin`;
        await supabase.from('messages').insert({
          conversation_id: selectedConversation,
          user_id: user!.id,
          content: `__location__${lat},${lng}`,
          media_urls: [mapImageUrl],
        });
        // Mark the request as accepted so it doesn't show buttons anymore
        await supabase.from('messages').update({ content: '__location_request_accepted__' }).eq('id', requestMsgId);
        await refetchMessages();
        if (uiChannelRef.current) {
          void uiChannelRef.current.send({
            type: 'broadcast',
            event: 'location_update',
            payload: { conversation_id: selectedConversation },
          });
        }
        setTimeout(() => scrollToBottom(true), 100);
        toast({ title: 'Localização enviada!' });
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast({ title: 'Erro', description: 'Não foi possível obter sua localização. Verifique as permissões.', variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleDeclineLocation = async (requestMsgId: string) => {
    await supabase.from('messages').update({ content: '__location_request_declined__' }).eq('id', requestMsgId);
    await refetchMessages();
    if (uiChannelRef.current) {
      void uiChannelRef.current.send({
        type: 'broadcast',
        event: 'location_update',
        payload: { conversation_id: selectedConversation },
      });
    }
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessagesForDeletion(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const handleDeleteSelectedMessages = async () => {
    if (selectedMessagesForDeletion.size === 0) return;
    try {
      const now = new Date().toISOString();
      const ids = Array.from(selectedMessagesForDeletion);
      
      const { error } = await supabase
        .from("messages")
        .update({ deleted_at: now, content: null, media_urls: null })
        .in("id", ids);
        
      if (error) throw error;
      
      toast({
        title: `    ${ids.length} mensagem(ns) excluída(s)`,
        description: "As mensagens selecionadas foram apagadas.",
      });
      
      setDeletedMessages(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });
      setMessageTimers(prev => prev.filter(t => !ids.includes(t.messageId)));
      setIsSelectionMode(false);
      setSelectedMessagesForDeletion(new Set());
      void refetchMessages();
      void refetchConversations();
    } catch (err) {
      toast({ title: "Erro ao excluir mensagens", variant: "destructive" });
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !selectedConversation || !user) return;

    // 🔐 Sela a mensagem antes de ela existir no banco. Se o destinatário
    // ainda não publicou chaves pós-quânticas, `sealed` volta null e a
    // mensagem segue como sempre foi — contas antigas continuam funcionando.
    let content: string = text;
    let pqEncrypted = false;
    try {
      const identity = await pqEnsureIdentityPublished(user.id);
      const sealed = isGroupChat
        ? await pqTryEncryptForGroup(
            text,
            ((groupMembers as any[]) || []).map((m) => m.user_id).filter(Boolean),
            identity,
            user.id
          )
        : privatePeerId
          ? await pqTryEncryptText(text, privatePeerId, identity, user.id)
          : null;
      if (sealed) {
        content = sealed;
        pqEncrypted = true;
      }
    } catch (err) {
      console.warn("[pq] envio sem criptografia pós-quântica:", err);
    }

    const { data: msg, error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation,
      user_id: user.id,
      content,
      is_pq_encrypted: pqEncrypted,
    } as any).select().single();
    if (error) { toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" }); return; }
    if (msg) {
      playSend();
      const { saveMentions } = await import("@/utils/mentionsHelper");
      await saveMentions(msg.id, "message", text, user.id);
      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente ao detectar o INSERT.
      await refetchMessages();
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  const handleMediaUpload = async (files: File[]) => {
    if (!selectedConversation || !user) return;
    try {
      const uploadPromises = files.map(async (file) => {
        const { url } = await uploadToCloudinary(file, {
          kind: "messages",
          userId: user.id,
          folder: `messages/${selectedConversation}/${user.id}`,
        });
        return url;
      });
      const urls = await Promise.all(uploadPromises);
      const { data: mediaMsg } = await supabase.from("messages").insert({ conversation_id: selectedConversation, user_id: user.id, media_urls: urls }).select().single();
      playSend();
      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente ao detectar o INSERT.
      await refetchMessages();
      scrollToBottom(true);
    } catch (e) {
      toast({ title: "Erro no envio", variant: "destructive" });
    }
  };

  const handleAudioUpload = async (blob: Blob, originalBlob?: Blob) => {
    if (!selectedConversation || !user) return;
    try {
      // Idioma da dublagem escolhido pelo remetente (A): vem marcado no blob
      const dubLang = (blob as any)?.__dubLang as string | undefined || null;
      if ((blob as any)?.__dubLang) delete (blob as any).__dubLang;
      const doUpload = async (b: Blob, suffix: string) => {
        const file = blobToFile(b, `audio_${Date.now()}_${suffix}.webm`, b.type || "audio/webm");
        const { url } = await uploadToCloudinary(file, {
          kind: "messages",
          userId: user.id,
          folder: `messages/${selectedConversation}/${user.id}`,
        });
        return url;
      };
      const urls = [await doUpload(blob, "dubbed")];
      if (originalBlob) urls.push(await doUpload(originalBlob, "original"));
      const insertPayload: any = { conversation_id: selectedConversation, user_id: user.id, media_urls: urls };
      // Persiste o idioma da dublagem p/ o destinatário saber qual par é o dublado
      if (dubLang) insertPayload.dub_language = dubLang;
      const { data: audioMsg } = await supabase.from("messages").insert(insertPayload).select().single();
      playSend();
      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente ao detectar o INSERT.
      await refetchMessages();
      scrollToBottom(true);
    } catch (e) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const startChatWithFriend = async (friendId: string) => {
    if (!user) return;
    const existingLocal = processedConversations.find(c => !c.is_group && c.conversation_participants.some((p: any) => p.user_id === friendId));
    if (existingLocal) {
      selectConversation(existingLocal.id);
      setSidebarTab("chats");
      return;
    }
    try {
      const { data: newConv } = await supabase.from("conversations").insert({ is_group: false }).select().single();
      if (newConv) {
        await supabase.from("conversation_participants").insert({ conversation_id: newConv.id, user_id: user.id });
        await supabase.from("conversation_participants").insert({ conversation_id: newConv.id, user_id: friendId });
        await refetchConversations();
        selectConversation(newConv.id);
        setSidebarTab("chats");
      }
    } catch (error) {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    if (!user?.id || isReactionBusyId) return;
    setIsReactionBusyId(msgId);
    try {
      const { error } = await (supabase as any).rpc("toggle_message_reaction", {
        p_message_id: msgId,
        p_emoji: emoji,
      });
      if (error) throw error;
      void refetchReactions();
    } catch {
      toast({ title: "Erro", description: "Não foi possível atualizar a reação.", variant: "destructive" });
    } finally {
      setIsReactionBusyId(null);
    }
  };

  const startEditMessage = (msg: any) => {
    if (msg.user_id !== user?.id) return;
    setEditingMsgId(msg.id);
    setEditDraft(typeof msg?.content === 'string' ? msg.content : '');
    setConfirmDeleteMsgId(null);
  };

  const saveEditMessage = async () => {
    if (!editingMsgId || isSavingEditMsg) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setIsSavingEditMsg(true);
    try {
      // 🔐 Se a mensagem original estava cifrada, a versão editada também
      // precisa estar. Sem isto, editar uma mensagem a rebaixaria para texto
      // puro no banco — um vazamento silencioso.
      const original = (messages as any[])?.find((m) => m.id === editingMsgId);
      let payload = trimmed;
      if (original?.is_pq_encrypted && user?.id) {
        const identity = await pqEnsureIdentityPublished(user.id);
        const sealed = isGroupChat
          ? await pqTryEncryptForGroup(
              trimmed,
              ((groupMembers as any[]) || []).map((m) => m.user_id).filter(Boolean),
              identity,
              user.id
            )
          : privatePeerId
            ? await pqTryEncryptText(trimmed, privatePeerId, identity, user.id)
            : null;
        if (!sealed) {
          toast({
            title: "Edição cancelada",
            description: "Não foi possível manter a mensagem criptografada.",
            variant: "destructive",
          });
          return;
        }
        payload = sealed;
      }

      const { data, error } = await (supabase as any).rpc("update_message_text", {
        p_message_id: editingMsgId,
        p_new_content: payload,
      });
      const denied = String(error?.message || "") || (data && typeof data === "object" && (data as any).updated === false);
      if (error || denied) {
        const msgText = String(error?.message || "");
        if (/15 min/i.test(msgText) || /prazo/i.test(msgText) || /permis/i.test(msgText) || (data && typeof data === "object" && (data as any).updated === false)) {
          toast({ title: "Prazo expirado", description: "Só é possível editar em até 15 minutos.", variant: "destructive" });
          setEditingMsgId(null);
          setEditDraft("");
        } else {
          toast({ title: "Erro", description: "Não foi possível editar a mensagem.", variant: "destructive" });
        }
        return;
      }
      if (original && !original.is_pq_encrypted && user?.id) {
        const { saveMentions } = await import("@/utils/mentionsHelper");
        await saveMentions(editingMsgId, "message", trimmed, user.id).catch(() => undefined);
      }
      setEditingMsgId(null);
      setEditDraft("");
      void refetchMessages();
      void refetchConversations();
    } catch (e: any) {
      const msgText = String(e?.message || "");
      if (/15 min/i.test(msgText) || /prazo/i.test(msgText)) {
        toast({ title: "Prazo expirado", description: "Só é possível editar em até 15 minutos.", variant: "destructive" });
        setEditingMsgId(null);
        setEditDraft("");
      } else {
        toast({ title: "Erro", description: "Não foi possível editar a mensagem.", variant: "destructive" });
      }
    } finally {
      setIsSavingEditMsg(false);
    }
  };

  const cancelEditMessage = () => {
    setEditingMsgId(null);
    setEditDraft("");
    setConfirmDeleteMsgId(null);
  };

  const handleDeleteForAll = async (msgId: string) => {
    setConfirmDeleteMsgId(null);
    try {
      const { error } = await (supabase as any).rpc("delete_message_for_all", { p_message_id: msgId });
      if (error) throw error;
      setDeletedMessages(prev => {
        const next = new Set(prev);
        next.add(msgId);
        return next;
      });
      setMessageTimers(prev => prev.filter(t => t.messageId !== msgId));
      void refetchMessages();
      void refetchConversations();
    } catch {
      toast({ title: "Erro", description: "Não foi possível apagar a mensagem para todos.", variant: "destructive" });
    }
  };

  const handleCreatePoll = async (payload: CreatePollPayload) => {
    if (!selectedConversation || !user?.id || isCreatingPoll) return;
    setIsCreatingPoll(true);
    try {
      const { error } = await (supabase as any).rpc("create_poll_message", {
        p_conversation_id: selectedConversation,
        p_content: "__poll__",
        p_question: payload.question,
        p_options: payload.options,
        p_is_anonymous: payload.isAnonymous,
        p_expires_at: payload.closesAt,
      });
      if (error) throw error;
      setIsCreatePollOpen(false);
      toast({ title: "Enquete criada!", description: "Sua enquete foi enviada para a conversa." });
      void refetchMessages();
      void refetchConversations();
      setTimeout(() => scrollToBottom(true), 200);
    } catch (e: any) {
      toast({ title: "Erro", description: String(e?.message || "Não foi possível criar a enquete."), variant: "destructive" });
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const handlePollVote = async (pollId: string, optionId: string) => {
    if (votingPollId) return;
    setVotingPollId(pollId);
    try {
      const { error } = await (supabase as any).rpc("set_poll_vote", {
        p_poll_id: pollId,
        p_option_id: optionId,
      });
      if (error) throw error;
      void refetchPolls();
    } catch {
      toast({ title: "Erro", description: "Não foi possível registrar o voto.", variant: "destructive" });
    } finally {
      setVotingPollId(null);
    }
  };

  const handleGroupCreated = (conversationId: string) => {
    try { localStorage.setItem("udg_last_conversation", conversationId); } catch { /* ignore */ }
    void refetchConversations();
    selectConversation(conversationId);
    setSidebarTab("chats");
    setTimeout(() => scrollToBottom(true), 300);
  };

  const filteredConversations = processedConversations.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.conversation_participants.some((p: any) => p.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  type TimelineItem =
    | { kind: 'message'; msg: any }
    | { kind: 'attention'; call: AttentionCallRow };
  const timeline: TimelineItem[] = useMemo(() => {
    const msgItems: TimelineItem[] = (messages || []).map((m: any) => ({ kind: 'message', msg: m }));
    const attItems: TimelineItem[] = (isPrivateChat ? (attentionCalls || []) : []).map((c) => ({ kind: 'attention', call: c }));
    const all = [...msgItems, ...attItems];
    all.sort((a, b) => {
      const aTime = a.kind === 'message' ? a.msg.created_at : a.call.created_at;
      const bTime = b.kind === 'message' ? b.msg.created_at : b.call.created_at;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
    return all;
  }, [messages, attentionCalls, isPrivateChat]);

  const showSidebar = !isMobile || (isMobile && !selectedConversation);
  const showChat = !isMobile || (isMobile && selectedConversation);

  return (
    <div className="relative w-full h-full flex flex-row bg-background text-foreground overflow-hidden chat-area">
      {openMenuId && (
        <LanguageMenuModal
          messageId={openMenuId}
          originalText={getSelectedMessageText()}
          currentTranslation={translations.find(t => t.messageId === openMenuId)}
          onTranslate={handleTranslate}
          onClose={() => setOpenMenuId(null)}
        />
      )}

      {/* SIDEBAR */}
      <div className={cn("flex flex-col bg-card border-r border-border/40 transition-all duration-300 flex-shrink-0", showSidebar ? "w-full lg:w-[380px]" : "hidden lg:flex lg:w-[380px]")}>
        <div className="p-4 border-b border-border/40 space-y-4 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center justify-between min-h-[28px]">
            <BackButton />

            <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
              <MessageCircle className="h-6 w-6 text-primary" />
              Chat Privado
            </h2>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title="Alternar tema"
              className="h-9 w-9 rounded-full bg-muted/50 shadow-sm"
            >
              {theme === "dark" ? <Sun className="h-5 w-5 text-yellow-500" /> : <Moon className="h-5 w-5 text-slate-500" />}
            </Button>
          </div>
          <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as any)} className="w-full">
            <TabsList className="w-full grid grid-cols-2 p-1 h-9 bg-muted/60 rounded-full">
              <TabsTrigger value="chats" className="rounded-full text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">Conversas</TabsTrigger>
              <TabsTrigger value="contacts" className="rounded-full text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">Contatos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={sidebarTab === "chats" ? "Buscar conversas..." : "Buscar contatos..."} className="pl-9 h-9 rounded-full bg-muted/40 border-border/30 focus-visible:ring-1 focus-visible:ring-primary/30 text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {sidebarTab === "chats" && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0 rounded-full h-9 w-9 border-border/40 bg-muted/20 hover:bg-accent"
                  onClick={() => setIsCreateGroupOpen(true)}
                  title="Criar grupo"
                >
                  <Users className="h-4 w-4" />
                </Button>
                <CreatePrivateRoom />
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {sidebarTab === "chats" ? (
            <ScrollArea className="h-full">
              {isLoadingConversations ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...</div>
              ) : filteredConversations && filteredConversations.length > 0 ? (
                <div className="flex flex-col">
                  {filteredConversations.map((conv) => {
                    const otherParticipant = conv.conversation_participants.find((p: any) => p.user_id !== user?.id);
                    const lastMessage = conv.messages?.find((m: any) => m.deleted_at === null);
                    const isActive = selectedConversation === conv.id;
                    const hasUnreadMessages = conv.unreadCount > 0;

                    return (
                      <button
                        key={conv.id}
                        onClick={() => selectConversation(conv.id)}
                        className={cn(
                          "flex items-center gap-3 p-4 border-b border-muted/20 hover:bg-accent/50 transition-all duration-200 text-left w-full relative group",
                          isActive && "bg-primary/5 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary before:rounded-r-md"
                        )}
                      >
                        <div className="relative">
                          <Avatar className={cn(
                            "h-12 w-12 border-2 border-background",
                            !conv.is_group && otherParticipant && onlineUserIds.has(otherParticipant.user_id)
                              ? "ring-2 ring-green-500/70"
                              : !conv.is_group ? "ring-2 ring-red-500/30"
                              : ""
                          )}>
                            <AvatarImage src={otherParticipant?.profiles?.avatar_url} />
                            <AvatarFallback className="bg-muted font-semibold">
                              {conv.is_group ? <Users className="h-4 w-4" /> : otherParticipant?.profiles?.username?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {!conv.is_group && otherParticipant && onlineUserIds.has(otherParticipant.user_id) && (
                            <span className="absolute bottom-0 right-0 block w-3 h-3 rounded-full border-2 border-background bg-green-500" />
                          )}
                          {hasUnreadMessages && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-background">
                              <span className="text-[10px] font-bold text-white">
                                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-semibold truncate text-sm">
                              {conv.name || otherParticipant?.profiles?.username || "Sala Privada"}
                            </span>
                            {lastMessage && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                                {new Date(lastMessage.created_at).toLocaleDateString() === new Date().toLocaleDateString()
                                  ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : new Date(lastMessage.created_at).toLocaleDateString()
                                }
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {(() => {
                              if (lastMessage?.content) {
                                const c = String(lastMessage.content);
                                const prefix = lastMessage.user_id === user?.id ? "Você: " : "";
                                // A lista lateral não passa pelo decifrador em
                                // lote; mostrar o envelope cru seria feio e
                                // vazaria o tamanho da mensagem.
                                if (isEncryptedContent(c)) return `${prefix}🔒 Mensagem protegida`;
                                if (c === "__sticker__" || c === "__temp_sticker__") return `${prefix}     Figurinha`;
                                if (c === "__poll__" || c.startsWith("__poll_")) return `${prefix}     Enquete`;
                                if (c.startsWith("__sticker_emoji__")) return `${prefix}${c.replace("__sticker_emoji__", "")}`;
                                return prefix + c;
                              }
                              if (lastMessage?.media_urls) return "     Mídia enviada";
                              return "Toque para conversar";
                            })()}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground opacity-70">
                  <Inbox className="h-12 w-12 mb-2 opacity-20" />
                  <p>Nenhuma conversa encontrada.</p>
                  <Button variant="link" onClick={() => setSidebarTab("contacts")}>Iniciar nova conversa</Button>
                </div>
              )}
            </ScrollArea>
          ) : (
            <Tabs defaultValue="list" className="h-full flex flex-col">
              <div className="px-3 pb-3 bg-card/80 backdrop-blur border-b border-border/30">
                <TabsList className="w-full h-8 p-1 bg-muted/60 rounded-full">
                  <TabsTrigger value="list" className="rounded-full text-[11px] font-semibold flex-1 data-[state=active]:bg-card data-[state=active]:shadow-sm">Meus Amigos</TabsTrigger>
                  <TabsTrigger value="requests" className="rounded-full text-[11px] font-semibold flex-1 data-[state=active]:bg-card data-[state=active]:shadow-sm relative">
                    Pedidos
                    {receivedRequests && receivedRequests.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-pink-500 text-[9px] font-bold text-white">{receivedRequests.length > 9 ? '9+' : receivedRequests.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="add" className="rounded-full text-[11px] font-semibold flex-1 data-[state=active]:bg-card data-[state=active]:shadow-sm">Adicionar</TabsTrigger>
                </TabsList>
              </div>
              <ScrollArea className="flex-1 bg-muted/[0.03]">
                <TabsContent value="list" className="m-0 p-2"><ContactsList onStartChat={startChatWithFriend} onlineUserIds={onlineUserIds} onBlockUser={(id, name, avatar) => { setBlockTarget({ id, name, avatar }); setBlockModalOpen(true); }} /></TabsContent>
                <TabsContent value="requests" className="m-0 p-3"><FriendRequests /></TabsContent>
                <TabsContent value="add" className="m-0 p-3">
                  <div className="bg-card p-4 rounded-2xl border border-border/40 shadow-sm">
                    <div className="flex items-center gap-2 mb-3 text-primary"><div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><UserPlus className="h-4 w-4" /></div><h3 className="font-semibold text-sm">Adicionar novo amigo</h3></div>
                    <AddFriend userCode={profile?.friend_code} />
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </div>
      </div>

      {/* CHAT */}
      <div className={cn("flex-1 flex flex-col bg-background/95 relative overflow-hidden", showChat ? "flex" : "hidden")}>

        {selectedConversation ? (
          <>
            {/* Modal exclusão de conversa */}
            {showDeleteModal && selectedConversation && user && (
              <DeleteConversationModal
                conversationId={selectedConversation}
                currentUserId={user.id}
                messages={(messages || []).map((m: any) => ({
                  id: m.id,
                  content: m.content,
                  media_urls: m.media_urls,
                  created_at: m.created_at,
                  user_id: m.user_id,
                }))}
                initialMode="all"
                onClose={() => setShowDeleteModal(false)}
                onDeleted={(deletedIds) => {
                  if (deletedIds === 'all') {
                    setDeletedMessages(new Set((messages || []).map((m: any) => m.id)));
                    setMessageTimers([]);
                  } else {
                    setDeletedMessages(prev => {
                      const next = new Set(prev);
                      deletedIds.forEach(id => next.add(id));
                      return next;
                    });
                    setMessageTimers(prev => prev.filter(t => !deletedIds.includes(t.messageId)));
                  }
                  void refetchMessages();
                  void refetchConversations();
                }}
              />
            )}

            <div className="border-b border-border/50 flex flex-col items-center px-4 py-3 bg-background/70 backdrop-blur-xl z-[50] shadow-sm relative sticky top-0">
              {/* Barra superior: botão voltar (mobile) + Lixeira + Ações */}
              <div className="flex items-center w-full justify-between mb-2">
                {isSelectionMode ? (
                  <div className="flex items-center justify-between w-full h-8 px-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedMessagesForDeletion(new Set());
                      }}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      Cancelar
                    </Button>
                    <span className="text-xs font-bold text-foreground">
                      {selectedMessagesForDeletion.size} selecionada{selectedMessagesForDeletion.size === 1 ? "" : "s"}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 rounded-lg font-bold gap-1.5 shadow-sm"
                      onClick={handleDeleteSelectedMessages}
                      disabled={selectedMessagesForDeletion.size === 0}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Esquerda: voltar no mobile */}
                    <div className="w-16">
                      {isMobile && (
                        <Button variant="ghost" size="icon" className="-ml-1" onClick={() => selectConversation(null)}>
                          <ChevronLeft className="h-6 w-6" />
                        </Button>
                      )}
                    </div>

                    {/* Centro: Avatar + Nome + Mood */}
                    {(() => {
                      const conv = processedConversations.find(c => c.id === selectedConversation) || rawConversations?.find(c => c.id === selectedConversation);
                      const peer = conv?.conversation_participants.find((p: any) => p.user_id !== user?.id);
                      if (isGroupChat) {
                        return (
                          <div className="flex flex-row items-center justify-center flex-1 min-w-0 px-2">
                            <div className="flex items-center gap-3 w-full justify-center min-w-0">
                              <button
                                type="button"
                                className="flex-shrink-0 transition-transform hover:scale-105"
                                onClick={() => setIsGroupInfoOpen(true)}
                                title="Ver informações do grupo"
                              >
                                <Avatar className="h-10 w-10 border-2 border-primary/30 shadow-md">
                                  <AvatarImage src={groupAvatar || undefined} />
                                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-base">
                                    <Users />
                                  </AvatarFallback>
                                </Avatar>
                              </button>
                              <div className="flex flex-col items-start min-w-0 overflow-hidden">
                                <h3 className="font-semibold text-sm sm:text-base truncate max-w-[160px] sm:max-w-[240px]">
                                  {conv?.name || "Grupo"}
                                </h3>
                                <p className={cn(
                                  "text-xs font-medium flex items-center gap-1.5 mt-0.5 truncate max-w-full text-muted-foreground"
                                )}>
                                  {groupMemberCount > 0 ? `${groupMemberCount} participante${groupMemberCount === 1 ? "" : "s"}` : "Grupo"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="flex flex-row items-center justify-center flex-1 min-w-0 px-2">
                          <div className="flex items-center gap-3 w-full justify-center min-w-0">
                            <div className="relative">
                              <Avatar className={cn(
                                "h-10 w-10 border-2 shadow-md flex-shrink-0 transition-transform",
                                isPrivateChat && peerOnline ? "border-green-500 ring-2 ring-green-500/40"
                                  : isPrivateChat ? "border-red-500/70 ring-2 ring-red-500/25"
                                  : "border-primary/30"
                              )}>
                                <AvatarImage src={peer?.profiles?.avatar_url} />
                                <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white text-base">
                                  {peer?.profiles?.username?.[0]?.toUpperCase() || <User />}
                                </AvatarFallback>
                              </Avatar>
                              {isPrivateChat && (
                                <span className={cn(
                                  "absolute bottom-0 right-0 block w-3.5 h-3.5 rounded-full border-2 border-background",
                                  peerOnline ? "bg-green-500" : "bg-red-500"
                                )} />
                              )}
                            </div>
                            <div className="flex flex-col items-start min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 max-w-full">
                                <h3 className="font-semibold text-sm sm:text-base truncate flex-shrink-0 max-w-[130px] sm:max-w-[200px]">
                                  {conv?.name || peer?.profiles?.username || "Chat"}
                                  {peer?.user_id && (
                                    <UserLink
                                      userId={peer.user_id}
                                      username={peer.profiles?.username || ""}
                                      className="hidden"
                                    />
                                  )}
                                </h3>
                                {/* Status de humor ao lado do nome */}
                                <div className="flex-shrink-0 min-w-0">
                                  {peer?.user_id && (
                                    <MoodStatusBadge userId={peer.user_id} viewerId={user?.id} />
                                  )}
                                </div>
                              </div>
                              <p className={cn(
                                "text-xs font-medium flex items-center gap-1.5 mt-0.5 truncate max-w-full",
                                isPeerTyping ? "text-primary" : (peerOnline ? "text-green-600" : "text-red-500/80")
                              )}>
                                <span className={cn(
                                  "block w-2 h-2 rounded-full flex-shrink-0",
                                  isPeerTyping ? "bg-primary animate-pulse" : (peerOnline ? "bg-green-500 animate-pulse" : "bg-red-500")
                                )} />
                                <span className="truncate">
                                  {isPeerTyping
                                    ? 'Digitando...'
                                    : (peerOnline ? 'Online' : (peerLastSeenLabel ? `Offline • visto ${peerLastSeenLabel}` : 'Offline'))}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Direita: Badges de status (Tradução/Dublagem) + Lixeira + Ações */}
                    <div className="flex items-center gap-1.5 min-w-[4rem] justify-end flex-shrink-0">
                      {/* Badge rápido de Tradução ativa */}
                      {isPrivateChat && autoTranslateEnabled && (
                        <button
                          type="button"
                          onClick={() => toggleAutoTranslate()}
                          className="h-7 px-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all"
                          title={`Tradução ativa (${getLanguageName(autoTranslateLang)}). Clique para desativar.`}
                        >
                          <Globe className="h-3 w-3" />
                          <span className="hidden sm:inline">{getLanguageFlag(autoTranslateLang)}</span>
                          <span className="text-[10px] uppercase font-bold">{autoTranslateLang.split('-')[0]}</span>
                        </button>
                      )}

                      {/* Badge rápido de Dublagem ativa */}
                      {isPrivateChat && (dubbingEnabled || dubOutgoingEnabled) && (
                        <button
                          type="button"
                          onClick={() => { setShowDeleteMenu(false); setShowActionsMenu(prev => !prev); }}
                          className="h-7 px-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-[11px] font-semibold flex items-center gap-1 transition-all"
                          title={`Dublagem ativa — receber: ${dubbingEnabled ? getLanguageName(autoTranslateLang) : 'desligado'} · enviar: ${dubOutgoingEnabled ? 'ligado' : 'desligado'}. Clique para ajustar.`}
                        >
                          <Headphones className="h-3 w-3" />
                          <span className="text-[10px] uppercase font-bold hidden sm:inline">Dublar</span>
                          {dubbingEnabled && <span className="text-[10px] leading-none">{getLanguageFlag(autoTranslateLang)}</span>}
                        </button>
                      )}

                      {/* 🔐 Selo de criptografia pós-quântica: informa o estado
                          real da conversa e abre a explicação + códigos de
                          verificação. Aparece em conversa privada e em grupo. */}
                      {(isPrivateChat || isGroupChat) && (
                        <PqBadge
                          peerId={isPrivateChat ? privatePeerId : null}
                          memberIds={
                            isGroupChat && groupMembers
                              ? (groupMembers as any[])
                                  .map((m) => m.user_id)
                                  .filter((id: string) => Boolean(id) && id !== user?.id)
                              : undefined
                          }
                          peerName={(privatePeerProfile as any)?.username ?? null}
                        />
                      )}

                      {isGroupChat && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors relative z-20"
                          onClick={() => setIsGroupInfoOpen(true)}
                          title="Informações do grupo"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Botão Chamar Atenção (chat privado) */}
                      {isPrivateChat && privatePeerId && (
                        <AttentionButton
                          contactId={privatePeerId}
                          className="h-8 w-8 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-colors relative z-20"
                        />
                      )}

                      {/* Botão lixeira com dropdown */}
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors relative z-20"
                          onClick={() => { setShowActionsMenu(false); setShowDeleteMenu(prev => !prev); }}
                          title="Opções de exclusão"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        {showDeleteMenu && (
                            <div ref={deleteMenuRef} className="absolute right-0 top-10 z-40 bg-popover border border-border shadow-xl rounded-2xl p-2.5 min-w-[200px] flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">Opções de exclusão</p>
                              <button
                                onClick={() => {
                                  setShowDeleteMenu(false);
                                  setShowDeleteModal(true);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Excluir toda a conversa</span>
                              </button>
                              <button
                                onClick={() => {
                                  setShowDeleteMenu(false);
                                  setIsSelectionMode(true);
                                  setSelectedMessagesForDeletion(new Set());
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-muted text-foreground rounded-lg transition-colors"
                              >
                                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                <span>Selecionar mensagens</span>
                              </button>
                            </div>
                        )}
                      </div>

                  {/* Botão de Ações (menu unificado) */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors relative z-20"
                      onClick={() => { setShowDeleteMenu(false); setShowActionsMenu(prev => !prev); }}
                      title="Ações"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>

                    {showActionsMenu && (
                        <div ref={actionsMenuRef} className="absolute right-0 top-10 z-40 bg-popover border border-border shadow-xl rounded-2xl p-3 min-w-[260px] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-0.5">Tradução</p>
                          <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Globe className="h-4 w-4 text-blue-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium">Traduzir mensagens</p>
                                <p className="text-[10px] text-muted-foreground">Traduz automaticamente textos recebidos</p>
                              </div>
                            </div>
                            <Switch checked={autoTranslateEnabled} onCheckedChange={() => toggleAutoTranslate()} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 flex-shrink-0" />
                          </div>
                          {autoTranslateEnabled && (
                            <div className="px-2 pb-1">
                              <LanguageQuickPicker value={autoTranslateLang} onChange={changeAutoTranslateLang} />
                            </div>
                          )}
                          <div className="h-px bg-border/30 my-1" />
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-0.5">Dublagem de voz</p>

                          {/* OPÇÃO 1 — receber áudio dublado no MEU idioma padrão */}
                          <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Headphones className="h-4 w-4 text-purple-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium">Receber e dublar no meu idioma</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Áudios que chegam viram {getLanguageFlag(autoTranslateLang)} {getLanguageName(autoTranslateLang)}
                                </p>
                              </div>
                            </div>
                            <Switch checked={dubbingEnabled} onCheckedChange={() => toggleDubbing()} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 flex-shrink-0" />
                          </div>
                          {dubbingEnabled && (
                            <div className="px-2 pb-1">
                              <p className="text-[10px] text-muted-foreground mb-1 px-0.5">Meu idioma padrão:</p>
                              <LanguageQuickPicker value={autoTranslateLang} onChange={changeAutoTranslateLang} />
                            </div>
                          )}

                          {/* OPÇÃO 2 — dublar o MEU áudio para outro idioma ao enviar */}
                          <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Mic className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium">Dublar meu áudio para outro idioma</p>
                                <p className="text-[10px] text-muted-foreground">Ao gravar, escolho o idioma antes de enviar</p>
                              </div>
                            </div>
                            <Switch checked={dubOutgoingEnabled} onCheckedChange={() => toggleDubOutgoing()} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 flex-shrink-0" />
                          </div>
                          <div className="h-px bg-border/30 my-1" />
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-0.5">Ferramentas</p>
                          <button type="button" onClick={() => { void openVoiceSampleDialog(); setShowActionsMenu(false); }} className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm hover:bg-muted/40 text-left w-full transition-colors">
                            <Mic className={cn("h-4 w-4 flex-shrink-0", voiceSampleUrl ? "text-primary" : "text-amber-500")} />
                            <span className="flex-1 text-xs font-medium">{voiceSampleUrl ? 'Minha voz' : 'Registrar voz'}</span>
                            {!voiceSampleUrl && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />}
                          </button>
                          <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Wand2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium">Corrigir texto</p>
                                <p className="text-[10px] text-muted-foreground">Correções de ortografia ao digitar</p>
                              </div>
                            </div>
                            <Switch checked={autoCorrectEnabled} onCheckedChange={toggleAutoCorrect} id="auto-correct-toggle" className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 flex-shrink-0" />
                          </div>
                          {isPrivateChat && user && privatePeerId && (<><div className="h-px bg-border/30 my-1" /><div className="px-1"><SaveModeToggle conversationId={selectedConversation!} currentUserId={user.id} peerId={privatePeerId} /></div></>)}
                          {selectedConversation && !isGroupChat && privatePeerId && (<><div className="h-px bg-border/30 my-1" /><p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-0.5">Segurança</p><button type="button" onClick={() => { setBlockTarget({ id: privatePeerId, name: privatePeerProfile?.username || "Usuário", avatar: privatePeerProfile?.avatar_url || null }); setBlockModalOpen(true); setShowActionsMenu(false); }} className={cn("flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm hover:bg-muted/40 text-left w-full transition-colors", blockedUsers?.some((b: any) => b.blocked_user.id === privatePeerId) && "text-red-500")}><ShieldX className="h-4 w-4 flex-shrink-0" /><span className="flex-1 text-xs font-medium">{blockedUsers?.some((b: any) => b.blocked_user.id === privatePeerId) ? "Desbloquear" : "Bloquear"}</span></button></>)}
                        </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

            <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-6 custom-scrollbar w-full max-w-full">
              {!isLoadingMessages && (() => {
                let lastNonOwnSenderId: string | null = null;

                return timeline.map((item) => {
                  if (item.kind === 'attention') {
                    lastNonOwnSenderId = null;
                    const call = item.call;
                    const isOwnCall = call.sender_id === user?.id;
                    const senderName = isOwnCall ? 'Você' : (privatePeerProfile?.username || 'Usuário');
                    const receiverName = isOwnCall ? (privatePeerProfile?.username || 'usuário') : 'você';
                    const title = isOwnCall
                      ? `Você chamou a atenção de ${receiverName}`
                      : `${senderName} chamou sua atenção`;

                    const attentionTimer = (call.receiver_id === user?.id) ? getAttentionState(call.id) : undefined;
                    if (call.receiver_id === user?.id && (attentionTimer?.status === 'deleted' || deletedAttentionCalls.has(call.id))) return null;

                    const baseText = `${title}${call.message ? `     ${call.message}` : ''}`;
                    const displayAttentionText = (attentionTimer?.status === 'deleting' && attentionTimer.currentText)
                      ? attentionTimer.currentText
                      : baseText;

                    return (
                      <div key={`attention-${call.id}`} className="flex w-full justify-center">
                        <div className="max-w-[95%] sm:max-w-[75%]">
                          {attentionTimer && attentionTimer.status !== 'deleted' && attentionTimer.status !== 'showingUndoing' && (
                            <div className="flex items-center justify-center gap-1 mb-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {attentionTimer.status === 'counting' && formatTime(attentionTimer.timeLeft)}
                                {attentionTimer.status === 'deleting' && `Apagando...`}
                              </span>
                            </div>
                          )}

                          {attentionTimer?.status === 'showingUndoing' ? (
                            <div className="text-center text-sm font-bold text-primary animate-out zoom-out duration-1000 py-2 flex flex-col items-center justify-center">
                              <span className="bg-gradient-to-r from-primary to-destructive bg-clip-text text-transparent animate-pulse tracking-widest text-lg">UnDoInG</span>
                              <div className="text-[10px] font-normal text-muted-foreground mt-1 tracking-widest uppercase">Apagando rastro...</div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              {attentionTimer && (attentionTimer.status as string) !== 'deleted' && (attentionTimer.status as string) !== 'showingUndoing' && (
                                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-destructive/80 bg-destructive/10 px-3 py-1 rounded-full">
                                  <Clock className="h-3.5 w-3.5 animate-pulse" />
                                  <span>
                                    {attentionTimer.status === 'counting' && formatTime(attentionTimer.timeLeft)}
                                    {attentionTimer.status === 'deleting' && `Apagando...`}
                                  </span>
                                </div>
                              )}
                              <div className="rounded-full bg-destructive text-destructive-foreground px-5 py-3 flex items-center justify-center gap-2 shadow-lg animate-shake">
                                <Zap className="h-5 w-5 fill-current animate-pulse" />
                                <span className="font-bold text-sm tracking-wide">
                                  {isOwnCall ? `Você chamou a atenção de ${receiverName}` : `${senderName} chamou sua atenção!`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const msg = item.msg;
                  const isOwn = msg.user_id === user?.id;
                  const showAvatar = !isOwn && lastNonOwnSenderId !== msg.user_id;

                  if (!isOwn) lastNonOwnSenderId = msg.user_id;
                  else lastNonOwnSenderId = null;
                  const timerState = getMessageState(msg.id);
                  const messageType = getMessageType(msg);
                  const translationState = getTranslationState(msg.id);
                  const speechState = getSpeechState(msg.id);

                  if (timerState?.status === 'deleted' || deletedMessages.has(msg.id)) return null;

                  let displayText = typeof msg?.content === 'string' ? msg.content : '';
                  if (timerState?.status === 'deleting' && timerState.currentText) {
                    displayText = timerState.currentText;
                  } else if (translationState?.isTranslated && translationState.translatedText && !translationState.revealOriginal) {
                    displayText = translationState.translatedText;
                  }

                  const isSelected = selectedMessagesForDeletion.has(msg.id);

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex w-full gap-2 items-end group/item transition-all duration-200",
                        isOwn ? "justify-end" : "justify-start",
                        isSelectionMode && "cursor-pointer hover:bg-muted/5 p-1.5 rounded-2xl"
                      )}
                      onClick={isSelectionMode ? () => toggleMessageSelection(msg.id) : undefined}
                    >
                      {isSelectionMode && (
                        <div className="flex-shrink-0 flex items-center justify-center self-center mr-1 z-10 animate-in fade-in zoom-in duration-150">
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-primary" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground/30" />
                          )}
                        </div>
                      )}

                      {!isOwn && (
                        <div className="w-8 flex-shrink-0 flex flex-col justify-end">
                          {showAvatar ? <Avatar className="h-8 w-8"><AvatarImage src={msg.profiles?.avatar_url} /><AvatarFallback className="text-[10px]">{msg.profiles?.username?.[0]}</AvatarFallback></Avatar> : <div className="w-8" />}
                        </div>
                      )}

                      <div className={cn("flex flex-col max-w-[92%] sm:max-w-[70%] min-w-0", isOwn ? "items-end" : "items-start")}>

                        {isGroupChat && !isOwn && showAvatar && (
                          <span className="text-[10px] font-semibold text-muted-foreground/80 mb-0.5 ml-1">
                            {msg.profiles?.username || "Participante"}
                          </span>
                        )}

                        {timerState && (timerState.status as string) !== 'deleted' && (timerState.status as string) !== 'showingUndoing' && (
                          <div className={cn(
                            "flex items-center gap-1.5 mb-1 text-[10px] font-bold px-2.5 py-1 rounded-full w-fit max-w-full overflow-hidden transition-all duration-300 shadow-sm border",
                            isOwn ? "bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 self-end" : "bg-primary/10 text-primary border-primary/20 self-start"
                          )}>
                            {timerState.status === 'counting' && (
                              <>
                                <Clock className="h-3 w-3 animate-pulse" />
                                <span>{formatTime(timerState.timeLeft)}</span>
                              </>
                            )}
                            {timerState.status === 'deleting' && (
                              <>
                                <X className="h-3 w-3 animate-spin text-destructive" />
                                <span className="text-destructive">Auto-destruição...</span>
                              </>
                            )}
                          </div>
                        )}
                        {timerState?.status === 'showingUndoing' && (
                          <div className={cn(
                            "px-4 py-2 my-1 shadow-inner text-sm relative group break-words min-w-[120px] max-w-full rounded-2xl flex flex-col items-center justify-center animate-out fade-out zoom-out duration-1000 blur-[1px]",
                            isOwn ? "bg-muted/30 text-muted-foreground border border-muted" : "bg-muted/30 text-muted-foreground border border-muted"
                          )}>
                             <span className="bg-gradient-to-r from-primary/50 to-destructive/50 bg-clip-text text-transparent font-bold tracking-widest animate-pulse">UnDoInG</span>
                             <span className="text-[9px] uppercase tracking-wider opacity-70">Apagando...</span>
                          </div>
                        )}

                        {!isOwn && messageType === 'audio' && !timerState && (
                          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Reproduza para iniciar timer</span>
                          </div>
                        )}



                        {/*
                        IMPORTANTE:
                        Mensagens de figurinha usam media_urls apenas como fonte da imagem.
                        Se renderizarmos media_urls aqui e também no bloco de "sticker",
                        a figurinha aparece duplicada (uma grande + uma menor).
                        Portanto, não renderizar media_urls aqui quando o tipo for sticker.
                      */}
                        {/* Location request message */}
                        {(messageType === 'location_request' || msg.content === '__location_request__') && timerState?.status !== 'showingUndoing' && (
                          <div className="rounded-xl border bg-card shadow-sm p-3 max-w-[280px]">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                                <MapPin className="h-4 w-4 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">     Solicitação de Localização</p>
                                <p className="text-xs text-muted-foreground">{isOwn ? 'Você solicitou a localização' : 'Deseja compartilhar sua localização?'}</p>
                              </div>
                            </div>
                            {!isOwn && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors"
                                  onClick={() => handleAcceptLocation(msg.id)}
                                >
                                      Aceitar
                                </button>
                                <button
                                  className="flex-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-destructive/20 hover:text-destructive transition-colors"
                                  onClick={() => handleDeclineLocation(msg.id)}
                                >
                                      Recusar
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Location request accepted/declined */}
                        {(msg.content === '__location_request_accepted__') && timerState?.status !== 'showingUndoing' && (
                          <div className="rounded-xl border bg-card shadow-sm px-3 py-2 max-w-[280px]">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-green-500" />
                              <span className="text-xs text-muted-foreground">Localização aceita e enviada</span>
                            </div>
                          </div>
                        )}
                        {(msg.content === '__location_request_declined__') && timerState?.status !== 'showingUndoing' && (
                          <div className="rounded-xl border bg-card shadow-sm px-3 py-2 max-w-[280px]">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-destructive" />
                              <span className="text-xs text-muted-foreground">Localização recusada</span>
                            </div>
                          </div>
                        )}

                        {/* Location message (clickable map) */}
                        {messageType === 'location' && timerState?.status !== 'showingUndoing' && (() => {
                          const coords = msg.content.replace('__location__', '').split(',');
                          const lat = parseFloat(coords[0]);
                          const lng = parseFloat(coords[1]);
                          const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                          const bbox = `${lng - 0.008},${lat - 0.005},${lng + 0.008},${lat + 0.005}`;
                          const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
                          return (
                            <div className="rounded-xl border overflow-hidden shadow-md max-w-[280px]">
                              <div className="relative w-full h-[170px] bg-muted/30">
                                <iframe
                                  src={osmEmbedUrl}
                                  className="w-full h-full border-0"
                                  style={{ pointerEvents: 'none' }}
                                  loading="lazy"
                                  title="Localização"
                                />
                              </div>
                              <button
                                className={cn(
                                  "w-full px-3 py-2.5 bg-card flex items-center gap-2 hover:bg-accent transition-colors cursor-pointer border-t",
                                  isSelectionMode && "pointer-events-none"
                                )}
                                onClick={() => window.open(gmapsUrl, '_blank')}
                              >
                                <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0 text-left">
                                  <p className="text-xs font-medium truncate">     Localização compartilhada</p>
                                  <p className="text-[10px] text-muted-foreground">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
                                </div>
                                <span className="text-[10px] text-blue-500 font-semibold flex-shrink-0">Abrir no Maps    </span>
                              </button>
                            </div>
                          );
                        })()}

                        {msg.media_urls && msg.media_urls.length > 0 && messageType !== 'sticker' && messageType !== 'location' && timerState?.status !== 'showingUndoing' && (
                          <div className="mb-1 space-y-1 max-w-full">
                            {msg.media_urls.map((url: string, i: number) => {
                              if (messageType === 'audio') {
                                if (i > 0) return null; // 1   = dublado (quando enviado em par); 2   = gravação original
                                const dState = getDubbingState(msg.id);
                                const isDubbing = !!dState?.isLoading;
                                const hasFailed = !!dState?.hasFailed && !isDubbing;
                                const storedOriginal = msg.media_urls.length > 1 ? msg.media_urls[1] : null;
                                const isOwnMsg = !!isOwn;
                                const needsVoiceSample = hasFailed && dState?.errorMessage === 'VOICE_SAMPLE_REQUIRED';
                                // Quando o remetente ja enviou dublado, media_urls[0] e a dublagem
                                // DELE e media_urls[1] a gravacao original.
                                const senderDubbedUrl = msg.dub_language ? url : null;
                                const originalUrl = storedOriginal || url;
                                // Ha faixa dublada disponivel? (a minha, do meu idioma, ou a do remetente)
                                const dubbedUrl = dState?.dubbedAudioUrl || senderDubbedUrl;
                                const isDubbed = !isDubbing && !!dubbedUrl;
                                const activeAudioType = dState?.activeAudioType === 'original' ? 'original' : 'dubbed';

                                // Regra simples: com a dublagem LIGADA e a faixa dublada pronta,
                                // toca a dublagem; caso contrario toca sempre a gravacao original.
                                const displayUrl =
                                  dubbingEnabled && !isDubbing && activeAudioType === 'dubbed' && dubbedUrl
                                    ? dubbedUrl
                                    : originalUrl;

                                return (
                                  <div key={i} className="max-w-full">
                                    {/* Status do processamento */}
                                    {isDubbing && (
                                      <div className="text-[10px] text-primary mb-1.5 animate-pulse flex items-center gap-1.5 bg-primary/5 border border-primary/15 rounded-full px-2.5 py-1 w-fit">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        {DUBBING_STAGE_LABELS[dState?.stage || 'fetching'] || 'Processando áudio...'}
                                      </div>
                                    )}

                                    {/* Falha na dublagem */}
                                    {hasFailed && !isOwnMsg && dubbingEnabled && (
                                      <div className="text-[10px] text-destructive mb-1.5 flex items-center gap-1.5 bg-destructive/5 border border-destructive/15 rounded-full px-2.5 py-1 w-fit">
                                        <AlertTriangle className="h-3 w-3" />
                                        {getDubbingErrorLabel(dState?.errorMessage)}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (needsVoiceSample) void openVoiceSampleDialog();
                                            else void dubAudioMessage(msg.id, originalUrl, autoTranslateLang, { silent: true });
                                          }}
                                          className="ml-1 font-semibold underline hover:no-underline"
                                        >
                                          {needsVoiceSample ? 'Registrar voz' : 'Tentar de novo'}
                                        </button>
                                      </div>
                                    )}

                                    {/* Seletor Dublado / Original     só quando a dublagem está ligada */}
                                    {isDubbed && !isOwnMsg && dubbingEnabled && (
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <div className="flex items-center gap-0.5 bg-muted/60 border border-border/40 rounded-full p-0.5">
                                          <button
                                            type="button"
                                            onClick={() => setDubbingStates(prev => {
                                              const existing = prev.find(d => d.messageId === msg.id);
                                              if (existing) return prev.map(d => d.messageId === msg.id ? { ...d, activeAudioType: 'dubbed' } : d);
                                              return [...prev, { messageId: msg.id, isLoading: false, hasFailed: false, activeAudioType: 'dubbed' }];
                                            })}
                                            className={cn(
                                              "text-[10px] font-medium px-2 py-0.5 rounded-full transition-all flex items-center gap-1",
                                              activeAudioType === 'dubbed' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                            )}
                                          >
                                            <Headphones className="h-3 w-3" /> Dublado
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDubbingStates(prev => {
                                              const existing = prev.find(d => d.messageId === msg.id);
                                              if (existing) return prev.map(d => d.messageId === msg.id ? { ...d, activeAudioType: 'original' } : d);
                                              return [...prev, { messageId: msg.id, isLoading: false, hasFailed: false, activeAudioType: 'original' }];
                                            })}
                                            className={cn(
                                              "text-[10px] font-medium px-2 py-0.5 rounded-full transition-all flex items-center gap-1",
                                              activeAudioType === 'original' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                            )}
                                          >
                                            <Mic className="h-3 w-3" /> Original
                                          </button>
                                        </div>
                                        {activeAudioType === 'dubbed' && dState && (
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                            {getLanguageFlag(dState?.sourceLang)}     {getLanguageFlag(dState?.targetLang || autoTranslateLang)}
                                          </span>
                                        )}
                                        {/* Qual voz gerou a dublagem (a sua, a do Edresson, Camila...) */}
                                        {activeAudioType === 'dubbed' && dState?.method && DUBBING_VOICE_BADGES[dState.method] && (
                                          <span
                                            className={cn(
                                              "text-[9px] px-1.5 py-0.5 rounded-full font-semibold border",
                                              DUBBING_VOICE_BADGES[dState.method].className
                                            )}
                                          >
                                            {DUBBING_VOICE_BADGES[dState.method].label(dState.voice)}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <CustomAudioPlayer
                                      audioUrl={displayUrl}
                                      isOwn={isOwn}
                                      className={cn(
                                        isOwn ? "max-w-[250px] w-full" : "max-w-[300px] w-full",
                                        isSelectionMode && "pointer-events-none"
                                      )}
                                      onPlay={() => { if (!isOwn) startAudioTimer(msg.id); }}
                                    />

                                    {/* Ações: transcrição (dublagem automática pela barra de controles) */}
                                    {!isOwnMsg && dubbingEnabled && !isDubbing && !hasFailed && (
                                      <div className="mt-1.5 flex flex-wrap items-center gap-2 w-full max-w-[250px] sm:max-w-[300px]">
                                        {dState?.originalText && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setDubbingStates(prev => prev.map(d => d.messageId === msg.id ? { ...d, showTranscription: !d.showTranscription } : d)); }}
                                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                                          >
                                            {dState.showTranscription ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                            {dState.showTranscription ? 'Ocultar transcrição' : 'Ver transcrição'}
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Transcrição + tradução */}
                                    {!isOwnMsg && dState?.showTranscription && dState.originalText && (
                                      <div className="text-xs bg-card/80 p-2 rounded-lg border border-border/50 text-foreground/90 mt-1.5 animate-in slide-in-from-top-1 fade-in w-full max-w-[250px] sm:max-w-[300px]">
                                        {dState.translatedText && dState.translatedText !== dState.originalText ? (
                                          <>
                                            <div className="mb-1 text-primary font-medium">{dState.translatedText}</div>
                                            <div className="text-[10px] text-muted-foreground italic border-t border-border/30 pt-1 mt-1">Original: {dState.originalText}</div>
                                          </>
                                        ) : (
                                          dState.originalText
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              if (messageType === 'video') {
                                return (
                                  <div key={i} className="max-w-full relative group">
                                    <video 
                                      src={url} 
                                      controls={!isSelectionMode} 
                                      playsInline
                                      className={cn(
                                        "rounded-lg max-h-[300px] max-w-full border shadow-sm w-auto object-cover bg-black/10",
                                        isSelectionMode && "pointer-events-none"
                                      )} 
                                    />
                                  </div>
                                );
                              }
                              
                              return <img key={i} src={url} alt="midia" className="rounded-lg max-h-[300px] max-w-full border shadow-sm w-auto object-cover bg-black/10" />;
                            })}
                          </div>
                        )}

                        {messageType === 'poll' && timerState?.status !== 'showingUndoing' && (() => {
                          const poll = (pollRows || []).find((p) => p.message_id === msg.id);
                          if (!poll) return null;
                          return (
                            <PollCard
                              poll={poll}
                              options={pollOptionsForMessage(msg.id)}
                              myVoteOptionId={myVoteOptionFor(msg.id)}
                              isVoting={votingPollId === poll.id}
                              onVote={(optionId) => handlePollVote(poll.id, optionId)}
                            />
                          );
                        })()}

                        {messageType === 'sticker' && timerState?.status !== 'showingUndoing' && (
                          <div className={cn(
                            "shadow-md relative group max-w-full",
                            isOwn
                              ? "bg-transparent text-primary-foreground"
                              : "bg-transparent"
                          )}>
                            {typeof msg.content === 'string' && msg.content.startsWith('__sticker_emoji__') ? (
                              <div className={cn(
                                "text-5xl leading-none select-none",
                                isOwn ? "text-right" : "text-left"
                              )}>
                                {msg.content.replace('__sticker_emoji__', '')}
                              </div>
                            ) : (
                              <div className={cn(
                                "rounded-2xl overflow-hidden border bg-black/5",
                                isOwn ? "border-primary/20" : "border-border"
                              )}>
                                {(() => {
                                  const src = (msg.media_urls?.[0] as any) || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`temp_sticker:${msg.id}`) : null);
                                  if (!src) return null;
                                  return (
                                    <img
                                      src={src}
                                      alt="figurinha"
                                      className="max-h-[160px] max-w-[160px] w-auto h-auto object-contain"
                                    />
                                  );
                                })()}
                              </div>
                            )}

                            {isOwn && isPrivateChat && (
                              <div className="flex justify-end mt-1">
                                <span className={cn(
                                  "text-[10px] font-medium flex items-center gap-1",
                                  msg.viewed_at ? "text-green-600" : "text-red-500"
                                )}>
                                  <Check className="h-3 w-3" />
                                  {msg.viewed_at ? 'Visto' : 'Não vista'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {editingMsgId === msg.id ? (
                          <div className={cn(
                            "px-3 py-2.5 w-full max-w-full",
                            isOwn ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-[20px] rounded-tr-[4px] shadow-primary/20" : "bg-card border border-border/40 text-foreground rounded-[20px] rounded-tl-[4px]"
                          )}>
                            <Textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={3}
                              autoFocus
                              className="bg-transparent border border-border/40 text-[15px] leading-relaxed resize-none"
                              placeholder="Editar mensagem..."
                            />
                            <div className="flex items-center justify-end gap-2 mt-2">
                              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={cancelEditMessage}>
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[11px] gap-1"
                                onClick={() => void saveEditMessage()}
                                disabled={isSavingEditMsg || !editDraft.trim()}
                              >
                                {isSavingEditMsg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                Salvar
                              </Button>
                            </div>
                          </div>
                        ) : msg.content && messageType !== 'sticker' && messageType !== 'poll' && messageType !== 'location_request' && messageType !== 'location' && !msg.content.startsWith('__location_request_') && timerState?.status !== 'showingUndoing' && (
                          <div className={cn(
                            "px-4 py-2.5 shadow-sm text-[15px] leading-relaxed relative group break-words min-w-[60px] max-w-full transition-all duration-200", 
                            isOwn ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-[20px] rounded-tr-[4px] shadow-primary/20" : "bg-card border border-border/40 text-foreground rounded-[20px] rounded-tl-[4px]"
                          )}>
                            <div className="break-words overflow-hidden">
                              <MentionText text={displayText} />
                              {translationState?.isTranslated && !translationState.revealOriginal && translationState.sourceLang && translationState.sourceLang !== 'auto' && translationState.sourceLang !== 'unknown' && translationState.sourceLang !== translationState.targetLang && (
                                <div className="text-[9px] opacity-60 block mt-1 italic text-muted-foreground">
                                  Traduzido do {getLanguageName(translationState.sourceLang)}
                                </div>
                              )}
                              {translationState?.isLoading && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Traduzindo...</span>
                                </div>
                              )}
                              {speechState?.isSpeaking && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                                  <Volume2 className="h-3 w-3 animate-pulse" />
                                  <span>Reproduzindo áudio...</span>
                                </div>
                              )}
                            </div>

                            {!isOwn && msg.content && !isSelectionMode && (
                              <div className="flex justify-between items-center mt-2 border-t border-foreground/5 pt-1 relative">
                                <div className="flex items-center gap-2">
                                  <span className={cn("text-[10px] opacity-60", isOwn ? "text-primary-foreground" : "text-muted-foreground")}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {msg.is_pq_encrypted && (
                                    <div className="flex items-center gap-1 text-[9px] font-medium text-emerald-500/90" title="Criptografia pós-quântica ponta a ponta (ML-KEM-768 + ML-DSA-65)">
                                      <Lock className="h-2.5 w-2.5" />
                                      <span>PQ-E2EE</span>
                                    </div>
                                  )}
                                  {msg.edited_at && (
                                    <span className="text-[9px] italic opacity-50" title={msg.edited_at ? `Editado em ${new Date(msg.edited_at).toLocaleString()}` : undefined}>
                                      Editado
                                    </span>
                                  )}
                                  {translationState?.isTranslated && !translationState.revealOriginal && (
                                    <div className="flex items-center gap-1 text-[9px] opacity-70 text-muted-foreground font-medium">
                                      <Globe className="h-2 w-2" />
                                      <span className="flex items-center gap-1">
                                        {translationState.sourceLang && translationState.sourceLang !== 'auto' && (
                                          <>
                                            <span>{getLanguageFlag(translationState.sourceLang)}</span>
                                            <ArrowRight className="h-2 w-2" />
                                          </>
                                        )}
                                        <span>{getLanguageFlag(translationState.targetLang)}</span>
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 px-2 text-[10px] transition-all", speechState?.isSpeaking ? "text-primary opacity-100 font-medium" : "text-muted-foreground opacity-70 hover:opacity-100")}
                                    onClick={() => speechState?.isSpeaking ? stopSpeech(msg.id) : speakText(displayText, msg.id, translationState?.isTranslated ? translationState.targetLang : 'pt')}
                                  >
                                    {speechState?.isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                                  </Button>

                                  {translationState?.isTranslated && translationState.translatedText && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn("h-6 px-2 text-[10px] opacity-60 hover:opacity-100 transition-all", !translationState.revealOriginal && "text-primary opacity-100")}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTranslations(prev => prev.map(t => t.messageId === msg.id ? { ...t, revealOriginal: !t.revealOriginal } : t));
                                      }}
                                    >
                                      {translationState.revealOriginal ? "Ver tradução" : "Ver original"}
                                    </Button>
                                  )}

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 px-2 text-[10px] opacity-60 hover:opacity-100 transition-all flex items-center gap-1", translationState?.isLoading && "opacity-100", translationState?.isTranslated && "text-primary opacity-100")}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (translationState?.isTranslated) {
                                        setOpenMenuId(msg.id);
                                      } else {
                                        const savedLang = selectedConversation ? localStorage.getItem(`translate_lang_${selectedConversation}`) : null;
                                        if (savedLang && !translationState?.isTranslated) {
                                          handleTranslate(msg.id, displayText, savedLang);
                                        } else {
                                          setOpenMenuId(msg.id);
                                        }
                                      }
                                    }}
                                    disabled={translationState?.isLoading}
                                  >
                                    {translationState?.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Languages className="h-3 w-3 mr-1" />}
                                    {translationState?.isTranslated ? "Traduzido" : "Traduzir"}
                                  </Button>
                                </div>
                              </div>
                            )}
                            {isOwn && (
                              <div className="flex justify-end items-center gap-2 mt-1">
                                <span className="text-[10px] opacity-60">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {msg.edited_at && (
                                  <span className="text-[9px] italic opacity-50" title={msg.edited_at ? `Editado em ${new Date(msg.edited_at).toLocaleString()}` : undefined}>
                                    Editado
                                  </span>
                                )}
                                {msg.is_pq_encrypted && (
                                  <div className="flex items-center gap-1 text-[9px] font-medium text-emerald-500/90" title="Criptografia pós-quântica ponta a ponta (ML-KEM-768 + ML-DSA-65)">
                                    <Lock className="h-2.5 w-2.5" />
                                    <span>PQ-E2EE</span>
                                  </div>
                                )}
                                {isPrivateChat && (
                                  <span className={cn("text-[10px] font-medium flex items-center gap-1", msg.viewed_at ? "text-green-600" : "text-red-500")}>
                                    <Check className="h-3 w-3" />
                                    {msg.viewed_at ? 'Visto' : 'Não vista'}
                                  </span>
                                )}
                                {!isSelectionMode && !msg.is_pq_encrypted && messageType === 'text' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] text-muted-foreground opacity-0 group-hover/item:opacity-70 hover:opacity-100 hover:text-primary transition-all"
                                    onClick={() => startEditMessage(msg)}
                                    title="Editar mensagem (15 minutos)"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {!isSelectionMode && confirmDeleteMsgId === msg.id ? (
                                  <span className="flex items-center gap-1 animate-in fade-in zoom-in duration-150">
                                    <span className="text-[10px] text-destructive font-medium">Apagar p/ todos?</span>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() => void handleDeleteForAll(msg.id)}
                                    >
                                      Sim
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setConfirmDeleteMsgId(null)}>
                                      Não
                                    </Button>
                                  </span>
                                ) : (
                                  !isSelectionMode && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] text-muted-foreground opacity-0 group-hover/item:opacity-70 hover:opacity-100 hover:text-destructive transition-all"
                                      onClick={() => { setEditingMsgId(null); setConfirmDeleteMsgId(prev => prev === msg.id ? null : msg.id); }}
                                      title="Apagar para todos"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Data/hora universal — exibida em TODAS as mensagens (texto, áudio, mídia, sticker, enquete, localização) */}
                        {timerState?.status !== 'showingUndoing' && (
                          <div className={cn(
                            "flex items-center gap-1.5 mt-1 px-1",
                            isOwn ? "justify-end" : "justify-start"
                          )}>
                            <span className="text-[10px] text-muted-foreground/80">
                              {new Date(msg.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              {' • '}
                              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOwn && isPrivateChat && (
                              <span className={cn("text-[10px] font-medium flex items-center gap-0.5", msg.viewed_at ? "text-green-600" : "text-red-500")}>
                                <Check className="h-3 w-3" />
                                {msg.viewed_at ? 'Visto' : 'Enviado'}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Reações Fase 1 */}
                        {!isSelectionMode && timerState?.status !== 'deleting' && timerState?.status !== 'showingUndoing' && confirmDeleteMsgId !== msg.id && (
                          <div className={cn("flex items-center gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
                            <ReactionBar
                              reactions={reactionsForMessage(msg.id)}
                              currentUserId={user?.id || null}
                              onToggle={(emoji) => void handleToggleReaction(msg.id, emoji)}
                            />
                            <ReactionPicker
                              myEmojis={myReactionsForMessage(msg.id)}
                              onReact={(emoji) => void handleToggleReaction(msg.id, emoji)}
                            />
                          </div>
                        )}

                        {/* Botões individuais de salvar removidos     use o interruptor no topo do chat */}
                      </div>
                    </div>
                  );
                });
              })()}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {showScrollButton && <Button size="icon" className="absolute bottom-24 right-6 rounded-full shadow-xl z-20 animate-in fade-in zoom-in duration-300" onClick={() => scrollToBottom(false)}><ArrowDown className="h-5 w-5" /></Button>}

            <div className="p-3 sm:p-5 bg-transparent pb-4 sm:pb-6 relative z-10">
              <div className="max-w-4xl mx-auto w-full bg-card/80 backdrop-blur-lg border border-border/40 shadow-xl rounded-[28px] overflow-visible">
                {isSelectionMode ? (
                  <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-primary animate-pulse" />
                      <span className="text-sm font-medium text-foreground">
                        Selecione as mensagens que deseja apagar
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedMessagesForDeletion(new Set());
                      }}
                      className="rounded-xl font-bold text-xs"
                    >
                      Concluído
                    </Button>
                  </div>
                ) : (
                  <>
                    {isPrivateChat && user && privatePeerId && (
                      <div className="px-4 pt-4 pb-1">
                        <SaveModeToggle
                          conversationId={selectedConversation!}
                          currentUserId={user.id}
                          peerId={privatePeerId}
                          mode="banner"
                        />
                      </div>
                    )}
                    <MessageInput
                      currentUserId={user?.id || null}
                      onSendMessage={handleSendMessage}
                      onAudioReady={handleAudioUpload}
                      onMediaReady={handleMediaUpload}
                      onSendEmojiSticker={(emoji) => handleSendSticker(`emoji:${emoji}`)}
                      onSendImageSticker={(stickerUrl) => handleSendSticker(stickerUrl)}
                      // Figurinhas agora ficam no DISPOSITIVO do usuário (localStorage/IndexedDB via browser).
                      // Mantemos a opção cloud desativada para esta versão.
                      initialMineStickers={[]}
                      onTypingChange={handleTypingChange}
                      showAttentionButton={false}
                      attentionReceiverId={isPrivateChat ? privatePeerId : null}
                      onRequestLocation={isPrivateChat ? handleRequestLocation : undefined}
                      audioTranslateEnabled={dubOutgoingEnabled}
                      myLanguage={autoTranslateLang}
                      autoCorrectEnabled={autoCorrectEnabled}
                      onTranslateRequest={async (text, lang) => (await translateText(text, lang)).translatedText}
                      onScheduleClick={() => setIsScheduleModalOpen(true)}
                      onMakeCall={isPrivateChat ? (type) => makeCall(privatePeerId!, type) : undefined}
                      disabled={!selectedConversation}
                      mentionAllEnabled={isGroupChat}
                      mentionableUsernames={groupMentionUsernames}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Modal de Agendamento de Mensagens */}
            {selectedConversation && user?.id && (
              <ScheduleMessageModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                conversationId={selectedConversation}
                currentUserId={user.id}
              />
            )}

            {/* Modal de amostra de voz (dublagem com a voz do usuário) */}
            {user?.id && (
              <VoiceSampleDialog
                open={voiceSampleDialogOpen}
                onOpenChange={setVoiceSampleDialogOpen}
                currentUserId={user.id}
                recentOwnAudioUrl={recentOwnAudioUrl}
                hasRegisteredSample={!!voiceSampleUrl}
                onReady={(url) => void handleVoiceSampleReady(url)}
              />
            )}

            {/* Modal de criação de grupo */}
            {user?.id && (
              <CreateGroupModal
                open={isCreateGroupOpen}
                onOpenChange={setIsCreateGroupOpen}
                currentUserId={user.id}
                onCreated={handleGroupCreated}
              />
            )}

            {/* Painel de informações do grupo */}
            {user?.id && selectedConversation && isGroupChat && (
              <GroupInfoSheet
                open={isGroupInfoOpen}
                onOpenChange={setIsGroupInfoOpen}
                conversationId={selectedConversation}
                currentUserId={user.id}
                onChanged={() => {
                  void refetchConversations();
                  void refetchGroupMembers();
                }}
              />
            )}

            {/* Modal de criação de enquete */}
            {selectedConversation && (
              <CreatePollModal
                open={isCreatePollOpen}
                onOpenChange={setIsCreatePollOpen}
                onSubmit={(payload) => void handleCreatePoll(payload)}
                isSubmitting={isCreatingPoll}
              />
            )}

            {/* Block User Modal */}
            <BlockUserModal
              open={blockModalOpen}
              onOpenChange={setBlockModalOpen}
              targetUserId={blockTarget?.id || ""}
              targetUserName={blockTarget?.name || ""}
              targetUserAvatar={blockTarget?.avatar || null}
              onBlocked={() => { void refetchConversations(); void refetchGroupMembers(); }}
            />

            {/* Friend Requests with Message Modal */}
            {showFriendRequests && receivedRequests && receivedRequests.length > 0 && (
              <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200"
                onClick={(e) => e.target === e.currentTarget && setShowFriendRequests(false)}>
                <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 max-h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-pink-500" />
                      <span className="font-semibold">Solicitações de Amizade</span>
                    </div>
                    <button onClick={() => setShowFriendRequests(false)} className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {receivedRequests.map((req: any) => (
                      <FriendRequestWithMessage
                        key={req.id}
                        request={req}
                        onUpdate={() => { }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Emoji Picker */}
            <EmojiPicker
              open={emojiPickerOpen}
              onOpenChange={setEmojiPickerOpen}
              onSelectEmoji={(emoji, packId, isAnimated) => {
                const textarea = document.querySelector('textarea[placeholder*="mensagem"]') as HTMLTextAreaElement;
                if (textarea) {
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const text = textarea.value;
                  textarea.value = text.slice(0, start) + emoji + text.slice(end);
                  textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  textarea.focus();
                }
                setEmojiPickerOpen(false);
              }}
              currentPackId={selectedEmojiPack}
            />

          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-in fade-in duration-500">
            <div className="w-32 h-32 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <MessageSquarePlus className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Suas Mensagens</h1>
            <p className="text-muted-foreground max-w-md mb-8 text-lg">Selecione uma conversa na barra lateral ou inicie um novo chat com seus amigos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
