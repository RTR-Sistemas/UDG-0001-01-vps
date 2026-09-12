/**
 * =============================================================================
 * File: src/pages/ChatTeste.tsx
 * Purpose: Nova tela de chat com visual do UDG-002-02 (ChatSimulator) e
 *          toda a lógica funcional do Messages.tsx (tradução, dublagem, TTS,
 *          presença, realtime, timers, SaveMode, etc.).
 *
 * Criado em: 2026-07-28
 * =============================================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Mic,
  UserPlus,
  MessageCircle,
  ArrowDown,
  ChevronLeft,
  User,
  Loader2,
  Lock,
  Clock,
  Play,
  Pause,
  Languages,
  Globe,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  X,
  Volume2,
  VolumeX,
  MapPin,
  Trash2,
  Sun,
  Moon,
  Zap,
  Phone,
  Video,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Info,
  Smile,
  ArrowLeft,
  Image as ImageIcon,
  Menu,
  Users,
  Square,
  CheckSquare
} from "lucide-react";
import AttentionButton from "@/components/realtime/AttentionButton";
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
import { usePlatformSounds } from "@/hooks/usePlatformSounds";
import { useCalls } from "@/hooks/useCalls";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

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
}

interface DubbingState {
  messageId: string;
  dubbingId?: string;
  dubbedAudioUrl?: string;
  originalText?: string;
  translatedText?: string;
  sourceLang?: string;
  isLoading: boolean;
  hasFailed: boolean;
  showTranscription?: boolean;
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

// --- Componente do Menu de Idiomas ---
const LanguageMenuModal = ({
  messageId,
  originalText,
  currentTranslation,
  onTranslate,
  onClose
}: {
  messageId: string;
  originalText: string;
  currentTranslation?: TranslationState;
  onTranslate: (messageId: string, text: string, targetLang: string) => void;
  onClose: () => void;
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
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[999] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-background border border-[#1F2937] shadow-2xl rounded-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#1F2937] bg-[#131922] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-[#7B3F9E]" />
              <span className="font-semibold text-lg text-gray-200">Traduzir mensagem</span>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#1F2937] text-muted-foreground hover:text-foreground transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory('popular')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition",
                selectedCategory === 'popular' ? 'bg-[#7B3F9E]/20 text-[#BB86D8] border border-[#7B3F9E]/30' : 'text-gray-400 hover:text-gray-200 border border-transparent'
              )}
            >Populares</button>
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition",
                selectedCategory === 'all' ? 'bg-[#7B3F9E]/20 text-[#BB86D8] border border-[#7B3F9E]/30' : 'text-gray-400 hover:text-gray-200 border border-transparent'
              )}
            >Todos</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 mt-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-1 pb-4">
            {currentTranslation?.isTranslated && (
              <button
                className="w-full text-left px-3 py-3 text-sm hover:bg-[#1F2937] rounded-lg flex items-center gap-3 font-medium text-[#BB86D8] border border-[#7B3F9E]/20 mb-2"
                onClick={() => handleLanguageSelect('original')}
              >
                <X className="h-4 w-4" />
                <div className="flex-1">
                  <div>Ver Original</div>
                  <div className="text-xs text-gray-500">{getLanguageNativeName(currentTranslation.sourceLang || 'auto')}</div>
                </div>
                <Check className="h-4 w-4 text-[#7B3F9E]" />
              </button>
            )}

            {(selectedCategory === 'popular' ? popularLanguages : AVAILABLE_LANGUAGES).map((lang) => (
              <button
                key={lang.code}
                className={cn(
                  "w-full text-left px-3 py-3 text-sm hover:bg-[#1F2937] rounded-lg flex items-center gap-3 transition-colors text-gray-200",
                  currentTranslation?.targetLang === lang.code && currentTranslation.isTranslated && "bg-[#1F2937]/50"
                )}
                onClick={() => handleLanguageSelect(lang.code)}
              >
                <span className="text-base pointer-events-none">{lang.flag}</span>
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden items-start pointer-events-none">
                  <span className="font-medium">{lang.name}</span>
                  <span className="text-xs text-gray-500">{lang.nativeName}</span>
                </div>
                {currentTranslation?.targetLang === lang.code && currentTranslation.isTranslated && (
                  <Check className="h-4 w-4 text-[#7B3F9E] flex-shrink-0 pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-[#1F2937] bg-[#131922]/50 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
            <Globe className="h-3 w-3" />
            <span>Tradução automática</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- CustomAudioPlayer Component (UDG-002-02 style) ---
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
          onPlay();
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

  const handleEnded = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };

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
    <div className={cn("flex items-center gap-2 p-2 rounded-xl", className)}>
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} onLoadedMetadata={handleLoadedMetadata} onPause={() => setIsPlaying(false)} preload="metadata" src={audioUrl} />
      <button
        onClick={handlePlayPause}
        className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition",
          isOwn ? "bg-white/20 hover:bg-white/30 text-white" : "bg-[#7B3F9E]/20 hover:bg-[#7B3F9E]/30 text-[#BB86D8]"
        )}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current translate-x-[1px]" />}
      </button>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer relative" onClick={handleSeek}>
          <div className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-100", isOwn ? "bg-white/50" : "bg-[#7B3F9E]/60")} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[9px] font-medium text-gray-400">
          <span>{formatTimePlayer(currentTime)}</span>
          <span>{formatTimePlayer(duration)}</span>
        </div>
      </div>
    </div>
  );
};


// =============================================================================
// COMPONENTE PRINCIPAL — ChatTeste
// =============================================================================
export default function ChatTeste() {
  const { user } = useAuth();
  const { markAsRead: markMessagesAsRead } = useUnreadMessages();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { playSend, playReceive } = usePlatformSounds();
  const { makeCall } = useCalls();

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

  useEffect(() => {
    if (!user) return;
    void markMessagesAsRead();
  }, [user?.id]);

  // Presença global
  const [presenceMap, setPresenceMap] = useState<Record<string, { last_seen?: string }>>({});
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (presenceChannelRef.current) return;

    const channel = supabase.channel("udg_global_presence", {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;

    const track = async () => {
      try {
        const nowIso = new Date().toISOString();
        await channel.track({ last_seen: nowIso });
        void supabase.from('profiles').update({ last_seen: nowIso }).eq('id', user.id).then(() => undefined, () => undefined);
      } catch {}
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
  }, [user?.id]);

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"chats" | "contacts">("chats");
  const [searchParams, setSearchParams] = useSearchParams();

  const selectConversation = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) { next.set('conversation', id); } else { next.delete('conversation'); }
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    const conv = searchParams.get('conversation');
    const tab = searchParams.get('tab') as any;
    if (tab === 'contacts' || tab === 'chats') setSidebarTab(tab);
    setSelectedConversation(conv || null);
  }, [searchParams]);

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

  // Auto-translate toggle
  const [autoTranslateEnabled, setAutoTranslateEnabled] = useState(() => {
    try { return localStorage.getItem('chat_auto_translate') === '1'; } catch { return false; }
  });
  const [autoTranslateLang, setAutoTranslateLang] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('chat_auto_translate_lang');
      if (stored) return stored;
      const navLang = navigator.language || 'pt-BR';
      const bLang = navLang.toLowerCase();
      const supported = ['en', 'en-us', 'en-gb', 'es', 'fr', 'de', 'it', 'pt', 'pt-br', 'pt-pt', 'pl', 'tr', 'ru', 'nl', 'cs', 'ar', 'zh', 'ja', 'ko', 'hu', 'hi'];
      if (supported.includes(bLang)) return bLang;
      const shortLang = bLang.split('-')[0];
      return supported.includes(shortLang) ? shortLang : 'pt-br';
    } catch { return 'pt-br'; }
  });

  const toggleAutoTranslate = () => {
    setAutoTranslateEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_auto_translate', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Audio translation toggle
  const [audioTranslateEnabled, setAudioTranslateEnabled] = useState(() => {
    try { return localStorage.getItem('chat_translate_audio') !== '0'; } catch { return true; }
  });

  const toggleAudioTranslate = () => {
    setAudioTranslateEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('chat_translate_audio', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Modal de exclusão e seleção
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessagesForDeletion, setSelectedMessagesForDeletion] = useState<Set<string>>(new Set());
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Collapse header details (UDG-002-02 style)
  const [metadataExpanded, setMetadataExpanded] = useState(true);
  // Inspector panel
  const [selectedInspectMessage, setSelectedInspectMessage] = useState<any>(null);

  // Mobile sidebar toggle
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Typing
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
    if (!synth) { toast({ title: "Erro", description: "Seu navegador não suporta leitura de voz.", variant: "destructive" }); return; }
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
        const preferredVoice = voices.find((v: any) => v.lang === speechLang);
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
    if (messageId) { setSpeechStates(prev => prev.map(s => s.messageId === messageId ? { ...s, isSpeaking: false } : s)); }
    else { setSpeechStates(prev => prev.map(s => ({ ...s, isSpeaking: false }))); }
    if (synth) synth.cancel();
  }, []);

  useEffect(() => { return () => { const synth = window.speechSynthesis || (window as any).webkitSpeechSynthesis; if (synth) synth.cancel(); }; }, []);
  const getSpeechState = (messageId: string) => speechStates.find(s => s.messageId === messageId);

  // --- TRANSLATION LOGIC ---
  const googleTranslateClient = async (text: string, targetLang: string, sourceLang = 'auto'): Promise<{ translatedText: string; detectedLang: string } | null> => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&dt=ld&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
      const translatedText = (data[0] as any[]).map((p: any) => (Array.isArray(p) ? p[0] : '')).filter(Boolean).join('');
      if (!translatedText) return null;
      const detectedLang = sourceLang === 'auto' ? (data[2] as string || 'unknown') : sourceLang;
      return { translatedText, detectedLang };
    } catch { return null; }
  };

  const callTranslateApi = async (textChunk: string, targetLang: string): Promise<{ text: string; detectedLang?: string }> => {
    const safeChunk = typeof textChunk === 'string' ? textChunk : String(textChunk || '');
    const googleResult = await googleTranslateClient(safeChunk, targetLang, 'auto');
    if (googleResult) return { text: googleResult.translatedText, detectedLang: googleResult.detectedLang };
    try {
      const response = await fetch('https://undoing.com.br/.netlify/functions/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: safeChunk, targetLang, type: 'translate' })
      });
      if (response.ok) {
        const result = await response.json();
        if (result?.data?.translatedText) return { text: result.data.translatedText, detectedLang: result.data.detectedLang };
      }
    } catch (e) { console.warn('Netlify translate fallback failed:', e); }
    return { text: safeChunk };
  };

  const translateText = async (text: string, targetLang: string): Promise<{ translatedText: string; detectedLang?: string }> => {
    const safeText = typeof text === 'string' ? text : String(text || '');
    if (!safeText.trim()) return { translatedText: safeText };
    const CHUNK_SIZE = 1000;
    if (safeText.length <= CHUNK_SIZE) {
      const result = await callTranslateApi(safeText, targetLang);
      return { translatedText: result.text, detectedLang: result.detectedLang };
    }
    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = safeText.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [safeText];
    sentences.forEach(sentence => {
      if ((currentChunk + sentence).length > CHUNK_SIZE && currentChunk.length > 0) { chunks.push(currentChunk.trim()); currentChunk = ''; }
      currentChunk += sentence;
    });
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
    const results = await Promise.all(chunks.map(chunk => callTranslateApi(chunk, targetLang)));
    return { translatedText: results.map(r => r.text).join(' '), detectedLang: results[0]?.detectedLang };
  };

  const handleTranslate = async (messageId: string, text: string, targetLang: string, isManual: boolean = true) => {
    setOpenMenuId(null);
    const safeText = typeof text === 'string' ? text : String(text || '');
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
      const { translatedText: translated, detectedLang: sourceLang } = await translateText(safeText, targetLang);
      setTranslations(prev => prev.map(t => t.messageId === messageId ? { ...t, translatedText: translated, isTranslated: true, isLoading: false, targetLang, sourceLang: sourceLang || 'unknown', isManual, hasFailed: false } : t));
      if (selectedConversation) localStorage.setItem(`translate_lang_${selectedConversation}`, targetLang);
    } catch (error) {
      console.error('Erro na tradução do chat:', error);
      toast({ title: 'Erro na tradução', description: 'Não foi possível traduzir esta mensagem.', variant: 'destructive' });
      setTranslations(prev => prev.map(t => t.messageId === messageId ? { ...t, isLoading: false, isTranslated: false, hasFailed: true } : t));
    }
  };

  const getTranslationState = (messageId: string) => translations.find(t => t.messageId === messageId);
  const getDubbingState = (messageId: string) => dubbingStates.find(d => d.messageId === messageId);

  const getMessageType = useCallback((msg: any): 'text' | 'audio' | 'media' | 'sticker' | 'location_request' | 'location' => {
    if (typeof msg?.content === 'string') {
      if (msg.content === '__location_request__') return 'location_request';
      if (msg.content.startsWith('__location__')) return 'location';
      if (msg.content === '__sticker__' || msg.content === '__temp_sticker__' || msg.content.startsWith('__sticker_emoji__')) return 'sticker';
    }
    if (msg.content) return 'text';
    if (msg.media_urls && msg.media_urls.some((url: string) => url.includes("audio_") || url.includes(".webm") || url.includes("audio") || url.includes(".mp3") || url.includes(".wav") || url.includes(".m4a"))) return 'audio';
    return 'media';
  }, []);

  // DUBBING LOGIC
  const startDubbing = async (messageId: string, audioUrl: string, targetLang: string) => {
    setDubbingStates(prev => {
      const existing = prev.find(d => d.messageId === messageId);
      if (existing) return prev.map(d => d.messageId === messageId ? { ...d, isLoading: true, hasFailed: false } : d);
      return [...prev, { messageId, isLoading: true, hasFailed: false }];
    });
    let extractedData: any = null;
    try {
      const res = await fetch('/.netlify/functions/huggingface-dubbing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl, targetLang })
      });
      if (!res.ok) { const errorText = await res.text(); throw new Error(`Hugging Face STT/Translate API failed: ${res.status} ${errorText}`); }
      extractedData = await res.json();
      if (extractedData.status !== 'completed' || !extractedData.translatedText) throw new Error('STT or Translation failed');

      let finalDubbedUrl: string | undefined = undefined;
      if (extractedData.sourceLang && extractedData.sourceLang.toLowerCase() !== targetLang.toLowerCase()) {
        if (extractedData.audioBase64) {
          finalDubbedUrl = `data:${extractedData.mimeType || 'audio/mpeg'};base64,${extractedData.audioBase64}`;
        } else {
          finalDubbedUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=gtx&q=${encodeURIComponent(extractedData.translatedText)}`;
        }
      }

      setDubbingStates(prev => prev.map(d => d.messageId === messageId ? { ...d, isLoading: false, dubbedAudioUrl: finalDubbedUrl, originalText: extractedData.originalText, translatedText: extractedData.translatedText, sourceLang: extractedData.sourceLang } : d));
    } catch (error: any) {
      console.error('Erro na dublagem HF:', error);
      toast({ title: 'Aviso de Dublagem', description: 'Não foi possível clonar a voz. A transcrição do áudio foi salva.', variant: 'destructive' });
      setDubbingStates(prev => prev.map(d => d.messageId === messageId ? { ...d, isLoading: false, hasFailed: true, originalText: extractedData?.originalText || undefined, sourceLang: extractedData?.sourceLang || undefined, showTranscription: !!extractedData?.originalText } : d));
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // --- Scroll Logic ---
  const scrollToBottom = useCallback((instant: boolean = false) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: instant ? "auto" : "smooth" });
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
    queryKey: ["user-profile-ct", user?.id], enabled: !!user,
    queryFn: async () => { const { data } = await supabase.from("profiles").select("friend_code").eq("id", user!.id).single(); return data; },
  });

  const { data: rawConversations, refetch: refetchConversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ["conversations-ct", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data: participantData, error: participantError } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user!.id);
      if (participantError) throw participantError;
      if (!participantData || participantData.length === 0) return [];
      const conversationIds = participantData.map(p => p.conversation_id);
      const { data, error } = await supabase.from("conversations")
        .select(`*, conversation_participants!inner(user_id, profiles(username, avatar_url, last_seen)), messages(id, content, created_at, media_urls, user_id, deleted_at, viewed_at)`)
        .in("id", conversationIds)
        .order('created_at', { foreignTable: 'messages', ascending: false })
        .limit(20, { foreignTable: 'messages' })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const processedConversations = useMemo(() => {
    if (!rawConversations || !user) return [];
    const uniqueMap = new Map();
    rawConversations.forEach((conv) => {
      const activeLastMessage = conv.messages?.find((m: any) => m.deleted_at === null);
      const lastMsgDate = activeLastMessage?.created_at ? new Date(activeLastMessage.created_at).getTime() : new Date(conv.created_at).getTime();
      const convWithDate = { ...conv, sortTime: lastMsgDate, unreadCount: conv.messages?.filter((msg: any) => msg.user_id !== user.id && msg.viewed_at === null && msg.deleted_at === null).length || 0 };
      if (conv.is_group) { uniqueMap.set(conv.id, convWithDate); }
      else {
        const otherParticipant = conv.conversation_participants.find((p: any) => p.user_id !== user.id);
        if (otherParticipant?.user_id) {
          const existing = uniqueMap.get(otherParticipant.user_id);
          if (!existing || lastMsgDate > existing.sortTime) uniqueMap.set(otherParticipant.user_id, convWithDate);
        }
      }
    });
    return Array.from(uniqueMap.values()).sort((a, b) => b.sortTime - a.sortTime);
  }, [rawConversations, user]);

  const { data: messages, refetch: refetchMessages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["messages-ct", selectedConversation],
    enabled: !!selectedConversation && selectedConversation !== "null",
    queryFn: async () => {
      if (!selectedConversation || selectedConversation === "null") return [];
      const { data, error } = await supabase.from("messages")
        .select(`*, profiles:user_id(username, avatar_url)`)
        .eq("conversation_id", selectedConversation).is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: saveRequests, refetch: refetchSaveRequests } = useQuery({
    queryKey: ["save_requests_ct", selectedConversation],
    enabled: !!selectedConversation && selectedConversation !== "null",
    queryFn: async () => {
      if (!selectedConversation || selectedConversation === "null") return [];
      const { data, error } = await supabase.from("saved_messages").select("*").eq("conversation_id", selectedConversation);
      if (error) return [];
      return data || [];
    }
  });

  const selectedConvData = useMemo(() => {
    if (!selectedConversation || !rawConversations) return null;
    return rawConversations.find((c: any) => c.id === selectedConversation) || null;
  }, [rawConversations, selectedConversation]);

  const privatePeer = useMemo(() => {
    if (!selectedConvData || !user || selectedConvData.is_group) return null;
    return selectedConvData.conversation_participants?.find((p: any) => p.user_id !== user.id) || null;
  }, [selectedConvData, user]);

  const privatePeerId = (privatePeer?.user_id as string | undefined) ?? null;
  const privatePeerProfile = privatePeer?.profiles ?? null;
  const isPrivateChat = !!privatePeerId && !selectedConvData?.is_group;

  const saveModeData = useSaveModeStatus(isPrivateChat ? selectedConversation : null);

  const { data: saveModePeriods, refetch: refetchSaveModePeriods } = useQuery({
    queryKey: ["save_mode_periods_ct", selectedConversation], enabled: !!selectedConversation,
    queryFn: async () => {
      const { data, error } = await supabase.from("conversation_save_mode").select("started_at, deactivated_at").eq("conversation_id", selectedConversation).not("started_at", "is", null);
      if (error) return [];
      return data || [];
    }
  });

  const isMessageSavedByGlobalMode = useCallback((msgCreatedAt: string) => {
    if (!saveModePeriods || saveModePeriods.length === 0) return false;
    return saveModePeriods.some((period: any) => {
      const start = new Date(period.started_at).getTime();
      const end = period.deactivated_at ? new Date(period.deactivated_at).getTime() : Infinity;
      const msgTime = new Date(msgCreatedAt).getTime();
      return msgTime >= start && msgTime <= end;
    });
  }, [saveModePeriods]);

  const peerPresence = useMemo(() => { if (!privatePeerId) return null; return presenceMap[privatePeerId] ?? null; }, [presenceMap, privatePeerId]);

  const peerOnline = useMemo(() => {
    const ls = peerPresence?.last_seen;
    if (!ls) return false;
    const dt = new Date(ls).getTime();
    if (!Number.isFinite(dt)) return false;
    return Date.now() - dt < 60 * 1000;
  }, [peerPresence]);

  const peerLastSeenLabel = useMemo(() => {
    const ls = peerPresence?.last_seen || (privatePeerProfile as any)?.last_seen;
    if (!ls) return null;
    const d = new Date(ls);
    if (isNaN(d.getTime())) return null;
    const datePart = d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  }, [peerPresence, privatePeerProfile]);

  // Canal de UI do chat (typing, etc.)
  useEffect(() => {
    if (!selectedConversation || !user?.id) return;
    if (uiChannelRef.current) { supabase.removeChannel(uiChannelRef.current); uiChannelRef.current = null; }
    const channel = supabase.channel(`chat-ui-ct-${selectedConversation}`, { config: { broadcast: { ack: false } } });
    uiChannelRef.current = channel;
    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, is_typing, conversation_id } = (payload as any).payload || {};
        if (!conversation_id || conversation_id !== selectedConversation) return;
        if (!privatePeerId || user_id !== privatePeerId) return;
        setIsPeerTyping(!!is_typing);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (is_typing) { typingTimeoutRef.current = setTimeout(() => setIsPeerTyping(false), 3500); }
      })
      .subscribe();
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(channel);
      uiChannelRef.current = null;
    };
  }, [selectedConversation, user?.id, privatePeerId]);

  // Marca como visualizadas
  useEffect(() => {
    if (!user?.id || !messages || !selectedConversation) return;
    const toMark = messages.filter((m: any) => m.user_id !== user.id && m.viewed_at == null);
    if (toMark.length === 0) return;
    const ids = toMark.map((m: any) => m.id);
    const viewedAt = new Date().toISOString();
    queryClient.setQueryData(["messages-ct", selectedConversation], (old: any) => Array.isArray(old) ? old.map((m: any) => (ids.includes(m.id) ? { ...m, viewed_at: viewedAt } : m)) : old);
    (async () => {
      const { error } = await supabase.from('messages').update({ viewed_at: viewedAt }).in('id', ids);
      if (error) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (token) {
            await fetch('/.netlify/functions/mark-messages-viewed', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ conversation_id: selectedConversation, normal_ids: ids, temp_ids: [], viewed_at: viewedAt }),
            });
          }
        } catch {}
      }
      void refetchConversations();
    })();
  }, [messages, selectedConversation, user?.id]);

  // Auto-translate effect for text
  useEffect(() => {
    if (!autoTranslateEnabled || !messages || messages.length === 0) return;
    messages.forEach((msg: any) => {
      const isOwn = msg.user_id === user?.id;
      if (isOwn) return;
      const msgType = getMessageType(msg);
      if (msgType !== 'text') return;
      const existing = translations.find(t => t.messageId === msg.id);
      if (!existing || existing.targetLang !== autoTranslateLang || (!existing.isTranslated && !existing.hasFailed)) {
        if (!existing?.isLoading) void handleTranslate(msg.id, msg.content, autoTranslateLang, false);
      }
    });
  }, [messages, autoTranslateEnabled, autoTranslateLang, user?.id, translations, handleTranslate]);

  // Auto-dubbing for audio
  useEffect(() => {
    if ((!audioTranslateEnabled && !autoTranslateEnabled) || !messages || messages.length === 0) return;
    messages.forEach((msg: any) => {
      const isOwn = msg.user_id === user?.id;
      if (isOwn) return;
      const msgType = getMessageType(msg);
      if (msgType !== 'audio') return;
      const existingDubbing = dubbingStates.find(d => d.messageId === msg.id);
      if (!existingDubbing && msg.media_urls?.[0]) startDubbing(msg.id, msg.media_urls[0], autoTranslateLang);
    });
  }, [messages, audioTranslateEnabled, autoTranslateEnabled, autoTranslateLang, user?.id, getMessageType, dubbingStates]);

  // --- Realtime ---
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`global-messages-ct-${user.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload: any) => {
        refetchMessages();
        refetchConversations();
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new;
          if (newMsg && newMsg.user_id !== user.id && newMsg.conversation_id === selectedConversation) playReceive();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => { refetchConversations(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchMessages, refetchConversations, user, playReceive, selectedConversation]);

  useEffect(() => {
    if (messages && messages.length > 0) { if (isAtBottom) setTimeout(() => scrollToBottom(false), 100); }
  }, [messages, isAtBottom, scrollToBottom]);

  useEffect(() => {
    if (selectedConversation) setTimeout(() => scrollToBottom(true), 200);
  }, [selectedConversation, scrollToBottom]);

  const handleTypingChange = useCallback((isTyping: boolean) => {
    if (!selectedConversation || !user?.id) return;
    if (!uiChannelRef.current) return;
    void uiChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { conversation_id: selectedConversation, user_id: user.id, is_typing: !!isTyping } });
  }, [selectedConversation, user?.id]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !selectedConversation || !user) return;
    const { data: msg, error } = await supabase.from("messages").insert({ conversation_id: selectedConversation, user_id: user.id, content: text }).select().single();
    if (error) { toast({ title: "Erro ao enviar", variant: "destructive" }); return; }
    if (msg) {
      playSend();
      const { saveMentions } = await import("@/utils/mentionsHelper");
      await saveMentions(msg.id, "message", text, user.id);
      await refetchMessages();
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  const handleMediaUpload = async (files: File[]) => {
    if (!selectedConversation || !user) return;
    try {
      const uploadPromises = files.map(async (file) => {
        const { url } = await uploadToCloudinary(file, { kind: "messages", userId: user.id, folder: `messages/${selectedConversation}/${user.id}` });
        return url;
      });
      const urls = await Promise.all(uploadPromises);
      await supabase.from("messages").insert({ conversation_id: selectedConversation, user_id: user.id, media_urls: urls }).select().single();
      playSend();
      await refetchMessages();
      scrollToBottom(true);
    } catch (e) { toast({ title: "Erro no envio", variant: "destructive" }); }
  };

  const handleAudioUpload = async (blob: Blob) => {
    if (!selectedConversation || !user) return;
    try {
      const file = blobToFile(blob, `audio_${Date.now()}.webm`, blob.type || "audio/webm");
      const { url } = await uploadToCloudinary(file, { kind: "messages", userId: user.id, folder: `messages/${selectedConversation}/${user.id}` });
      await supabase.from("messages").insert({ conversation_id: selectedConversation, user_id: user.id, media_urls: [url] }).select().single();
      playSend();
      await refetchMessages();
      scrollToBottom(true);
    } catch (e) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const startChatWithFriend = async (friendId: string) => {
    if (!user) return;
    const existingLocal = processedConversations.find((c: any) => !c.is_group && c.conversation_participants.some((p: any) => p.user_id === friendId));
    if (existingLocal) { selectConversation(existingLocal.id); setSidebarTab("chats"); return; }
    try {
      const { data: newConv } = await supabase.from("conversations").insert({ is_group: false }).select().single();
      if (newConv) {
        await supabase.from("conversation_participants").insert({ conversation_id: newConv.id, user_id: user.id });
        await supabase.from("conversation_participants").insert({ conversation_id: newConv.id, user_id: friendId });
        await refetchConversations();
        selectConversation(newConv.id);
        setSidebarTab("chats");
      }
    } catch (error) { toast({ title: "Erro", variant: "destructive" }); }
  };

  const filteredConversations = processedConversations.filter((c: any) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.conversation_participants.some((p: any) => p.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getSelectedMessageText = () => messages?.find((m: any) => m.id === openMenuId)?.content || '';

  const deleteMessages = async (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    try {
      const deletedAt = new Date().toISOString();
      await supabase.from('messages').update({ deleted_at: deletedAt, content: null, media_urls: null }).in('id', messageIds);
      setDeletedMessages(prev => { const newSet = new Set(prev); messageIds.forEach(id => newSet.add(id)); return newSet; });
    } catch (error) { console.error('Erro ao excluir mensagens:', error); }
  };

  // Determine sidebar/chat visibility
  const showSidebar = !selectedConversation || !mobileShowChat;
  const showChat = selectedConversation && (mobileShowChat || !isMobile);

  // =====================================================================
  // RENDER — VISUAL DO UDG-002-02 ChatSimulator
  // =====================================================================

  const isDark = theme === 'dark';

  return (
    <div className={`flex h-full overflow-hidden select-none transition-colors duration-300 ${isDark ? 'bg-[#0A0E14] text-gray-200' : 'bg-[#F8FAFC] text-slate-800'}`}>

      {/* Language Menu Modal */}
      {openMenuId && (
        <LanguageMenuModal
          messageId={openMenuId}
          originalText={getSelectedMessageText()}
          currentTranslation={translations.find(t => t.messageId === openMenuId)}
          onTranslate={handleTranslate}
          onClose={() => setOpenMenuId(null)}
        />
      )}

      {/* ═══════════ SIDEBAR — Lista de Conversas (Visual UDG-002-02) ═══════════ */}
      <div className={`w-full md:w-80 h-full border-r flex flex-col flex-shrink-0 transition-colors duration-300 ${
        (isMobile && mobileShowChat && selectedConversation) ? 'hidden' : 'flex'
      } ${isDark ? 'bg-background border-[#1F2937]' : 'bg-white border-[#E2E8F0]'}`}>

        {/* Header */}
        <div className={`p-4 border-b space-y-3 ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Minhas Conversas</h3>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition" title="Alternar tema">
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
              <CreatePrivateRoom />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setSidebarTab("chats")}
              className={cn("flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition",
                sidebarTab === "chats" ? (isDark ? 'bg-[#1F2937] text-white' : 'bg-slate-200 text-slate-900') : 'text-gray-500 hover:text-gray-300'
              )}
            >Conversas</button>
            <button
              onClick={() => setSidebarTab("contacts")}
              className={cn("flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition",
                sidebarTab === "contacts" ? (isDark ? 'bg-[#1F2937] text-white' : 'bg-slate-200 text-slate-900') : 'text-gray-500 hover:text-gray-300'
              )}
            >Contatos</button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text" placeholder="Buscar conversas..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl py-2 pl-9 pr-4 text-xs transition ${
                isDark ? 'bg-[#131922] border-[#1F2937] text-gray-200 placeholder-gray-500 focus:border-[#7B3F9E]'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#7B3F9E]'
              }`}
            />
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>

        {/* Conversations / Contacts list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sidebarTab === "chats" ? (
            isLoadingConversations ? (
              <div className="flex items-center justify-center h-40 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv: any) => {
                const otherParticipant = conv.conversation_participants.find((p: any) => p.user_id !== user?.id);
                const lastMessage = conv.messages?.find((m: any) => m.deleted_at === null);
                const isActive = selectedConversation === conv.id;
                const displayName = conv.name || otherParticipant?.profiles?.username || "Sala Privada";
                const otherUserId = otherParticipant?.user_id;
                const isOnline = otherUserId && presenceMap[otherUserId]?.last_seen
                  ? Date.now() - new Date(presenceMap[otherUserId].last_seen!).getTime() < 60000
                  : false;

                return (
                  <button
                    key={conv.id}
                    onClick={() => { selectConversation(conv.id); setMobileShowChat(true); setSelectedInspectMessage(null); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isActive
                        ? isDark ? 'bg-[#1F2937]/50 border border-[#1F2937]' : 'bg-slate-100 border border-slate-200/80 shadow-sm'
                        : isDark ? 'hover:bg-[#131922]/50 border border-transparent' : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={otherParticipant?.profiles?.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-tr from-[#7B3F9E] to-indigo-500 text-white text-sm font-bold">
                          {conv.is_group ? <Users className="h-4 w-4" /> : displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#22C55E] border-2 border-white dark:border-[#0D1117] rounded-full animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold truncate ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>{displayName}</p>
                        <span className="text-[9px] text-gray-400">
                          {lastMessage ? (new Date(lastMessage.created_at).toLocaleDateString() === new Date().toLocaleDateString()
                            ? new Date(lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date(lastMessage.created_at).toLocaleDateString()) : 'Ativo'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-[#7B3F9E] flex-shrink-0" />
                        <span className="truncate">
                          {lastMessage?.content
                            ? (lastMessage.content === '__sticker__' || lastMessage.content === '__temp_sticker__' ? '🧩 Figurinha' : lastMessage.content.startsWith('__sticker_emoji__') ? lastMessage.content.replace('__sticker_emoji__', '') : lastMessage.content)
                            : lastMessage?.media_urls ? '📷 Mídia' : 'Toque para conversar'}
                        </span>
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <div className="w-5 h-5 rounded-full bg-[#7B3F9E] flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center space-y-3">
                <Lock className="w-8 h-8 text-[#7B3F9E]/40" />
                <p className="text-xs text-gray-500">Nenhuma conversa encontrada</p>
              </div>
            )
          ) : (
            /* Contacts Tab */
            <div className="p-2 space-y-3">
              <AddFriend />
              <FriendRequests />
              <ContactsList onStartChat={startChatWithFriend} />
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ MAIN CHAT PANEL (Visual UDG-002-02) ═══════════ */}
      <div className={`flex-1 h-full flex flex-col relative min-w-0 transition-colors duration-300 ${
        (isMobile && !mobileShowChat) ? 'hidden' : 'flex'
      } ${isDark ? 'bg-[#0A0E14]' : 'bg-[#F8FAFC]'}`}>

        {!selectedConversation ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-[#7B3F9E]/10 flex items-center justify-center text-[#7B3F9E] animate-pulse">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Nenhuma conversa selecionada</h3>
              <p className={`text-[11px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Selecione uma das conversas ativas na barra lateral para iniciar seu chat protegido com criptografia pós-quântica.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ──── Chat Header (UDG-002-02 Collapsible Style) ──── */}
            <div className={`border-b flex-shrink-0 transition-colors duration-300 ${isDark ? 'bg-background border-[#1F2937]' : 'bg-white border-[#E2E8F0]'}`}>
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Mobile Back */}
                  <button onClick={() => { setMobileShowChat(false); selectConversation(null); }} className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition -ml-1 mr-1" title="Voltar">
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={privatePeerProfile?.avatar_url} />
                      <AvatarFallback className={`font-bold text-sm border ${isDark ? 'bg-gradient-to-tr from-slate-700 to-slate-800 text-white' : 'bg-gradient-to-tr from-slate-200 to-slate-300 text-slate-700'}`}>
                        {selectedConvData?.is_group ? <Users className="h-4 w-4" /> : (privatePeerProfile?.username?.[0]?.toUpperCase() || '?')}
                      </AvatarFallback>
                    </Avatar>
                    {peerOnline && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#22C55E] border-2 border-[#0D1117] rounded-full animate-pulse" />}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold flex items-center gap-2">
                      <span className={isDark ? 'text-gray-100' : 'text-slate-800'}>
                        {selectedConvData?.name || privatePeerProfile?.username || "Sala Privada"}
                      </span>
                      {isPrivateChat && privatePeerId && <MoodStatusBadge userId={privatePeerId} />}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {peerOnline ? (
                        <span className="text-[10px] text-emerald-400 font-medium">Online</span>
                      ) : isPeerTyping ? (
                        <span className="text-[10px] text-[#BB86D8] font-medium animate-pulse">Digitando...</span>
                      ) : peerLastSeenLabel ? (
                        <span className="text-[10px] text-gray-500">Visto por último: {peerLastSeenLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Actions dropdown toggle */}
                  <div className="relative">
                    <button
                      onClick={() => setShowActionsMenu(!showActionsMenu)}
                      className={`p-1.5 rounded-lg border transition-all active:scale-95 ${isDark ? 'bg-[#131922] border-[#1F2937] text-muted-foreground hover:text-foreground' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
                      title="Ações"
                    >
                      <Menu className="w-4 h-4" />
                    </button>
                    {showActionsMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                        <div className={`absolute right-0 top-full mt-2 z-50 rounded-xl border shadow-2xl p-2 flex flex-col gap-1 min-w-[220px] ${isDark ? 'bg-background border-[#1F2937]' : 'bg-white border-slate-200'}`}>

                          {/* SaveMode Toggle */}
                          {isPrivateChat && selectedConversation && (
                            <div className={`px-3 py-2.5 rounded-lg ${isDark ? 'hover:bg-[#131922]' : 'hover:bg-slate-50'}`}>
                              <SaveModeToggle conversationId={selectedConversation} currentUserId={user?.id ?? ""} peerId={privatePeerId ?? ""} />
                            </div>
                          )}

                          {/* Auto Translate Toggle */}
                          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${isDark ? 'hover:bg-[#131922]' : 'hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-2">
                              <Languages className="w-4 h-4 text-[#7B3F9E]" />
                              <span className="text-xs font-medium">Tradução auto</span>
                            </div>
                            <Switch checked={autoTranslateEnabled} onCheckedChange={toggleAutoTranslate} />
                          </div>

                          {/* Audio Translate Toggle */}
                          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${isDark ? 'hover:bg-[#131922]' : 'hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-2">
                              <Mic className="w-4 h-4 text-red-400" />
                              <span className="text-xs font-medium">Traduzir Áudio</span>
                            </div>
                            <Switch checked={audioTranslateEnabled} onCheckedChange={toggleAudioTranslate} />
                          </div>

                          {/* Delete conversation */}
                          <button
                            onClick={() => { setShowActionsMenu(false); setShowDeleteModal(true); }}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition w-full text-left text-red-400 ${isDark ? 'hover:bg-[#131922]' : 'hover:bg-slate-50'}`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Excluir conversa</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Collapse/Expand metadata */}
                  <button
                    onClick={() => setMetadataExpanded(!metadataExpanded)}
                    className={`p-1.5 rounded-lg border transition-all active:scale-95 ${isDark ? 'bg-[#131922] border-[#1F2937] text-muted-foreground hover:text-foreground' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'}`}
                    title={metadataExpanded ? 'Recolher detalhes' : 'Expandir detalhes'}
                  >
                    {metadataExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Collapsible metadata row */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${metadataExpanded ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className={`px-4 pb-3 flex items-center flex-wrap gap-2 text-xs text-gray-400 border-t pt-2.5 ${isDark ? 'border-[#1F2937]/50' : 'border-slate-100'}`}>
                  <span className={`py-1 px-2.5 rounded-lg border text-[10px] font-medium flex items-center gap-1 shadow-sm ${isDark ? 'bg-[#131922] border-[#1F2937] text-gray-300' : 'bg-slate-50 border-[#E2E8F0] text-slate-600'}`}>
                    <ShieldCheck className="w-3 h-3 text-[#7B3F9E]" />
                    Criptografia Ativa
                  </span>
                  <span className={`py-1 px-2.5 rounded-lg border text-[10px] font-medium flex items-center gap-1 shadow-sm ${isDark ? 'bg-[#131922] border-[#1F2937] text-gray-300' : 'bg-slate-50 border-[#E2E8F0] text-slate-600'}`}>
                    <Sparkles className="w-3 h-3 text-[#7B3F9E]" />
                    Conexão Direta
                  </span>
                  {autoTranslateEnabled && (
                    <span className={`py-1 px-2.5 rounded-lg border text-[10px] font-medium flex items-center gap-1 shadow-sm ${isDark ? 'bg-[#131922] border-[#1F2937] text-[#BB86D8]' : 'bg-slate-50 border-[#E2E8F0] text-purple-600'}`}>
                      <Languages className="w-3 h-3" />
                      Tradução: {getLanguageName(autoTranslateLang)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ──── Message Area ──── */}
            <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin select-text">
              {/* Encryption notice */}
              <div className={`mx-auto max-w-sm text-center py-2 px-4 border rounded-xl text-[10px] flex items-center justify-center gap-2 shadow-sm ${isDark ? 'bg-[#131922] border-[#1F2937] text-gray-400' : 'bg-white border-slate-200 text-slate-500'}`}>
                <Lock className="w-3.5 h-3.5 text-[#7B3F9E]" />
                <span>As mensagens são criptografadas de ponta a ponta.</span>
              </div>

              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-40 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
                </div>
              ) : messages && messages.length > 0 ? (
                messages.map((msg: any) => {
                  const isOwn = msg.user_id === user?.id;
                  const msgType = getMessageType(msg);
                  const tState = getTranslationState(msg.id);
                  const dState = getDubbingState(msg.id);
                  const speechState = getSpeechState(msg.id);
                  const isInspected = selectedInspectMessage?.id === msg.id;
                  const displayText = tState?.isTranslated && tState.translatedText ? tState.translatedText : msg.content;

                  // Skip deleted messages
                  if (deletedMessages.has(msg.id)) return null;

                  return (
                    <div key={msg.id} className={`flex flex-col relative group max-w-full ${isOwn ? 'items-end' : 'items-start'}`}>

                      {/* Message bubble */}
                      <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div
                          onClick={() => setSelectedInspectMessage(msg)}
                          className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed cursor-pointer transition-all border relative shadow-sm ${
                            isInspected ? 'ring-2 ring-[#7B3F9E] border-[#7B3F9E]' : ''
                          } ${
                            isOwn
                              ? isDark ? 'bg-[#7B3F9E]/20 border-[#7B3F9E]/30 text-gray-100 rounded-tr-none' : 'bg-[#7B3F9E]/10 border-[#7B3F9E]/10 text-slate-900 rounded-tr-none font-medium'
                              : isDark ? 'bg-[#1F2937] border-[#1F2937]/50 text-gray-200 rounded-tl-none' : 'bg-white border-slate-200/80 text-slate-800 rounded-tl-none'
                          }`}
                        >
                          {/* Message content by type */}
                          {msgType === 'text' && (
                            <div>
                              {tState?.isLoading && (
                                <div className="text-[10px] text-[#BB86D8] mb-1 animate-pulse flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Traduzindo...
                                </div>
                              )}
                              <p><MentionText text={displayText || ''} /></p>
                              {tState?.isTranslated && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-[#BB86D8]">
                                  <Languages className="w-3 h-3" />
                                  <span>Traduzido para {getLanguageName(tState.targetLang)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {msgType === 'audio' && (
                            <div className="space-y-1.5">
                              {dState?.isLoading && <div className="text-[10px] text-[#BB86D8] mb-1 animate-pulse flex items-center gap-1"><Mic className="h-3 w-3" /> Dublando áudio com a voz original...</div>}

                              {/* Original audio */}
                              {msg.media_urls?.[0] && (
                                <CustomAudioPlayer audioUrl={msg.media_urls[0]} isOwn={isOwn} onPlay={() => {}} />
                              )}

                              {/* Dubbed audio */}
                              {dState?.dubbedAudioUrl && (
                                <div className="mt-1">
                                  <div className="text-[9px] text-[#BB86D8] mb-0.5 flex items-center gap-1"><Languages className="w-3 h-3" /> Áudio traduzido</div>
                                  <CustomAudioPlayer audioUrl={dState.dubbedAudioUrl} isOwn={isOwn} onPlay={() => {}} />
                                </div>
                              )}

                              {/* Transcription */}
                              {dState?.translatedText && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDubbingStates(prev => prev.map(d => d.messageId === msg.id ? { ...d, showTranscription: !d.showTranscription } : d)); }}
                                  className="text-[9px] text-[#BB86D8] underline mt-1"
                                >
                                  {dState.showTranscription ? 'Ocultar transcrição' : 'Ver transcrição'}
                                </button>
                              )}
                              {dState?.showTranscription && dState.translatedText && (
                                <div className={`mt-1 p-2 rounded-lg text-[10px] border ${isDark ? 'bg-[#131922] border-[#1F2937] text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                  {dState.originalText && <p className="text-gray-500 mb-1">Original: {dState.originalText}</p>}
                                  <p>Traduzido: {dState.translatedText}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {msgType === 'media' && msg.media_urls && (
                            <div className="space-y-2">
                              {msg.media_urls.map((url: string, idx: number) => (
                                url.includes('.mp4') || url.includes('.mov') || url.includes('video_') ? (
                                  <video key={idx} src={url} controls className="rounded-lg max-w-full max-h-60" />
                                ) : (
                                  <img key={idx} src={url} alt="mídia" className="rounded-lg max-w-full max-h-60 cursor-pointer" loading="lazy" />
                                )
                              ))}
                            </div>
                          )}

                          {msgType === 'sticker' && (
                            <div className="text-3xl">
                              {msg.content?.startsWith('__sticker_emoji__')
                                ? msg.content.replace('__sticker_emoji__', '')
                                : msg.media_urls?.[0]
                                  ? <img src={msg.media_urls[0]} alt="sticker" className="w-24 h-24 object-contain" />
                                  : '🧩'}
                            </div>
                          )}

                          {/* Timestamp and status */}
                          <div className={`flex items-center justify-end gap-1.5 mt-1.5 text-[9px] select-none ${isOwn && !isDark ? 'text-slate-600' : 'text-gray-400'}`}>
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOwn ? (
                              <div className="flex items-center">
                                {msg.viewed_at ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#7B3F9E] drop-shadow-[0_0_4px_rgba(123,63,158,0.6)]" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-gray-400" />
                                )}
                              </div>
                            ) : (
                              <Lock className="w-3 h-3 text-emerald-500/80" />
                            )}
                          </div>
                        </div>

                        {/* Action buttons (on hover) */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Translate button */}
                          {msgType === 'text' && !isOwn && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(msg.id); }}
                              className={`p-1 rounded-full border transition-all hover:scale-105 active:scale-95 ${isDark ? 'bg-[#131922] border-[#1F2937] text-gray-400' : 'bg-white border-slate-200 text-slate-500'}`}
                              title="Traduzir"
                            >
                              <Languages className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* TTS button */}
                          {msgType === 'text' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (speechState?.isSpeaking) { stopSpeech(msg.id); }
                                else {
                                  const textToSpeak = tState?.isTranslated ? tState.translatedText : msg.content;
                                  const lang = tState?.isTranslated ? tState.targetLang : 'pt';
                                  speakText(textToSpeak, msg.id, lang);
                                }
                              }}
                              className={`p-1 rounded-full border transition-all hover:scale-105 active:scale-95 ${isDark ? 'bg-[#131922] border-[#1F2937] text-gray-400' : 'bg-white border-slate-200 text-slate-500'}`}
                              title={speechState?.isSpeaking ? "Parar leitura" : "Ouvir mensagem"}
                            >
                              {speechState?.isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center space-y-3">
                  <MessageCircle className="w-8 h-8 text-[#7B3F9E]/30" />
                  <p className="text-xs text-gray-500">Nenhuma mensagem ainda. Diga olá!</p>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />

              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button
                  onClick={() => scrollToBottom(false)}
                  className="fixed bottom-24 right-8 z-30 p-2.5 rounded-full bg-[#7B3F9E] text-white shadow-lg hover:bg-[#9B59B6] transition-all animate-in fade-in"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* ──── Input Bar (UDG-002-02 Style) ──── */}
            <div className={`p-3 border-t flex-shrink-0 transition-colors duration-300 ${isDark ? 'bg-background border-[#1F2937]' : 'bg-white border-[#E2E8F0]'}`}>
              <MessageInput
                onSendMessage={handleSendMessage}
                onMediaReady={handleMediaUpload}
                onAudioReady={handleAudioUpload}
                onTypingChange={handleTypingChange}
              />
            </div>
          </>
        )}
      </div>

      {/* ═══════════ INSPECTOR PANEL (UDG-002-02 Style) ═══════════ */}
      <div className={`border-l flex flex-col transition-all overflow-y-auto duration-300 hidden md:flex ${
        selectedInspectMessage ? 'w-80' : 'w-0 border-l-0 overflow-hidden'
      } ${isDark ? 'bg-background border-[#1F2937]' : 'bg-white border-[#E2E8F0]'}`}>
        {selectedInspectMessage && (
          <div className="p-5 space-y-4">
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? 'border-[#1F2937]' : 'border-[#E2E8F0]'}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[#7B3F9E]" />
                <span>Detalhes do Envio</span>
              </h4>
              <button onClick={() => setSelectedInspectMessage(null)} className="text-xs text-gray-400 hover:text-red-500 transition">Fechar</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className={`p-3.5 border rounded-xl flex items-start gap-2.5 ${isDark ? 'bg-[#131922] border-[#1F2937]' : 'bg-slate-50 border-slate-200'}`}>
                <ShieldCheck className="w-5 h-5 text-[#7B3F9E] flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold">Proteção Garantida</h5>
                  <p className="text-[10px] text-gray-400 mt-0.5">Esta mensagem foi enviada de forma criptografada. Ninguém fora do chat tem acesso.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[9px] text-gray-500 uppercase font-bold block">Remetente</span>
                  <p className="text-[10px] mt-0.5">{selectedInspectMessage.profiles?.username || selectedInspectMessage.user_id}</p>
                </div>
                <div>
                  <span className="text-[9px] text-gray-500 uppercase font-bold block">Horário do Envio</span>
                  <p className="text-[10px] mt-0.5">{new Date(selectedInspectMessage.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[9px] text-gray-500 uppercase font-bold block">Status</span>
                  <p className="text-[10px] mt-0.5 text-[#7B3F9E] font-semibold flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5 inline" />
                    {selectedInspectMessage.viewed_at ? 'Entregue e Confirmada' : 'Enviada'}
                  </p>
                </div>
                {/* Translation info */}
                {(() => {
                  const t = getTranslationState(selectedInspectMessage.id);
                  if (!t?.isTranslated) return null;
                  return (
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase font-bold block">Tradução</span>
                      <p className="text-[10px] mt-0.5 text-[#BB86D8]">
                        {getLanguageName(t.sourceLang || 'auto')} → {getLanguageName(t.targetLang)}
                      </p>
                      <p className="text-[10px] mt-1 text-gray-400 italic">{t.translatedText}</p>
                    </div>
                  );
                })()}
                {/* Dubbing info */}
                {(() => {
                  const d = getDubbingState(selectedInspectMessage.id);
                  if (!d?.translatedText) return null;
                  return (
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase font-bold block">Dublagem</span>
                      <p className="text-[10px] mt-0.5 text-[#BB86D8]">
                        {d.sourceLang || '?'} → {autoTranslateLang}
                      </p>
                      {d.originalText && <p className="text-[10px] mt-0.5 text-gray-500">Original: {d.originalText}</p>}
                      <p className="text-[10px] mt-0.5 text-gray-400 italic">{d.translatedText}</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Conversation Modal */}
      {showDeleteModal && selectedConversation && (
        <DeleteConversationModal
          conversationId={selectedConversation}
          currentUserId={user?.id ?? ""}
          messages={[]}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => { selectConversation(null); setMobileShowChat(false); refetchConversations(); }}
        />
      )}
    </div>
  );
}
