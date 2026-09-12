/**
 * =============================================================================
 * File: src/pages/Arena.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Heart, MessageCircle, Send, MoreVertical, Bomb, Trash2,
  Video, Minimize2, Images, Play, Pause,
  Clock, Loader2, Flame,
  Zap as FlashIcon,
  Film, ArrowLeft,
  CheckCircle, XCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MovementStatusBadge } from "@/components/movement/MovementStatusBadge";
import { MoodStatusBadge } from "@/components/mood/MoodStatusBadge";
import { ArenaPolls } from "@/components/arena/ArenaPolls";
import { PostMediaCarousel } from "@/components/feed/PostMediaCarousel";
import { UserLink } from "@/components/UserLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import NewMentionTextarea from "@/components/ui/new-mention-textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ShareDialog } from "@/components/ShareDialog";
import { MentionText } from "@/components/MentionText";
import { CommentItem, CommentType } from "@/components/feed/CommentItem";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation, useNavigate } from "react-router-dom";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

/* ---------- HOOK: useMediaQuery ---------- */
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);

  return matches;
};

/* ---------- COMPONENTE: Imagem Progressiva ---------- */
const ProgressiveImage = ({ src, alt, className, onClick }: { src: string, alt: string, className?: string, onClick?: () => void }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isValidSrc = src && (src.startsWith('http') || src.startsWith('blob') || src.startsWith('data') || src.includes('supabase'));

  if (!isValidSrc || hasError) {
    return (
      <div className={cn("flex items-center justify-center bg-muted/30 rounded-lg", className)}>
        <div className="text-center p-4">
          <Images className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Mídia não disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted/30 rounded-lg", className)} onClick={onClick}>
      <img
        src={src}
        alt={alt}
        className={cn(
          "absolute inset-0 w-full h-full object-cover filter blur-xl scale-110 transition-opacity duration-700",
          isLoaded ? "opacity-0" : "opacity-100"
        )}
        aria-hidden="true"
        onError={() => setHasError(true)}
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(
          "relative w-full h-full object-cover transition-all duration-700 rounded-lg",
          isLoaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-sm scale-105"
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

/* ---------- COMPONENTE: VideoPlayer com Controles Aprimorados ---------- */
interface VideoPlayerProps {
  src: string;
  className?: string;
  videoId: string;
  playingVideo: string | null;
  muted: boolean;
  registerVideo: (id: string, el: HTMLVideoElement) => void;
  unregisterVideo: (id: string) => void;
  playVideo: (id: string) => void;
  pauseVideo: (id: string) => void;
  toggleMute: () => void;
}

const VideoPlayer = ({
  src,
  className,
  videoId,
  playingVideo,
  muted,
  registerVideo,
  unregisterVideo,
  playVideo,
  pauseVideo,
  toggleMute
}: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const isPlaying = playingVideo === videoId;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      registerVideo(videoId, videoRef.current);
    }
    return () => {
      unregisterVideo(videoId);
    };
  }, [videoId, registerVideo, unregisterVideo]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.loop = isLooping;
    }
  }, [muted, isLooping]);

  const handleVideoClick = () => {
    // Rely on native controls for play/pause instead of taking over click
  };

  const toggleLoop = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLooping(!isLooping);
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (!isPlaying) {
        playVideo(videoId);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && isPlaying) {
            pauseVideo(videoId);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);

    return () => {
      observer.unobserve(container);
    };
  }, [isPlaying, videoId, pauseVideo]);

  if (hasError || !src) {
    return (
      <div className={cn("flex items-center justify-center bg-black rounded-lg", className)}>
        <div className="text-center p-4">
          <Video className="h-8 w-8 text-white/50 mx-auto" />
          <p className="text-xs text-white/70 mt-2">Vídeo não disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative group rounded-lg bg-black overflow-hidden"
    >
      <video
        ref={videoRef}
        data-video-id={videoId}
        src={src}
        controls
        className={cn("w-full h-full object-contain rounded-lg", className)}
        playsInline
        preload="metadata"
        loop={isLooping}
        onPlay={() => playVideo(videoId)}
        onPause={() => pauseVideo(videoId)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

/* ---------- COMPONENTE: Timer de Votação ---------- */
const VotingCountdown = ({ endsAt, onExpire }: { endsAt: string; onExpire?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(endsAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft("Encerrado");
        if (onExpire) onExpire();
        return;
      }

      // Relógio digital (HH:MM) — sem segundos
      const totalMinutes = Math.max(0, Math.ceil(diff / (1000 * 60)));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setTimeLeft(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`);
    };

    calculateTime();
    // Não precisa atualizar a cada segundo (já que não mostramos segundos)
    const interval = setInterval(calculateTime, 15000);
    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  if (isExpired) return (
    <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
      <Clock className="h-3 w-3 mr-1" />
      Encerrado
    </Badge>
  );

  return (
    <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs border-0">
      <Clock className="h-3 w-3 mr-1" />
      <span>{timeLeft}</span>
    </Badge>
  );
};

/* ---------- Utils: tempo restante (para compartilhamento) ---------- */
const getTimeLeftText = (endsAt?: string | null) => {
  if (!endsAt) return "tempo indisponível";
  const now = Date.now();
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (!Number.isFinite(end) || diff <= 0) return "Encerrado";
  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin}m`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

/* ---------- COMPONENTE: Player de Áudio com Controle de Scroll ---------- */
interface AudioPlayerProps {
  src: string;
  isPlaying: boolean;
  onPlayPause: (audioUrl: string) => void;
  audioUrl: string;
}

const AudioPlayer = ({ src, isPlaying, onPlayPause, audioUrl }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isPlaying) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && isPlaying) {
            onPlayPause(audioUrl);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);

    return () => {
      observer.unobserve(container);
    };
  }, [isPlaying, audioUrl, onPlayPause]);

  const handlePlayPause = () => {
    onPlayPause(audioUrl);
  };

  return (
    <div ref={containerRef} className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon"
        onClick={handlePlayPause}
        className={cn(
          "rounded-full transition-all",
          isPlaying ? "bg-primary text-primary-foreground scale-110" : "bg-muted"
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </Button>
      <span className="text-xs text-muted-foreground">
        {isPlaying ? "Tocando..." : "Clique para ouvir"}
      </span>
    </div>
  );
};

/* ---------- COMPONENTE: Estatísticas da Arena ---------- */
type ArenaStatsData = {
  total_approved: number;
  total_rejected: number;
  total_in_voting: number;
  total_processed: number;
  last_updated?: string | null;
  source?: "session" | "arena_stats" | "computed" | "default";
};

const ArenaStatsCards = ({ stats }: { stats: ArenaStatsData }) => {
  const [approved, setApproved] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [inVoting, setInVoting] = useState(0);

  const targetApproved = stats?.total_approved ?? 0;
  const targetRejected = stats?.total_rejected ?? 0;
  const targetInVoting = stats?.total_in_voting ?? 0;

  useEffect(() => {
    const animateCounter = (target: number, setter: React.Dispatch<React.SetStateAction<number>>) => {
      const safeTarget = Number.isFinite(target) ? Math.max(0, Math.floor(target)) : 0;
      let current = 0;
      const steps = 20;
      const increment = safeTarget / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= safeTarget) {
          current = safeTarget;
          clearInterval(timer);
        }
        setter(Math.floor(current));
      }, 30);

      return () => clearInterval(timer);
    };

    const stopA = animateCounter(targetApproved, setApproved);
    const stopR = animateCounter(targetRejected, setRejected);
    const stopV = animateCounter(targetInVoting, setInVoting);

    return () => {
      stopA?.();
      stopR?.();
      stopV?.();
    };
  }, [targetApproved, targetRejected, targetInVoting]);

  const totalDisplayed = approved + rejected + inVoting;
  const approvedPct = totalDisplayed > 0 ? (approved / totalDisplayed) * 100 : 0;
  const rejectedPct = totalDisplayed > 0 ? (rejected / totalDisplayed) * 100 : 0;
  const inVotingPct = totalDisplayed > 0 ? (inVoting / totalDisplayed) * 100 : 0;

  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 p-6 rounded-xl border border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-400 mb-2">Aprovados</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-500">{approved}</span>
              <span className="text-sm text-emerald-400/70">posts</span>
            </div>
          </div>
          <div className="bg-emerald-500/20 p-3 rounded-full">
            <CheckCircle className="h-6 w-6 text-emerald-400" />
          </div>
        </div>
        <div className="mt-3 h-2 bg-emerald-500/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-1000"
            style={{ width: `${approvedPct}%` }}
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 p-6 rounded-xl border border-red-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-red-400 mb-2">Rejeitados</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-red-500">{rejected}</span>
              <span className="text-sm text-red-400/70">posts</span>
            </div>
          </div>
          <div className="bg-red-500/20 p-3 rounded-full">
            <XCircle className="h-6 w-6 text-red-400" />
          </div>
        </div>
        <div className="mt-3 h-2 bg-red-500/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-pink-500 rounded-full transition-all duration-1000"
            style={{ width: `${rejectedPct}%` }}
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 p-6 rounded-xl border border-orange-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-orange-400 mb-2">Em Votação</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-orange-500">{inVoting}</span>
              <span className="text-sm text-orange-400/70">ativos</span>
            </div>
          </div>
          <div className="bg-orange-500/20 p-3 rounded-full">
            <Flame className="h-6 w-6 text-orange-400" />
          </div>
        </div>
        <div className="mt-3 h-2 bg-orange-500/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-1000"
            style={{ width: `${inVotingPct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/* ---------- Helpers ---------- */
const stripPrefix = (u: any): string => {
  if (!u || typeof u !== 'string') return '';
  return u.replace(/^(image::|video::|audio::)/, "");
};

const isVideoUrl = (u: any): boolean => {
  if (!u || typeof u !== 'string') return false;

  const cleanUrl = stripPrefix(u);
  const videoExtensions = /\.(mp4|webm|ogg|mov|m4v|avi|mkv|flv|wmv)$/i;
  return u.startsWith('video::') || videoExtensions.test(cleanUrl);
};

const isAudioUrl = (u: any): boolean => {
  if (!u || typeof u !== 'string') return false;
  const cleanUrl = stripPrefix(u);
  const audioExtensions = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;
  return u.startsWith('audio::') || audioExtensions.test(cleanUrl);
};

/* ---------- Hook para Controle de Vídeo com Scroll ---------- */
const useVideoAutoPlayer = () => {
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const playVideo = useCallback(async (videoId: string) => {
    const video = videoRefs.current.get(videoId);
    if (video && playingVideo !== videoId) {
      try {
        if (playingVideo) {
          const currentVideo = videoRefs.current.get(playingVideo);
          if (currentVideo) {
            currentVideo.pause();
          }
        }

        setPlayingVideo(videoId);
        await video.play();
      } catch (e) {
        console.error("Erro ao reproduzir vídeo:", e);
      }
    }
  }, [playingVideo, muted]);

  const pauseVideo = useCallback((videoId: string) => {
    if (playingVideo === videoId) {
      const video = videoRefs.current.get(videoId);
      if (video) {
        video.pause();
        setPlayingVideo(null);
      }
    }
  }, [playingVideo]);

  const toggleMute = useCallback(() => {
    setMuted(prev => !prev);
  }, [playingVideo, muted]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const videoId = entry.target.getAttribute('data-video-id');
        if (!videoId) return;

        if (entry.isIntersecting) {
          // Aguardar clique do usuário
        } else if (playingVideo === videoId) {
          pauseVideo(videoId);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px'
    });

    return () => observerRef.current?.disconnect();
  }, [pauseVideo, playingVideo]);

  const registerVideo = useCallback((id: string, el: HTMLVideoElement) => {
    videoRefs.current.set(id, el);
    observerRef.current?.observe(el);
  }, []);

  const unregisterVideo = useCallback((id: string) => {
    const v = videoRefs.current.get(id);
    if (v) observerRef.current?.unobserve(v);
    videoRefs.current.delete(id);
  }, []);

  return {
    playingVideo,
    muted,
    playVideo,
    pauseVideo,
    toggleMute,
    registerVideo,
    unregisterVideo
  };
};

/* ---------- COMPONENT PRINCIPAL ---------- */
export default function Arena() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");

  /* States */
  const [openingCommentsFor, setOpeningCommentsFor] = useState<PostRow | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<{ id: string; username: string } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const [shareHelpOpen, setShareHelpOpen] = useState(false);
  const [shareHelpPost, setShareHelpPost] = useState<any | null>(null);
  const [highlightPostId, setHighlightPostId] = useState<string | null>(null);

  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Contadores locais (sessão) - começam zerados e vão incrementando automaticamente
  const [sessionApproved, setSessionApproved] = useState(0);
  const [sessionRejected, setSessionRejected] = useState(0);

  // Snapshot para detectar posts que saíram da Arena (votação encerrada)
  const prevVotingSnapshotRef = useRef<Map<string, { heart: number; bomb: number; endsAt: string | null }>>(new Map());
  const processedSnapshotIdsRef = useRef<Set<string>>(new Set());
  const [postsFetchOk, setPostsFetchOk] = useState(true);

  const {
    playingVideo,
    muted,
    playVideo,
    pauseVideo,
    toggleMute,
    registerVideo,
    unregisterVideo
  } = useVideoAutoPlayer();

  /* Data */
  useEffect(() => {
    if (!user) return;
    supabase.from("last_viewed").upsert({
      user_id: user.id,
      section: "arena",
      viewed_at: new Date().toISOString()
    }, {
      onConflict: "user_id,section"
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["unread-arena", user.id] });
    });
  }, [user, queryClient]);

  // Resetar contadores quando trocar de usuário/logar novamente
  useEffect(() => {
    setSessionApproved(0);
    setSessionRejected(0);
    prevVotingSnapshotRef.current.clear();
    processedSnapshotIdsRef.current.clear();
  }, [user?.id]);

  const { data: posts, refetch, isLoading, isError: postsIsError } = useQuery<PostRow[]>({
    // IMPORTANT:
    // Não reutilizar a mesma queryKey do Feed ("posts") porque o React Query pode
    // servir dados de cache do Feed ao entrar na Arena, exibindo posts já encerrados
    // até o refetch acontecer. Mantemos uma key exclusiva para a Arena.
    queryKey: ["arena-posts", user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("posts")
          .select(`
            *,
            profiles:user_id (
              id,
              username,
              avatar_url,
              full_name,
              movement_status_enabled,
              movement_status,
              mood_status_enabled,
              current_mood,
              current_mood_emoji,
              mood_public
            ),
            likes (id, user_id),
            comments (id),
            post_votes (id, user_id, vote_type)
          `)
          .eq("is_community_approved", false)
          .eq("voting_period_active", true) // Só buscar posts ativos em votação
          .neq("post_type", "photo_audio")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao buscar posts:", error);
          throw error;
        }

        const processedData = (data || []).map(post => {
          let mediaUrls = [];

          if (post.media_urls && Array.isArray(post.media_urls)) {
            mediaUrls = post.media_urls
              .filter((url: any) => url && typeof url === 'string')
              .map((url: string) => url.trim())
              .filter((url: string) => url.length > 0);
          }

          return {
            ...post,
            media_urls: mediaUrls
          };
        });

        // Defesa extra: mesmo com voting_period_active=true, alguns posts podem ter
        // voting_ends_at já passado (delay de atualização/trigger). Não exibimos na Arena.
        const nowMs = Date.now();
        const filtered = processedData.filter((p: any) => {
          const endsAt = (p as any).voting_ends_at as string | null | undefined;
          if (!endsAt) return true;
          const ms = new Date(endsAt).getTime();
          return Number.isFinite(ms) ? ms > nowMs : true;
        });

        return filtered as PostRow[];
      } catch (error) {
        console.error("Erro na query de posts:", error);
        throw error;
      }
    },
    enabled: !!user,
    // Sempre revalidar quando o usuário entra na Arena (evita mostrar posts já encerrados)
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always" as any,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isLoading) setPostsFetchOk(!postsIsError);
  }, [isLoading, postsIsError]);

  // Recarregar dados sempre que o usuário navegar para esta rota.
  // (Ex.: usuário veio do Feed e abriu a Arena pelo menu)
  useEffect(() => {
    if (!user) return;
    // Invalida e força refetch para garantir lista 100% atualizada.
    queryClient.invalidateQueries({ queryKey: ["arena-posts", user.id] });
    refetch();
  }, [location.pathname, user?.id]);

  // Deep link para um post específico: /arena#post-<ID>
  // Quando abrir a Arena com hash, rola até o post e aplica highlight temporário.
  useEffect(() => {
    if (!posts || posts.length === 0) return;
    const hash = location.hash;
    if (!hash) return;
    const domId = hash.replace("#", "");
    if (!domId.startsWith("post-")) return;

    // Aguarda o DOM renderizar os cards
    requestAnimationFrame(() => {
      const el = document.getElementById(domId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });

      const postId = domId.replace("post-", "");
      setHighlightPostId(postId);
      window.setTimeout(() => setHighlightPostId(null), 2500);
    });
  }, [posts, location.hash]);

  /* ---------- Estatísticas globais (arena_stats) ---------- */
  const { data: arenaTotals, refetch: refetchArenaTotals } = useQuery({
    queryKey: ["arena-total-stats"],
    enabled: !!user,
    staleTime: 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    queryFn: async () => {
      // 1) Último snapshot salvo em arena_stats (aprovados/rejeitados/processados)
      const { data: row, error } = await supabase
        .from("arena_stats")
        .select("total_approved,total_rejected,total_processed,last_updated")
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("Erro ao buscar arena_stats:", error);
      }

      const approved = Number((row as any)?.total_approved) || 0;
      const rejected = Number((row as any)?.total_rejected) || 0;
      const processed = Number((row as any)?.total_processed) || (approved + rejected);
      const lastUpdated = ((row as any)?.last_updated as string | null) || null;

      // 2) Contagem em votação (computada direto da tabela posts)
      // Filtramos para ignorar posts do tipo 'photo_audio' conforme solicitado (retirar informação sobre flash)
      const { count: inVotingCount, error: countErr } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("voting_period_active", true)
        .eq("is_community_approved", false)
        .neq("post_type", "photo_audio");

      if (countErr) {
        console.warn("Erro ao contar posts em votação:", countErr);
      }

      return {
        approved,
        rejected,
        processed,
        inVoting: inVotingCount || 0,
        last_updated: lastUpdated,
      };
    },
  });

  // Atualiza contadores locais quando um post sai da Arena (votação encerrada)
  useEffect(() => {
    if (!postsFetchOk) return;

    const currentIds = new Set((posts ?? []).map((p: any) => p.id));

    // Posts que estavam antes e não estão mais agora => votação encerrou (ou foi removido)
    for (const [postId, snap] of prevVotingSnapshotRef.current.entries()) {
      if (currentIds.has(postId)) continue;
      if (processedSnapshotIdsRef.current.has(postId)) continue;

      const endsAtMs = snap.endsAt ? new Date(snap.endsAt).getTime() : null;
      const nowMs = Date.now();

      // Só conta como resultado se a votação realmente venceu
      if (endsAtMs && endsAtMs <= nowMs) {
        processedSnapshotIdsRef.current.add(postId);

        // CORREÇÃO DA LÓGICA DE VOTAÇÃO: Empate deve reprovar
        // Se heartCount > bombCount: aprova
        // Se heartCount <= bombCount: reprova (inclui empate)
        if (snap.heart > snap.bomb) {
          setSessionApproved((v) => v + 1);
        } else {
          setSessionRejected((v) => v + 1);
        }
      }
    }

    // Atualiza snapshot atual
    const next = new Map<string, { heart: number; bomb: number; endsAt: string | null }>();
    for (const p of posts ?? []) {
      const heart = (p as any).post_votes?.filter((v: any) => v.vote_type === "heart").length ?? 0;
      const bomb = (p as any).post_votes?.filter((v: any) => v.vote_type === "bomb").length ?? 0;
      const endsAt = (p as any).voting_ends_at ?? null;
      next.set((p as any).id, { heart, bomb, endsAt });
    }
    prevVotingSnapshotRef.current = next;
  }, [posts, postsFetchOk]);

  // Auto-refresh a cada 30 segundos (fallback caso realtime falhe)
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
      refetchArenaTotals();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch, refetchArenaTotals]);

  // CORRECAO: os callbacks liam `user.id` sem `?.` e o efeito nao dependia de
  // `user`. Abrindo a Arena com a sessao ainda carregando, o canal era criado
  // com user = null e NUNCA recriado; cada voto/post recebido lancava
  // "Cannot read properties of null" e a lista parava de atualizar sozinha.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`arena-realtime-${userId}-${Date.now()}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["arena-posts", userId] });
          queryClient.invalidateQueries({ queryKey: ["arena-total-stats"] });
        }
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "post_votes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["arena-posts", userId] });
          queryClient.invalidateQueries({ queryKey: ["arena-total-stats"] });
        }
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "arena_stats" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["arena-total-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refetch, queryClient, refetchArenaTotals]);

  // Atualizar/fechar votações periodicamente (Edge Function)
  useEffect(() => {
    const f = async () => {
      try {
        await supabase.functions.invoke("process-votes");
        await refetch();
        refetchArenaTotals();
      } catch (e) {
        console.error("Erro ao processar votos:", e);
      }
    };
    const i = setInterval(f, 30000); // A cada 30 segundos
    f(); // Executar imediatamente
    return () => clearInterval(i);
  }, [refetch, refetchArenaTotals]);

  /* Handlers */
  const handleLike = async (postId: string) => {
    try {
      const post = posts?.find(p => p.id === postId);
      if (!post) return;

      const hasLiked = post.likes?.some((l: any) => l.user_id === user?.id);

      if (hasLiked) {
        const likeToRemove = post.likes.find((l: any) => l.user_id === user?.id);
        if (likeToRemove) {
          await supabase.from("likes").delete().eq("id", likeToRemove.id);
        }
      } else {
        await supabase.from("likes").insert({
          post_id: postId,
          user_id: user?.id
        });
      }

      refetch();
    } catch (error) {
      console.error("Erro ao curtir:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível curtir o post"
      });
    }
  };

  const handleVote = async (postId: string, type: "heart" | "bomb") => {
    try {
      const post = posts?.find(p => p.id === postId);
      if (!post) return;
      if (post.user_id === user?.id) {
        toast({
          variant: "destructive",
          title: "Ação não permitida",
          description: "Você não pode votar na sua própria publicação."
        });
        return;
      }

      const has = posts?.find(p => p.id === postId)?.post_votes?.find((v: any) => v.user_id === user?.id);
      // CORRECAO: o erro do supabase-js vem em { error }, nao por excecao —
      // um voto recusado passava como sucesso e o usuario achava que votou.
      let voteError: any = null;
      if (has?.vote_type === type) {
        ({ error: voteError } = await supabase.from("post_votes").delete().match({ post_id: postId, user_id: user?.id }));
      } else if (has) {
        ({ error: voteError } = await supabase.from("post_votes").update({ vote_type: type }).match({ post_id: postId, user_id: user?.id }));
      } else {
        ({ error: voteError } = await supabase.from("post_votes").insert({ post_id: postId, user_id: user?.id, vote_type: type }));
      }
      if (voteError) throw voteError;
      refetch();
    } catch (error) {
      console.error("Erro ao votar:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível registrar seu voto"
      });
    }
  };

  const handleShareHelp = async (post: any) => {
    // Abre o mesmo modal de compartilhamento usado no Feed, porém com texto de "Ajuda"
    setShareHelpPost(post);
    setShareHelpOpen(true);
  };

  const handleAudioPlayPause = (audioUrl: string) => {
    if (playingAudio === audioUrl) {
      if (audioRef.current) {
        audioRef.current.pause();
        setPlayingAudio(null);
        audioRef.current = null;
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const cleanUrl = stripPrefix(audioUrl);
      const audio = new Audio(cleanUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingAudio(null);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingAudio(null);
        audioRef.current = null;
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível reproduzir o áudio"
        });
      };

      audio.play().catch(error => {
        console.error("Erro ao reproduzir áudio:", error);
        setPlayingAudio(null);
        audioRef.current = null;
      });

      setPlayingAudio(audioUrl);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // CORRECAO: o supabase-js devolve { error } em vez de lancar. Sem esta
      // checagem, uma exclusao barrada por RLS caia em onSuccess e mostrava
      // "Post excluido com sucesso" — e o post voltava no refetch.
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Post excluído com sucesso" });
      refetch();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message
      });
    }
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (openingCommentsFor && newCommentText.trim()) {
        const insertData: any = {
          post_id: openingCommentsFor.id,
          user_id: user!.id,
          content: newCommentText.trim()
        };

        if (replyingToComment) {
          insertData.parent_id = replyingToComment.id;
        }

        const { data: comment, error } = await supabase
          .from("comments")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        try {
          const { saveMentions } = await import("@/utils/mentionsHelper");
          await saveMentions(comment.id, "comment", newCommentText.trim(), user!.id);
        } catch (mentionError) {
          console.warn("Erro ao salvar menções do comentário:", mentionError);
        }

        return comment;
      }
    },
    onSuccess: () => {
      setNewCommentText("");
      setReplyingToComment(null);
      queryClient.invalidateQueries({ queryKey: ["post-comments"] });
      refetch();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao comentar",
        description: error.message
      });
    }
  });

  const renderMedia = (post: any) => {
    if (!post.media_urls || !Array.isArray(post.media_urls) || post.media_urls.length === 0) {
      return null;
    }

    const validMediaUrls = post.media_urls
      .filter((url: string) => {
        if (!url || typeof url !== 'string') return false;
        const cleanUrl = stripPrefix(url);
        return cleanUrl && cleanUrl.length > 0;
      });

    if (validMediaUrls.length === 0) return null;

    // Single video — use VideoPlayer with full controls
    if (validMediaUrls.length === 1 && isVideoUrl(validMediaUrls[0])) {
      const mediaUrl = stripPrefix(validMediaUrls[0]);
      const videoId = `${post.id}-0`;
      return (
        <div className="mb-3 rounded-lg overflow-hidden">
          <VideoPlayer
            src={mediaUrl}
            className="w-full max-h-96 rounded-lg"
            videoId={videoId}
            playingVideo={playingVideo}
            muted={muted}
            registerVideo={registerVideo}
            unregisterVideo={unregisterVideo}
            playVideo={playVideo}
            pauseVideo={pauseVideo}
            toggleMute={toggleMute}
          />
        </div>
      );
    }

    // Photos or mixed — use carousel
    return (
      <PostMediaCarousel
        urls={validMediaUrls}
        postId={post.id}
        onImageClick={(url) => {
          setViewerUrl(url);
          setViewerOpen(true);
        }}
      />
    );
  };

  const { data: rawComments, isLoading: loadingComments } = useQuery({
    queryKey: ["post-comments", openingCommentsFor?.id],
    enabled: !!openingCommentsFor,
    queryFn: async () => {
      if (!openingCommentsFor) return [];

      const { data, error } = await supabase
        .from("comments")
        .select(`
          *, 
          author:profiles!comments_user_id_fkey(username, avatar_url),
          comment_likes(user_id)
        `)
        .eq("post_id", openingCommentsFor.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao buscar comentários:", error);
        return [];
      }

      // Mapeamento correto para se encaixar na tipagem ComponentItem
      return (data || []).map((c: any) => ({
        ...c,
        profiles: c.author // Arena usa alias 'author', padronizando para 'profiles'
      }));
    }
  });

  const comments = useMemo(() => {
    if (!rawComments) return [];
    const commentMap = new Map<string, CommentType>();
    const roots: CommentType[] = [];

    rawComments.forEach((c: any) => {
      commentMap.set(c.id, { ...c, replies: [] });
    });

    rawComments.forEach((c: any) => {
      if (c.parent_id && commentMap.has(c.parent_id)) {
        commentMap.get(c.parent_id)!.replies!.push(commentMap.get(c.id)!);
      } else {
        roots.push(commentMap.get(c.id)!);
      }
    });

    return roots;
  }, [rawComments]);

  const flashPosts = posts?.filter(x => x.post_type === 'photo_audio') || [];
  const clipsPosts = posts?.filter(x => x.post_type === 'viral_clips') || [];
  const standardPosts = posts?.filter(x => x.post_type === 'standard') || [];

  // Estatísticas (apenas World Flash + World Flow), com totais consistentes por tipo
  const worldStats = useMemo(() => {
    const countVotes = (arr: any[]) =>
      (arr ?? []).reduce((sum: number, p: any) => sum + (((p as any)?.post_votes?.length) ?? 0), 0);

    const worldFlashCount = clipsPosts.length;
    const worldFlowCount = standardPosts.length;
    const worldFlashVotes = countVotes(clipsPosts);
    const worldFlowVotes = countVotes(standardPosts);

    return {
      worldFlashCount,
      worldFlowCount,
      totalCount: worldFlashCount + worldFlowCount,
      worldFlashVotes,
      worldFlowVotes,
      totalVotes: worldFlashVotes + worldFlowVotes,
    };
  }, [clipsPosts, standardPosts]);


  const safeStats: ArenaStatsData = {
    total_approved: arenaTotals?.approved ?? 0,
    total_rejected: arenaTotals?.rejected ?? 0,
    // Estatística de "Em votação" alinhada ao que é exibido no topo (World Flash + World Flow)
    // (não inclui posts do tipo "Flash")
    total_in_voting: worldStats.totalCount as number,
    total_processed:
      arenaTotals?.processed ??
      ((arenaTotals?.approved ?? 0) + (arenaTotals?.rejected ?? 0)),
    last_updated: arenaTotals?.last_updated ?? new Date().toISOString(),
    source: "arena_stats",
  };

  useEffect(() => {
    return () => {
      if (playingVideo) {
        pauseVideo(playingVideo);
      }

      if (playingAudio && audioRef.current) {
        audioRef.current.pause();
        setPlayingAudio(null);
        audioRef.current = null;
      }
    };
  }, [playingVideo, playingAudio, pauseVideo]);

  if (isMobile) {
    return (
      <div className="h-full w-full overflow-y-auto bg-background text-foreground scrollbar-themed">

        {/* Espaçamento para "pular linhas" */}
        <div className="w-full h-24"></div>

        {/* Header Mobile - Centralizado */}
        <div className="sticky top-0 z-10 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
          <div className="relative flex items-center justify-center">
            {/* Título Centralizado */}
            <div className="text-center">
              <h1 className="text-xl font-black tracking-tighter">
                Arena de <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">Votação</span>
              </h1>
              <p className="text-xs text-gray-400">Posts em votação por 60 minutos</p>
            </div>

            {/* Botão de voltar (Posicionado absolutamente para não empurrar o texto) */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white absolute right-0"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Estatísticas Mobile - Movidas para o topo (acima da ArenaStatsCards se necessário) */}
        <div className="px-4 pb-4 space-y-3">
          {/* Tipos + total de votos (topo conforme solicitado) */}
          <Card className="border border-border/60 bg-card/60 backdrop-blur-md">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-orange-400 font-bold">World Flash</p>
                  <p className="text-xl font-black text-white">{worldStats.worldFlashCount}</p>
                  <p className="text-[10px] text-gray-400">votos: {worldStats.worldFlashVotes}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">World Flow</p>
                  <p className="text-xl font-black text-white">{worldStats.worldFlowCount}</p>
                  <p className="text-[10px] text-gray-400">votos: {worldStats.worldFlowVotes}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Total Arena</p>
                  <p className="text-xl font-black text-white">{worldStats.totalCount}</p>
                  <p className="text-[10px] text-gray-400">votos: {worldStats.totalVotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ArenaStatsCards stats={safeStats} />
          <div className="mt-4">
            <ArenaPolls />
          </div>
        </div>

        {/* Conteúdo Principal Mobile */}
        <div className="p-4 space-y-6 pb-24">
          {postsIsError ? (
            <div className="text-center py-12">
              <p className="text-red-400">Erro ao carregar posts.</p>
            </div>
          ) : isLoading && (posts ?? []).length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-400 mb-4" />
              <p className="text-gray-400">Carregando posts...</p>
            </div>
          ) : (
            posts?.map((post) => {
              const heartCount = post.post_votes?.filter((v: any) => v.vote_type === 'heart').length || 0;
              const bombCount = post.post_votes?.filter((v: any) => v.vote_type === 'bomb').length || 0;
              const totalVotes = heartCount + bombCount;
              // CORREÇÃO: Em caso de empate (0 votos ou heartCount === bombCount), approvalRate deve ser 0%
              const approvalRate = totalVotes > 0 && heartCount > bombCount ? (heartCount / totalVotes) * 100 : 0;
              const isAudio = post.audio_url && isAudioUrl(post.audio_url);
              const userVote = post.post_votes?.find((v: any) => v.user_id === user?.id);

              return (
                <div id={`post-${post.id}`} key={post.id} className={cn("bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 overflow-hidden", highlightPostId === post.id && "ring-2 ring-purple-500/60 shadow-lg shadow-purple-500/10")}>
                  <div className="p-4 flex items-center justify-between border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      <Avatar className="ring-2 ring-orange-500/30">
                        <AvatarImage src={post.profiles?.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                          {post.profiles?.username?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <UserLink
                          userId={post.user_id}
                          username={post.profiles?.username || ""}
                          className="font-bold text-sm hover:text-orange-400 transition-colors"
                        >
                          @{post.profiles?.username}
                        </UserLink>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400">
                            {new Date(post.created_at).toLocaleDateString('pt-BR')}
                          </p>
                          {post.post_type === 'viral_clips' && (
                            <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-[10px] h-4 px-1 border-0">
                              <Film className="h-3 w-3 mr-1" />
                              World Flash
                            </Badge>
                          )}
                          {post.post_type === 'photo_audio' && (
                            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-[10px] h-4 px-1 border-0">
                              <FlashIcon className="h-3 w-3 mr-1" />
                              Flash
                            </Badge>
                          )}
                        </div>
                        {/* Status de movimento e humor - MOBILE */}
                        {(post.profiles?.movement_status_enabled || post.profiles?.mood_status_enabled) && (
                          <div className="flex items-center flex-wrap mt-2 gap-2">
                            {post.profiles?.movement_status_enabled && post.profiles?.movement_status && (
                              <MovementStatusBadge
                                userId={post.user_id}
                                snapshotEnabled={true}
                                snapshotStatus={post.profiles.movement_status}
                              />
                            )}
                            {post.profiles?.mood_status_enabled && post.profiles?.current_mood && (post.profiles?.mood_public || post.user_id === user?.id) && (
                              <MoodStatusBadge
                                userId={post.user_id}
                                viewerId={user?.id}
                                snapshotEnabled={true}
                                snapshotMood={post.profiles.current_mood}
                                snapshotEmoji={post.profiles.current_mood_emoji || undefined}
                                snapshotPublic={post.profiles.mood_public}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <VotingCountdown
                        endsAt={post.voting_ends_at}
                        onExpire={refetch}
                      />
                      {post.user_id === user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background border-border text-foreground">
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(post.id)}
                              className="text-red-400 hover:bg-red-500/10 cursor-pointer"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    {post.content && (
                      <div className="mb-4">
                        <MentionText text={post.content} className="text-white/90" />
                      </div>
                    )}

                    {renderMedia(post)}

                    {isAudio && (
                      <div className="mb-4">
                        <AudioPlayer
                          src={post.audio_url}
                          isPlaying={playingAudio === post.audio_url}
                          onPlayPause={handleAudioPlayPause}
                          audioUrl={post.audio_url}
                        />
                      </div>
                    )}

                    <div className="bg-gradient-to-r from-orange-900/20 to-red-900/20 p-4 rounded-lg border border-orange-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-orange-300">
                          Votação da Comunidade
                        </span>
                        <div className="text-xs text-gray-400">
                          {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <Bomb className="h-4 w-4 text-red-400" />
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${approvalRate}%` }}
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                          />
                          <div
                            style={{ width: `${100 - approvalRate}%` }}
                            className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-500"
                          />
                        </div>
                        <Heart className="h-4 w-4 text-green-400 fill-green-400" />
                      </div>

                      <div className="flex justify-between text-xs mb-4">
                        <span className="font-bold text-green-400">
                          {approvalRate.toFixed(0)}% Aprovação
                        </span>
                        <span className="font-bold text-red-400">
                          {(100 - approvalRate).toFixed(0)}% Rejeição
                        </span>
                      </div>

                      <p className="text-[11px] text-gray-400 mb-3">
                        Regra: só aprova se ❤️ for <b>MAIOR</b> que 💣. Se empatar, reprova.
                      </p>

                      <div className="flex gap-2">
                        <Button
                          variant={userVote?.vote_type === 'bomb' ? "destructive" : "outline"}
                          className={cn(
                            "flex-1",
                            userVote?.vote_type === 'bomb'
                              ? "bg-gradient-to-r from-red-500 to-pink-500 text-white border-0"
                              : "border-gray-700 bg-gray-800/30 text-gray-300 hover:bg-gray-800/60"
                          )}
                          disabled={post.user_id === user?.id}
                          title={post.user_id === user?.id ? "Você não pode votar no próprio post" : "Rejeitar"}
                          onClick={() => handleVote(post.id, "bomb")}
                        >
                          <Bomb className="mr-2 h-4 w-4" />
                          Rejeitar ({bombCount})
                        </Button>
                        <Button
                          variant={userVote?.vote_type === 'heart' ? "default" : "outline"}
                          className={cn(
                            "flex-1",
                            userVote?.vote_type === 'heart'
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0"
                              : "border-gray-700 bg-gray-800/30 text-gray-300 hover:bg-gray-800/60"
                          )}
                          disabled={post.user_id === user?.id}
                          title={post.user_id === user?.id ? "Você não pode votar no próprio post" : "Aprovar"}
                          onClick={() => handleVote(post.id, "heart")}
                        >
                          <Heart className="mr-2 h-4 w-4 fill-current" />
                          Aprovar ({heartCount})
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                      <div className="flex gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => handleLike(post.id)}
                        >
                          <Heart className="h-4 w-4 mr-1" />
                          {post.likes?.length || 0}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setOpeningCommentsFor(post)}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" />
                          {post.comments?.length || 0}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-orange-400 hover:text-orange-300"
                          onClick={() => handleShareHelp(post)}
                          title="Compartilhar pedido de ajuda com o tempo restante"
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Ajuda
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-orange-400 hover:text-orange-300"
                        onClick={() => navigate('/')}
                      >
                        Ver no World Flow
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {(!posts || posts.length === 0) && !isLoading && (
            <div className="text-center py-12 bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-xl border border-orange-500/20">
              <div className="text-gray-400 mb-4">
                <Flame className="h-12 w-12 mx-auto opacity-50" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-white">Nenhuma postagem em votação</h3>
              <p className="text-sm text-gray-400">
                Todas as postagens já foram votadas. Volte mais tarde!
              </p>
            </div>
          )}
        </div>

        <Dialog open={!!openingCommentsFor} onOpenChange={(o) => !o && setOpeningCommentsFor(null)}>
          <DialogContent className="max-w-lg rounded-2xl bg-background border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground">Comentários</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[50vh] pr-4 scrollbar-themed">
              {loadingComments ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-400 mt-2">Carregando comentários...</p>
                </div>
              ) : comments?.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">Nenhum comentário ainda. Seja o primeiro!</p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {comments?.map((c: any) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      currentUserId={user?.id}
                      onReply={(id, username) => setReplyingToComment({ id, username })}
                      onDelete={(id) => supabase.from("comments").delete().eq("id", id).then(() => queryClient.invalidateQueries({ queryKey: ["post-comments"] }))}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="mt-4 flex flex-col gap-2">
              {replyingToComment && (
                <div className="flex items-center justify-between text-xs text-gray-300 px-3 py-2 bg-gray-800 rounded-md border border-gray-700">
                  <span>Respondendo a <strong>@{replyingToComment.username}</strong></span>
                  <button onClick={() => setReplyingToComment(null)} className="text-muted-foreground hover:text-foreground">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <NewMentionTextarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Escreva um comentário… (use @ para mencionar)"
                  className="bg-gray-800 border-gray-700 text-white text-base max-h-[140px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (newCommentText.trim()) addComment.mutate();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 flex-shrink-0"
                  onClick={() => addComment.mutate()}
                  disabled={!newCommentText.trim() || addComment.isPending}
                >
                  {addComment.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Enter envia • Shift+Enter quebra linha
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Compartilhar (Ajuda) - mesmo modal do Feed, também disponível no mobile */}
        <ShareDialog
          open={shareHelpOpen}
          onOpenChange={setShareHelpOpen}
          title="Ajuda na Arena"
          description="Peça ajuda para votar na sua publicação"
          shareText={(() => {
            const post = shareHelpPost;
            if (!post) return "Preciso de ajuda na votação da Arena!";
            const timeLeft = getTimeLeftText(post?.voting_ends_at);
            const excerpt = String(post?.content ?? "").trim();
            const snippet = excerpt.length > 0
              ? `${excerpt.slice(0, 140)}${excerpt.length > 140 ? "..." : ""}`
              : "(post sem texto)";
            return (
              `🚨 Preciso da sua ajuda na votação da Arena!\n\n` +
              `📝 Post: ${snippet}\n` +
              `⏳ Tempo restante: ${timeLeft}\n\n` +
              `👉 Vote com ❤️ (aprova) ou 💣 (reprova) na Arena:`
            );
          })()}
          shareUrl={(() => {
            const post = shareHelpPost;
            if (!post) return `${window.location.origin}/arena`;
            return `${window.location.origin}/arena#post-${post.id}`;
          })()}
          preview={shareHelpPost ? {
            avatarUrl: shareHelpPost?.profiles?.avatar_url,
            username: shareHelpPost?.profiles?.username,
            contentSnippet: String(shareHelpPost?.content ?? "").trim().slice(0, 180) || null,
          } : undefined}
        />
      </div>
    );
  }

  // Renderização Desktop
  return (
    <div className="h-full w-full overflow-y-auto bg-background scrollbar-themed">

      {/* Espaçamento para "pular linhas" */}
      <div className="w-full h-24"></div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Desktop - Texto Centralizado */}
        <div className="relative flex items-center justify-center mb-8">

          {/* Título centralizado */}
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tighter">
              Arena de <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">Votação</span>
            </h1>
            <p className="text-gray-500 text-sm">Posts em votação por 60 minutos</p>
          </div>

          {/* Botão de voltar (posicionado absolutamente à direita) */}
          <Button
            variant="outline"
            className="gap-2 absolute right-0"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao World Flow
          </Button>
        </div>

        {/* Estatísticas da Arena */}
        <ArenaStatsCards stats={safeStats} />
        <div className="mt-4 hidden lg:block">
          <ArenaPolls />
        </div>

        <div className="grid grid-cols-4 gap-8">

          {/* Coluna 1: Sidebar/Stats (MOVIDA PARA A ESQUERDA) */}
          <div className="col-span-1 space-y-6">
            {/* Estatísticas */}
            <Card className="border border-border/60">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4">Estatísticas da Arena</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total em votação</span>
                    <span className="font-bold text-2xl">{worldStats.totalCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">World Flash</span>
                    <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
                      {worldStats.worldFlashCount}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">World Flow</span>
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                      {worldStats.worldFlowCount}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total já votado</span>
                    <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white">
                      {worldStats.totalVotes}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seção Flash */}
            {flashPosts.length > 0 && (
              <Card className="border border-border/60">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-lg">
                      <FlashIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Flash em Votação</h3>
                      <p className="text-sm text-muted-foreground">Foto + Áudio</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {flashPosts.slice(0, 3).map((post) => {
                      const mediaUrl = post.media_urls?.[0] ? stripPrefix(post.media_urls[0]) : null;
                      const heartCount = post.post_votes?.filter((v: any) => v.vote_type === 'heart').length || 0;
                      const bombCount = post.post_votes?.filter((v: any) => v.vote_type === 'bomb').length || 0;
                      const isAudio = post.audio_url && isAudioUrl(post.audio_url);

                      return (
                        <div key={post.id} className="flex flex-col gap-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                          <div className="aspect-[4/5] rounded-lg overflow-hidden bg-muted">
                            {mediaUrl && (
                              <ProgressiveImage
                                src={mediaUrl}
                                alt="Flash"
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={post.profiles?.avatar_url} />
                              <AvatarFallback>{post.profiles?.username?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{post.profiles?.username}</p>
                            </div>
                            {isAudio && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handleAudioPlayPause(post.audio_url)}
                              >
                                {playingAudio === post.audio_url ? (
                                  <Pause className="h-3 w-3" />
                                ) : (
                                  <Play className="h-3 w-3 ml-0.5" />
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-green-600">
                              <Heart className="h-3 w-3 fill-current" />
                              <span>{heartCount}</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-600">
                              <Bomb className="h-3 w-3" />
                              <span>{bombCount}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Seção Clips */}
            {clipsPosts.length > 0 && (
              <Card className="border border-border/60">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="bg-gradient-to-br from-pink-600 to-purple-600 p-2 rounded-lg">
                      <Film className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">World Flash em Votação</h3>
                      <p className="text-sm text-muted-foreground">Vídeos curtos</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {clipsPosts.slice(0, 3).map((post) => {
                      const videoUrl = post.media_urls?.[0] ? stripPrefix(post.media_urls[0]) : null;
                      const heartCount = post.post_votes?.filter((v: any) => v.vote_type === 'heart').length || 0;
                      const bombCount = post.post_votes?.filter((v: any) => v.vote_type === 'bomb').length || 0;

                      return (
                        <div key={post.id} className="flex flex-col gap-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                          <div className="aspect-video rounded-lg overflow-hidden bg-black relative">
                            {videoUrl && (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-900/20 to-purple-900/20">
                                <Film className="text-purple-400 h-8 w-8" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={post.profiles?.avatar_url} />
                              <AvatarFallback>{post.profiles?.username?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{post.profiles?.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-green-600">
                              <Heart className="h-3 w-3 fill-current" />
                              <span>{heartCount}</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-600">
                              <Bomb className="h-3 w-3" />
                              <span>{bombCount}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna 3: Feed Principal (MOVIDA PARA A DIREITA) */}
          <div className="col-span-3 space-y-8">
            {postsIsError ? (
              <div className="text-center py-12">
                <p className="text-red-500">Erro ao carregar posts.</p>
              </div>
            ) : isLoading && (posts ?? []).length === 0 ? (
              <div className="text-center py-16">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-orange-400 mb-4" />
                <h3 className="text-xl font-medium mb-2">Carregando posts...</h3>
                <p className="text-gray-600">Buscando posts em votação</p>
              </div>
            ) : (
              posts?.map((post) => {
                const heartCount = post.post_votes?.filter((v: any) => v.vote_type === 'heart').length || 0;
                const bombCount = post.post_votes?.filter((v: any) => v.vote_type === 'bomb').length || 0;
                const totalVotes = heartCount + bombCount;
                // CORREÇÃO: Em caso de empate (0 votos ou heartCount === bombCount), approvalRate deve ser 0%
                const approvalRate = totalVotes > 0 && heartCount > bombCount ? (heartCount / totalVotes) * 100 : 0;
                const isAudio = post.audio_url && isAudioUrl(post.audio_url);
                const userVote = post.post_votes?.find((v: any) => v.user_id === user?.id);

                return (
                  <Card id={`post-${post.id}`} key={post.id} className={cn("border border-border/60 hover:border-border transition-colors", highlightPostId === post.id && "ring-2 ring-purple-500/60")}>
                    <CardContent className="pt-8 space-y-6">
                      {/* Cabeçalho */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14 ring-2 ring-orange-500/20">
                            <AvatarImage src={post.profiles?.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl">
                              {post.profiles?.username?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <UserLink
                              userId={post.user_id}
                              username={post.profiles?.username || ""}
                              className="text-xl font-bold hover:text-orange-600"
                            >
                              @{post.profiles?.username}
                            </UserLink>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground">
                                {new Date(post.created_at).toLocaleDateString("pt-BR")}
                              </p>
                              {post.post_type === 'viral_clips' && (
                                <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-xs border-0">
                                  <Film className="h-3 w-3 mr-1" />
                                  World Flash
                                </Badge>
                              )}
                              {post.post_type === 'photo_audio' && (
                                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-xs border-0">
                                  <FlashIcon className="h-3 w-3 mr-1" />
                                  Flash
                                </Badge>
                              )}
                            </div>

                            {/* CORREÇÃO: Status de movimento e humor - DESKTOP */}
                            {(post.profiles?.movement_status_enabled || post.profiles?.mood_status_enabled) && (
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {post.profiles?.movement_status_enabled && post.profiles?.movement_status && (
                                  <MovementStatusBadge
                                    userId={post.user_id}
                                    snapshotEnabled={true}
                                    snapshotStatus={post.profiles.movement_status}
                                  />
                                )}
                                {post.profiles?.mood_status_enabled && post.profiles?.current_mood && (post.profiles?.mood_public || post.user_id === user?.id) && (
                                  <MoodStatusBadge
                                    userId={post.user_id}
                                    viewerId={user?.id}
                                    snapshotEnabled={true}
                                    snapshotMood={post.profiles.current_mood}
                                    snapshotEmoji={post.profiles.current_mood_emoji || undefined}
                                    snapshotPublic={post.profiles.mood_public}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <VotingCountdown
                            endsAt={post.voting_ends_at}
                            onExpire={refetch}
                          />
                          {post.user_id === user?.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => deleteMutation.mutate(post.id)}
                                  className="text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo */}
                      {post.content && (
                        <div className="text-foreground leading-relaxed text-lg">
                          <MentionText text={post.content ?? ""} />
                        </div>
                      )}

                      {/* Mídias */}
                      {renderMedia(post)}

                      {/* Áudio */}
                      {isAudio && (
                        <div>
                          <AudioPlayer
                            src={post.audio_url}
                            isPlaying={playingAudio === post.audio_url}
                            onPlayPause={handleAudioPlayPause}
                            audioUrl={post.audio_url}
                          />
                        </div>
                      )}

                      {/* Área de Votação */}
                      <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-200">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-lg font-bold text-orange-800">
                            Votação da Comunidade
                          </span>
                          <div className="text-sm text-muted-foreground">
                            {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
                          </div>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="flex items-center gap-3 mb-4">
                          <Bomb className="h-5 w-5 text-red-500" />
                          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${approvalRate}%` }}
                              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                            />
                            <div
                              style={{ width: `${100 - approvalRate}%` }}
                              className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-500"
                            />
                          </div>
                          <Heart className="h-5 w-5 text-green-500 fill-green-500" />
                        </div>

                        {/* Porcentagens */}
                        <div className="flex justify-between text-sm mb-6">
                          <span className="font-bold text-green-600">
                            {approvalRate.toFixed(0)}% Aprovação
                          </span>
                          <span className="font-bold text-red-600">
                            {(100 - approvalRate).toFixed(0)}% Rejeição
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                          Regra: só aprova se ❤️ for <b>MAIOR</b> que 💣. Se empatar, reprova.
                        </p>

                        {/* Botões de Voto */}
                        <div className="flex gap-3">
                          <Button
                            variant={userVote?.vote_type === 'bomb' ? "destructive" : "outline"}
                            size="lg"
                            className={cn(
                              "flex-1 text-lg py-3",
                              userVote?.vote_type === 'bomb'
                                ? "bg-gradient-to-r from-red-500 to-pink-500 text-white border-0"
                                : "border-gray-300 text-gray-700 hover:bg-gray-100"
                            )}
                            disabled={post.user_id === user?.id}
                            title={post.user_id === user?.id ? "Você não pode votar no próprio post" : "Rejeitar"}
                            onClick={() => handleVote(post.id, "bomb")}
                          >
                            <Bomb className="mr-3 h-5 w-5" />
                            Rejeitar ({bombCount})
                          </Button>
                          <Button
                            variant={userVote?.vote_type === 'heart' ? "default" : "outline"}
                            size="lg"
                            className={cn(
                              "flex-1 text-lg py-3",
                              userVote?.vote_type === 'heart'
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0"
                                : "border-gray-300 text-gray-700 hover:bg-gray-100"
                            )}
                            disabled={post.user_id === user?.id}
                            title={post.user_id === user?.id ? "Você não pode votar no próprio post" : "Aprovar"}
                            onClick={() => handleVote(post.id, "heart")}
                          >
                            <Heart className="mr-3 h-5 w-5 fill-current" />
                            Aprovar ({heartCount})
                          </Button>
                        </div>
                      </div>

                      {/* Interações */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex gap-6">
                          <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => handleLike(post.id)}
                            className="text-lg"
                          >
                            <Heart className="h-6 w-6 mr-3" />
                            {post.likes?.length || 0}
                          </Button>

                          <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => setOpeningCommentsFor(post)}
                            className="text-lg"
                          >
                            <MessageCircle className="h-6 w-6 mr-3" />
                            {post.comments?.length || 0}
                          </Button>

                          <Button
                            variant="ghost"
                            size="lg"
                            onClick={() => handleShareHelp(post)}
                            className="text-lg text-orange-600 hover:text-orange-700"
                            title="Compartilhar pedido de ajuda com o tempo restante"
                          >
                            <Send className="h-6 w-6 mr-3" />
                            Ajuda
                          </Button>
                        </div>

                        <Button
                          variant="outline"
                          size="lg"
                          className="text-lg"
                          onClick={() => navigate('/')}
                        >
                          Ver no World Flow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}

            {(!posts || posts.length === 0) && !isLoading && (
              <div className="text-center py-16 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200">
                <Flame className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Nenhuma postagem em votação</h3>
                <p className="text-gray-600 mb-6">
                  Todas as postagens já foram votadas. Volte mais tarde!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de comentários */}
      <Dialog open={!!openingCommentsFor} onOpenChange={(o) => !o && setOpeningCommentsFor(null)}>
        <DialogContent className="max-w-xl bg-background">
          <DialogHeader><DialogTitle>Comentários</DialogTitle></DialogHeader>
          <div className="max-h-[50vh] overflow-auto space-y-4 pr-1 scrollbar-themed pt-2">
            {loadingComments ? (
              <p className="text-sm text-muted-foreground">Carregando comentários...</p>
            ) : (comments?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground border p-4 text-center rounded-lg bg-accent/50">Seja o primeiro a comentar!</p>
            ) : (
              <div className="space-y-4">
                {comments!.map((c: any) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    currentUserId={user?.id}
                    onReply={(id, username) => setReplyingToComment({ id, username })}
                    onDelete={(id) => supabase.from("comments").delete().eq("id", id).then(() => queryClient.invalidateQueries({ queryKey: ["post-comments"] }))}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {replyingToComment && (
              <div className="flex items-center justify-between text-xs text-muted-foreground px-3 py-2 bg-accent/50 rounded-md border border-border">
                <span>Respondendo a <strong>@{replyingToComment.username}</strong></span>
                <button onClick={() => setReplyingToComment(null)} className="hover:text-foreground">
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            )}
            <NewMentionTextarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Escreva um comentário… (use @ para mencionar)"
              rows={3}
              className="text-base"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => addComment.mutate()}
                disabled={addComment.isPending || !newCommentText.trim() || !openingCommentsFor}
                className="py-2.5 px-6 min-w-[120px] rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 transition-opacity"
              >
                Comentar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visualizador de mídia */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/90 border-0">
          <div className="relative h-[80vh] flex items-center justify-center">
            {viewerUrl && (
              <>
                {isVideoUrl(viewerUrl) ? (
                  <video
                    src={viewerUrl}
                    className="max-h-full max-w-full rounded-lg"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={viewerUrl}
                    alt="Visualização"
                    className="max-h-full max-w-full object-contain rounded-lg"
                  />
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-4 right-4 rounded-full"
                  onClick={() => setViewerOpen(false)}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareHelpOpen}
        onOpenChange={setShareHelpOpen}
        title="Ajuda na Arena"
        description="Peça ajuda para votar na sua publicação"
        shareText={(() => {
          const post = shareHelpPost;
          if (!post) return "Preciso de ajuda na votação da Arena!";
          const timeLeft = getTimeLeftText(post?.voting_ends_at);
          const excerpt = String(post?.content ?? "").trim();
          const snippet = excerpt.length > 0
            ? `${excerpt.slice(0, 140)}${excerpt.length > 140 ? "..." : ""}`
            : "(post sem texto)";
          return (
            `🚨 Preciso da sua ajuda na votação da Arena!

` +
            `📝 Post: ${snippet}
` +
            `⏳ Tempo restante: ${timeLeft}

` +
            `👉 Vote com ❤️ (aprova) ou 💣 (reprova) na Arena:`
          );
        })()}
        shareUrl={(() => {
          const post = shareHelpPost;
          if (!post) return `${window.location.origin}/arena`;
          return `${window.location.origin}/arena#post-${post.id}`;
        })()}
        preview={shareHelpPost ? {
          avatarUrl: shareHelpPost?.profiles?.avatar_url,
          username: shareHelpPost?.profiles?.username,
          contentSnippet: String(shareHelpPost?.content ?? "").trim().slice(0, 180) || null,
        } : undefined}
      />

    </div>
  );
}

type PostRow = any;