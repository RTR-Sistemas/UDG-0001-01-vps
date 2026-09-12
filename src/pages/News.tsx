/**
 * =============================================================================
 * File: src/pages/News.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadNews } from "@/hooks/useUnreadNews";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Globe,
  Swords,
  Users,
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Eye,
  AlertCircle,
  User,
  Users2,
  CheckCircle,
  XCircle,
  Trophy,
  Compass,
  Loader2,
  Check,
  X,
  Trash2,
  Play,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  File,
  MoreVertical,
  ExternalLink,
  Bookmark,
  Flag,
  Ban,
  Shield,
  CheckCheck,
  EyeOff,
  Minimize2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserLink } from "@/components/UserLink";
import { MentionText } from "@/components/MentionText";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type NewsFilter = "all" | "feed" | "arena" | "communities" | "social" | "system";

type Author = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type NewsEvent =
  | {
    id: string;
    kind: "feed_post" | "arena_post";
    created_at: string;
    author: Author;
    content: string | null;
    media_urls?: string[] | null;
    post_type?: string;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "community_post";
    created_at: string;
    author: Author;
    content: string | null;
    media_urls?: string[] | null;
    community: { id: string; name: string | null; avatar_url: string | null };
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "attention_call";
    created_at: string;
    author: Author;
    message: string | null;
    viewed_at: string | null;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "mention";
    created_at: string;
    author: Author;
    content: string | null;
    source_type: 'post' | 'comment' | 'message' | 'community_post';
    source_id: string;
    post_id?: string;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "like_comment";
    created_at: string;
    author: Author;
    target_id: string;
    target_content: string | null;
    post_id?: string;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "reply_comment";
    created_at: string;
    author: Author;
    post_id: string;
    parent_comment_content: string | null;
    comment_content: string;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "friend_request";
    created_at: string;
    author: Author;
    status: 'pending' | 'accepted' | 'rejected';
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "relationship_request";
    created_at: string;
    author: Author;
    desired_status: string;
    status: 'pending' | 'accepted' | 'rejected';
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "relationship_request_result";
    created_at: string;
    author: Author;
    status: 'accepted' | 'rejected';
    desired_status?: string | null;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "family_request";
    created_at: string;
    author: Author;
    relation_type: string;
    status: 'pending' | 'accepted' | 'rejected';
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "family_request_result";
    created_at: string;
    author: Author;
    status: 'accepted' | 'rejected';
    relation_type?: string | null;
    viewed?: boolean;
  }

  | {
    id: string;
    kind: "like";
    created_at: string;
    author: Author;
    target_type: 'post' | 'comment' | 'community_post';
    target_id: string;
    target_content: string | null;
    post_id?: string;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "comment";
    created_at: string;
    author: Author;
    post_id: string;
    post_content: string | null;
    comment_content: string;
    post_media_urls?: string[] | null;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "profile_visit";
    created_at: string;
    author: Author;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "follow";
    created_at: string;
    author: Author;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "friend_accept";
    created_at: string;
    author: Author;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "post_approved";
    created_at: string;
    author?: Author;
    post_type: string;
    post_id: string;
    post_content: string | null;
    post_media_urls?: string[] | null;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "post_rejected";
    created_at: string;
    author?: Author;
    post_type: string;
    post_id: string;
    post_content: string | null;
    post_media_urls?: string[] | null;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "community_join";
    created_at: string;
    author?: Author;
    community: { id: string; name: string | null; avatar_url: string | null };
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "community_leave";
    created_at: string;
    author?: Author;
    community: { id: string; name: string | null; avatar_url: string | null };
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "achievement";
    created_at: string;
    author?: Author;
    title: string;
    description: string;
    icon: string;
    viewed?: boolean;
  }
  | {
    id: string;
    kind: "movement_status";
    created_at: string;
    author: Author;
    status: string;
    location: string | null;
    viewed?: boolean;
  };

function timeAgo(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const sec = Math.max(0, Math.floor(diff / 1000));

  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mês`;
  const years = Math.floor(days / 365);
  return `${years} ano${years > 1 ? 's' : ''}`;
}

// Verifica se o conteúdo expirou na Arena (mais de 60 minutos)
const isArenaContentExpired = (createdAt: string): boolean => {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  // 60 minutos * 60 segundos * 1000 milissegundos
  const sixtyMinutesInMs = 60 * 60 * 1000;
  return (now - created) > sixtyMinutesInMs;
};

// Função auxiliar para traduzir status de movimento para PT-BR
const translateMovementStatus = (status: string) => {
  const map: Record<string, string> = {
    'stopped': 'Parado',
    'moving': 'Em movimento',
    'traveling': 'Viajando',
    'online': 'Online',
    'offline': 'Offline'
  };
  return map[status] || status;
};

const getEventIcon = (kind: NewsEvent['kind']) => {
  switch (kind) {
    case 'feed_post': return <Globe className="h-4 w-4" />;
    case 'arena_post': return <Swords className="h-4 w-4" />;
    case 'community_post': return <Users className="h-4 w-4" />;
    case 'attention_call': return <AlertCircle className="h-4 w-4" />;
    case 'mention': return <AtSign className="h-4 w-4" />;
    case 'friend_request': return <UserPlus className="h-4 w-4" />;
    case 'relationship_request': return <Heart className="h-4 w-4" />;
    case 'relationship_request_result': return <Heart className="h-4 w-4" />;
    case 'family_request': return <Users2 className="h-4 w-4" />;
    case 'family_request_result': return <Users2 className="h-4 w-4" />;
    case 'like': return <Heart className="h-4 w-4" />;
    case 'comment': return <MessageCircle className="h-4 w-4" />;
    case 'profile_visit': return <Eye className="h-4 w-4" />;
    case 'follow': return <User className="h-4 w-4" />;
    case 'friend_accept': return <Users2 className="h-4 w-4" />;
    case 'post_approved': return <CheckCircle className="h-4 w-4" />;
    case 'post_rejected': return <XCircle className="h-4 w-4" />;
    case 'community_join': return <Users2 className="h-4 w-4" />;
    case 'community_leave': return <Users2 className="h-4 w-4" />;
    case 'achievement': return <Trophy className="h-4 w-4" />;
    case 'movement_status': return <Compass className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

const getEventColor = (kind: NewsEvent['kind']) => {
  switch (kind) {
    case 'feed_post': return "bg-blue-500";
    case 'arena_post': return "bg-red-500";
    case 'community_post': return "bg-purple-500";
    case 'attention_call': return "bg-amber-500";
    case 'mention': return "bg-green-500";
    case 'friend_request': return "bg-pink-500";
    case 'relationship_request': return "bg-rose-500";
    case 'relationship_request_result': return "bg-rose-500";
    case 'family_request': return "bg-violet-500";
    case 'family_request_result': return "bg-violet-500";
    case 'like': return "bg-rose-500";
    case 'like_comment': return "bg-pink-400";
    case 'comment': return "bg-indigo-500";
    case 'reply_comment': return "bg-indigo-400";
    case 'profile_visit': return "bg-cyan-500";
    case 'follow': return "bg-teal-500";
    case 'friend_accept': return "bg-emerald-500";
    case 'post_approved': return "bg-lime-500";
    case 'post_rejected': return "bg-orange-500";
    case 'community_join': return "bg-violet-500";
    case 'community_leave': return "bg-fuchsia-500";
    case 'achievement': return "bg-yellow-500";
    case 'movement_status': return "bg-sky-500";
    default: return "bg-gray-500";
  }
};

const getEventDescription = (event: NewsEvent) => {
  const authorName = event.kind !== 'post_approved' && event.kind !== 'post_rejected' && event.kind !== 'achievement'
    ? event.author?.full_name || event.author?.username || "Usuário"
    : null;

  switch (event.kind) {
    case 'feed_post':
      return `${authorName} postou no World Flow`;
    case 'arena_post':
      return `${authorName} postou na Arena`;
    case 'community_post':
      return `${authorName} postou em ${event.community?.name || "Comunidade"}`;
    case 'attention_call':
      return `${authorName} chamou sua atenção`;
    case 'mention':
      return `${authorName} mencionou você`;
    case 'friend_request':
      return `${authorName} enviou uma solicitação de amizade`;
    case 'relationship_request':
      return `${authorName} quer marcar relacionamento (${event.desired_status})`;
    case 'relationship_request_result':
      return `${authorName} respondeu seu pedido de relacionamento (${event.status})`;
    case 'family_request':
      return `${authorName} quer te adicionar na árvore (${event.relation_type})`;
    case 'family_request_result':
      return `${authorName} respondeu seu convite da árvore (${event.status})`;
    case 'like':
      return `${authorName} curtiu seu ${event.target_type === 'post' ? 'post' : 'comentário'}`;
    case 'like_comment':
      return `${authorName} curtiu seu comentário`;
    case 'comment':
      return `${authorName} comentou no seu post`;
    case 'reply_comment':
      return `${authorName} respondeu ao seu comentário`;
    case 'profile_visit':
      return `${authorName} visitou seu perfil`;
    case 'follow':
      return `${authorName} começou a seguir você`;
    case 'friend_accept':
      return `${authorName} aceitou sua solicitação de amizade`;
    case 'post_approved':
      return `Seu post foi aprovado na comunidade`;
    case 'post_rejected':
      return `Seu post foi rejeitado na comunidade`;
    case 'community_join':
      return `Você entrou na comunidade ${event.community?.name || ""}`;
    case 'community_leave':
      return `Você saiu da comunidade ${event.community?.name || ""}`;
    case 'achievement':
      return `Conquista desbloqueada: ${event.title}`;
    case 'movement_status':
      return `${authorName} está ${translateMovementStatus(event.status)}${event.location ? ` em ${event.location}` : ''}`;
    default:
      return "Nova notificação";
  }
};

const getCleanUrl = (url: string | null | undefined) => {
  if (!url) return null;
  return url.replace(/^(image::|video::|audio::)/, '');
};

const isVideoUrl = (url: string) => {
  const cleanUrl = getCleanUrl(url);
  if (!cleanUrl) return false;

  // Se for áudio, não tratar como vídeo (Cloudinary usa /video/upload/ para áudio também)
  const audioExtensions = /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i;
  if (url.startsWith('audio::') || audioExtensions.test(cleanUrl)) return false;

  const lower = cleanUrl.toLowerCase();

  // Cloudinary vídeos
  if (lower.includes('/video/upload/')) return true;

  // Cloudinary (auto) - tenta inferir por extensão
  if (lower.includes('/auto/upload/')) {
    const videoExt = /\.(mp4|webm|mov|m4v|avi|mkv|flv|wmv|3gp|mpg|mpeg)(\?.*)?$/i;
    if (videoExt.test(lower)) return true;
  }

  const videoExtensions = /\.(mp4|webm|mov|m4v|avi|mkv|flv|wmv|3gp|mpg|mpeg|quicktime)$/i;
  const videoKeywords = /video|mp4|mov|avi|mkv|webm/i;

  return videoExtensions.test(cleanUrl) || videoKeywords.test(cleanUrl) || url.startsWith('video::');
};

const isImageUrl = (url: string) => {
  const cleanUrl = getCleanUrl(url);
  if (!cleanUrl) return false;

  const lower = cleanUrl.toLowerCase();
  // Cloudinary imagens
  if (lower.includes('/image/upload/')) return true;

  // Cloudinary (auto) - tenta inferir por extensão
  if (lower.includes('/auto/upload/')) {
    const imgExt = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)(\?.*)?$/i;
    if (imgExt.test(lower)) return true;
  }

  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|ico)$/i;
  const imageKeywords = /image|jpg|jpeg|png|gif|webp/i;

  return imageExtensions.test(cleanUrl) || imageKeywords.test(cleanUrl) || url.startsWith('image::');
};

const isAudioUrl = (url: string) => {
  const cleanUrl = getCleanUrl(url);
  if (!cleanUrl) return false;

  const audioExtensions = /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i;
  const audioKeywords = /audio|mp3|wav|ogg/i;

  const lower = cleanUrl.toLowerCase();
  if (lower.includes('/auto/upload/') || lower.includes('/video/upload/') || lower.includes('/raw/upload/')) {
    if (audioExtensions.test(cleanUrl)) return true;
  }

  return audioExtensions.test(cleanUrl) || audioKeywords.test(cleanUrl) || url.startsWith('audio::');
};

const buildCloudinaryVideoThumbnailUrl = (url: string): string | null => {
  const cleanUrl = getCleanUrl(url);
  if (!cleanUrl) return null;

  const lower = cleanUrl.toLowerCase();
  if (!lower.includes("res.cloudinary.com")) return null;

  const idx = lower.indexOf("/video/upload/");
  if (idx == -1) return null;

  const parts = cleanUrl.split("/video/upload/");
  if (parts.length < 2) return null;

  const prefix = parts[0];
  const rest = parts.slice(1).join("/video/upload/");

  // Thumbnail no 1º frame (so_0) e força JPG (compatível e leve)
  let thumb = `${prefix}/video/upload/so_0,w_800,f_jpg/${rest}`;

  // Se termina com extensão de vídeo, troca para .jpg (Cloudinary respeita f_jpg)
  thumb = thumb.replace(/\.(mp4|webm|mov|m4v|avi|mkv|flv|wmv|3gp|mpg|mpeg)(\?.*)?$/i, '.jpg$2');
  return thumb;
};

const getVideoThumbnail = async (videoUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      video.currentTime = 0.1;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        reject(new Error('Não foi possível criar contexto do canvas'));
      }
    };

    video.onerror = () => {
      reject(new Error('Erro ao carregar vídeo para thumbnail'));
    };

    video.src = videoUrl;
  });
};

export default function News() {
  const { user } = useAuth();
  const { markAsRead } = useUnreadNews();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<NewsFilter>("all");
  const [baselineViewedAt, setBaselineViewedAt] = useState<string | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearDays, setClearDays] = useState("7");
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerIsVideo, setViewerIsVideo] = useState(false);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const since = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), []);

  useEffect(() => {
    if (!user) return;

    const markAllAsRead = async () => {
      try {
        const { error: upsertError } = await supabase
          .from("last_viewed")
          .upsert({
            user_id: user.id,
            section: "news",
            viewed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,section',
            ignoreDuplicates: false
          });

        if (upsertError) {
          // Ignorando erro de duplicidade se ocorrer durante montagem/desmontagem rápida
          if (upsertError.code !== '23505') {
            console.error("Erro ao upsert last_viewed:", upsertError);
          }
        } else {
          queryClient.invalidateQueries({ queryKey: ["news-events", user.id] });
        }

        await supabase
          .from("attention_calls")
          .update({ viewed_at: new Date().toISOString() })
          .eq("receiver_id", user.id)
          .is("viewed_at", null);

      } catch (error) {
        console.error("Erro ao marcar notificações como lidas:", error);
      }
    };

    markAllAsRead();
  }, [user, queryClient]);

  const markNotificationsAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return;

      setMarkingAsRead(true);

      try {
        const { error: upsertError } = await supabase
          .from("last_viewed")
          .upsert({
            user_id: user.id,
            section: "news",
            viewed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,section',
            ignoreDuplicates: false
          });

        if (upsertError && upsertError.code !== '23505') {
          throw upsertError;
        }

        await supabase
          .from("attention_calls")
          .update({ viewed_at: new Date().toISOString() })
          .eq("receiver_id", user.id)
          .is("viewed_at", null);

        toast({
          title: "Notificações marcadas como lidas",
          description: "Todas as notificações foram marcadas como visualizadas.",
        });

      } catch (error) {
        console.error("Erro ao marcar notificações como lidas:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível marcar todas as notificações como lidas.",
        });
      } finally {
        setMarkingAsRead(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-events", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["unread-news", user?.id] });
    },
  });

  const clearOldNotifications = useMutation({
    mutationFn: async (days: number) => {
      if (!user) return;

      setClearing(true);

      try {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { error: notificationsError } = await supabase
          .from("notifications")
          .delete()
          .eq("user_id", user.id)
          .lt("created_at", cutoffDate);

        if (notificationsError) throw notificationsError;

        toast({
          title: "Notificações limpas",
          description: `Notificações com mais de ${days} dias foram removidas.`,
        });

      } catch (error) {
        console.error("Erro ao limpar notificações:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível limpar as notificações antigas.",
        });
      } finally {
        setClearing(false);
        setShowClearDialog(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-events", user?.id] });
    },
  });



  const respondRelationshipRequest = useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      if (!user) return;

      const newStatus = accept ? 'accepted' : 'rejected';
      const { error } = await supabase.rpc('respond_relationship_request', {
        p_request_id: requestId,
        p_response: newStatus,
      });

      if (error) throw error;
      return { status: newStatus };
    },
    onSuccess: (res) => {
      toast({
        title: res?.status === 'accepted' ? 'Pedido aceito' : 'Pedido recusado',
        description: 'O solicitante será avisado na aba Notícias.',
      });
      queryClient.invalidateQueries({ queryKey: ['news-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-news', user?.id] });
    },
    onError: (error) => {
      console.error('Erro ao responder pedido de relacionamento:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível responder o pedido de relacionamento.' });
    }
  });

  const respondFamilyRequest = useMutation({
    mutationFn: async ({ requestId, accept }: { requestId: string; accept: boolean }) => {
      if (!user) return;

      const newStatus = accept ? 'accepted' : 'rejected';
      const { error: updErr } = await supabase
        .from('family_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('receiver_id', user.id);

      if (updErr) throw updErr;

      return { status: newStatus };
    },
    onSuccess: (res) => {
      toast({
        title: res?.status === 'accepted' ? 'Convite aceito' : 'Convite recusado',
        description: 'O solicitante será avisado na aba Notícias.',
      });
      queryClient.invalidateQueries({ queryKey: ['news-events', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['unread-news', user?.id] });
    },
    onError: (error) => {
      console.error('Erro ao responder convite da árvore:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível responder o convite da árvore.' });
    }
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["news-events", user?.id, since],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return { events: [] as NewsEvent[], lastViewedAt: new Date(0).toISOString() };

      const { data: lastViewedRow, error: lastViewedError } = await supabase
        .from("last_viewed")
        .select("viewed_at")
        .eq("user_id", user.id)
        .eq("section", "news")
        .order("viewed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastViewedError) {
        console.error("Erro ao buscar last_viewed:", lastViewedError);
      }

      const lastViewedAt = lastViewedRow?.viewed_at ?? new Date(0).toISOString();
      const events: NewsEvent[] = [];

      try {
        // 1. Buscar amigos do usuário
        const { data: friendships, error: friendshipsError } = await supabase
          .from("friendships")
          .select("user_id, friend_id")
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        if (friendshipsError) {
          console.error("Erro ao buscar friendships:", friendshipsError);
        }

        const friendIds = (friendships || [])
          .map(f => f.user_id === user.id ? f.friend_id : f.user_id)
          .filter(Boolean) as string[];

        // 2. Buscar comunidades do usuário
        const { data: memberships, error: membershipsError } = await supabase
          .from("community_members")
          .select("community_id")
          .eq("user_id", user.id);

        if (membershipsError) {
          console.error("Erro ao buscar community_members:", membershipsError);
        }

        const communityIds = (memberships || []).map(m => m.community_id);

        // 3. Posts de amigos (Feed e Arena)
        if (friendIds.length > 0) {
          const { data: posts, error: postsError } = await supabase
            .from("posts")
            .select("id, user_id, content, created_at, post_type, media_urls")
            .gte("created_at", since)
            .in("user_id", friendIds)
            .order("created_at", { ascending: false })
            .limit(50);

          if (postsError) {
            console.error("Erro ao buscar posts:", postsError);
          }

          for (const post of posts || []) {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("username, full_name, avatar_url")
              .eq("id", post.user_id)
              .single();

            if (profileError && profileError.code !== 'PGRST116') {
              console.error("Erro ao buscar perfil:", profileError);
            }

            const kind: "feed_post" | "arena_post" =
              post.post_type === "viral_clips" || post.post_type === "photo_audio" ? "arena_post" : "feed_post";

            events.push({
              id: post.id,
              kind,
              created_at: post.created_at,
              content: post.content ?? null,
              media_urls: post.media_urls,
              post_type: post.post_type,
              author: {
                id: post.user_id,
                username: profile?.username ?? null,
                full_name: profile?.full_name ?? null,
                avatar_url: profile?.avatar_url ?? null,
              },
              viewed: new Date(post.created_at).getTime() <= new Date(lastViewedAt).getTime(),
            });
          }
        }

        // 4. Posts de comunidades
        if (communityIds.length > 0) {
          const { data: cposts, error: cpostsError } = await supabase
            .from("community_posts")
            .select("id, user_id, community_id, content, created_at, media_urls")
            .gte("created_at", since)
            .in("community_id", communityIds)
            .order("created_at", { ascending: false })
            .limit(50);

          if (cpostsError) {
            console.error("Erro ao buscar community_posts:", cpostsError);
          }

          for (const post of cposts || []) {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("username, full_name, avatar_url")
              .eq("id", post.user_id)
              .single();

            if (profileError) {
              console.error("Erro ao buscar perfil para community post:", profileError);
            }

            const { data: community, error: communityError } = await supabase
              .from("communities")
              .select("name, avatar_url")
              .eq("id", post.community_id)
              .single();

            if (communityError) {
              console.error("Erro ao buscar comunidade:", communityError);
            }

            events.push({
              id: post.id,
              kind: "community_post",
              created_at: post.created_at,
              content: post.content ?? null,
              media_urls: post.media_urls,
              author: {
                id: post.user_id,
                username: profile?.username ?? null,
                full_name: profile?.full_name ?? null,
                avatar_url: profile?.avatar_url ?? null,
              },
              community: {
                id: post.community_id,
                name: community?.name ?? null,
                avatar_url: community?.avatar_url ?? null,
              },
              viewed: new Date(post.created_at).getTime() <= new Date(lastViewedAt).getTime(),
            });
          }
        }

        // 5. Chamadas de Atenção
        const { data: attentionCalls, error: attentionCallsError } = await supabase
          .from("attention_calls")
          .select("id, sender_id, message, viewed_at, created_at")
          .eq("receiver_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        if (attentionCallsError) {
          console.error("Erro ao buscar attention_calls:", attentionCallsError);
        }

        for (const ac of attentionCalls || []) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", ac.sender_id)
            .single();

          if (profileError) {
            console.error("Erro ao buscar perfil para attention call:", profileError);
          }

          events.push({
            id: ac.id,
            kind: "attention_call",
            created_at: ac.created_at,
            message: ac.message,
            viewed_at: ac.viewed_at,
            author: {
              id: ac.sender_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            viewed: !!ac.viewed_at || new Date(ac.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }

        // 6. Solicitações de Amizade
        const { data: friendRequests, error: friendRequestsError } = await supabase
          .from("friend_requests")
          .select("id, sender_id, status, created_at")
          .eq("receiver_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        if (friendRequestsError) {
          console.error("Erro ao buscar friend_requests:", friendRequestsError);
        }

        for (const fr of friendRequests || []) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", fr.sender_id)
            .single();

          if (profileError) {
            console.error("Erro ao buscar perfil para friend request:", profileError);
          }

          events.push({
            id: fr.id,
            kind: "friend_request",
            created_at: fr.created_at,
            author: {
              id: fr.sender_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            status: fr.status as "pending" | "accepted" | "rejected",
            viewed: new Date(fr.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }



        // 6B. Pedidos de Relacionamento
        const { data: relRequests, error: relRequestsError } = await supabase
          .from("relationship_requests")
          .select("id, sender_id, desired_status, status, created_at")
          .eq("receiver_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        if (relRequestsError) {
          console.error("Erro ao buscar relationship_requests:", relRequestsError);
        }

        for (const rr of relRequests || []) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", rr.sender_id)
            .single();

          if (profileError) {
            console.error("Erro ao buscar perfil para relationship request:", profileError);
          }

          events.push({
            id: rr.id,
            kind: "relationship_request",
            created_at: rr.created_at,
            author: {
              id: rr.sender_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            desired_status: rr.desired_status,
            status: rr.status as "pending" | "accepted" | "rejected",
            viewed: new Date(rr.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }

        // 6C. Convites de Árvore Genealógica
        const { data: familyRequests, error: familyRequestsError } = await supabase
          .from("family_requests")
          .select("id, sender_id, relation_type, status, created_at")
          .eq("receiver_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        if (familyRequestsError) {
          console.error("Erro ao buscar family_requests:", familyRequestsError);
        }

        for (const frq of familyRequests || []) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", frq.sender_id)
            .single();

          if (profileError) {
            console.error("Erro ao buscar perfil para family request:", profileError);
          }

          events.push({
            id: frq.id,
            kind: "family_request",
            created_at: frq.created_at,
            author: {
              id: frq.sender_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            relation_type: frq.relation_type,
            status: frq.status as "pending" | "accepted" | "rejected",
            viewed: new Date(frq.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }

        // 6D. Resultados (respostas) via tabela notifications
        const { data: reqResults, error: reqResultsError } = await supabase
          .from("notifications")
          .select("id, type, created_at, target_user_id, data, is_read")
          .eq("user_id", user.id)
          .in("type", ["relationship_request_result", "family_request_result"])
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        if (reqResultsError) {
          console.error("Erro ao buscar request result notifications:", reqResultsError);
        }

        for (const n of reqResults || []) {
          const otherId = (n as any).target_user_id as string | null;
          const { data: profile, error: profileError } = otherId
            ? await supabase
              .from("profiles")
              .select("username, full_name, avatar_url")
              .eq("id", otherId)
              .single()
            : { data: null, error: null };

          if (profileError) {
            console.error("Erro ao buscar perfil para request result:", profileError);
          }

          const dataObj = (n as any).data || {};
          const status = dataObj?.status ?? "unknown";
          const desired_status = dataObj?.desired_status ?? null;
          const relation_type = dataObj?.relation_type ?? null;

          if ((n as any).type === "relationship_request_result") {
            events.push({
              id: (n as any).id,
              kind: "relationship_request_result",
              created_at: (n as any).created_at,
              author: {
                id: otherId || "",
                username: profile?.username ?? null,
                full_name: profile?.full_name ?? null,
                avatar_url: profile?.avatar_url ?? null,
              },
              status,
              desired_status,
              viewed: !!(n as any).is_read || new Date((n as any).created_at).getTime() <= new Date(lastViewedAt).getTime(),
            });
          } else if ((n as any).type === "family_request_result") {
            events.push({
              id: (n as any).id,
              kind: "family_request_result",
              created_at: (n as any).created_at,
              author: {
                id: otherId || "",
                username: profile?.username ?? null,
                full_name: profile?.full_name ?? null,
                avatar_url: profile?.avatar_url ?? null,
              },
              status,
              relation_type,
              viewed: !!(n as any).is_read || new Date((n as any).created_at).getTime() <= new Date(lastViewedAt).getTime(),
            });
          }
        }

        // 7. Status de movimento dos amigos
        if (friendIds.length > 0) {
          const { data: movements, error: movementsError } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, movement_status, updated_at")
            .in("id", friendIds)
            .gte("updated_at", since)
            .order("updated_at", { ascending: false })
            .limit(50);

          if (movementsError) {
            console.error("Erro ao buscar movement status:", movementsError);
          }

          for (const profile of movements || []) {
            if (profile.movement_status) {
              events.push({
                id: `${profile.id}-${profile.updated_at}`,
                kind: "movement_status",
                created_at: profile.updated_at,
                author: {
                  id: profile.id,
                  username: profile.username,
                  full_name: profile.full_name,
                  avatar_url: profile.avatar_url,
                },
                status: profile.movement_status,
                location: null,
                viewed: new Date(profile.updated_at).getTime() <= new Date(lastViewedAt).getTime(),
              });
            }
          }
        }

        // 8. Comentários em posts do usuário
        // CORRECAO: antes o filtro era .eq("post_id", user.id) — comparava o id
        // do POST com o id do USUARIO, entao nunca retornava nada e a
        // notificacao "comentou no seu post" jamais aparecia. Agora buscamos
        // primeiro os ids dos posts do usuario.
        const { data: meusPosts } = await supabase
          .from("posts")
          .select("id")
          .eq("user_id", user.id)
          .limit(500);
        const meusPostIds = (meusPosts || []).map((p: any) => p.id);

        const { data: userComments, error: commentsError } = meusPostIds.length === 0
          ? { data: [] as any[], error: null }
          : await supabase
          .from("comments")
          .select("id, user_id, post_id, content, created_at")
          .in("post_id", meusPostIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        if (commentsError) {
          console.error("Erro ao buscar comentários:", commentsError);
        }

        for (const comment of userComments || []) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", comment.user_id)
            .single();

          if (profileError) {
            console.error("Erro ao buscar perfil para comentário:", profileError);
          }

          const { data: post, error: postError } = await supabase
            .from("posts")
            .select("content, media_urls")
            .eq("id", comment.post_id)
            .single();

          events.push({
            id: comment.id,
            kind: "comment",
            created_at: comment.created_at,
            author: {
              id: comment.user_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            post_id: comment.post_id,
            post_content: post?.content ?? null,
            comment_content: comment.content,
            post_media_urls: post?.media_urls ?? null,
            viewed: new Date(comment.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }

        // 9. Curtidas em posts do usuário  (mesma correcao do bloco 8)
        const { data: userLikes, error: likesError } = meusPostIds.length === 0
          ? { data: [] as any[], error: null }
          : await supabase
          .from("likes")
          .select("id, user_id, post_id, created_at")
          .in("post_id", meusPostIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50);

        if (likesError) {
          console.error("Erro ao buscar curtidas:", likesError);
        }

        for (const like of userLikes || []) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", like.user_id)
            .single();

          if (profileError) {
            console.error("Erro ao buscar perfil para curtida:", profileError);
          }

          const { data: post, error: postError } = await supabase
            .from("posts")
            .select("content")
            .eq("id", like.post_id)
            .single();

          events.push({
            id: like.id,
            kind: "like",
            created_at: like.created_at,
            author: {
              id: like.user_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            target_type: 'post',
            target_id: like.post_id, // Usamos o ID do post como alvo
            target_content: post?.content ?? null,
            post_id: like.post_id,
            viewed: new Date(like.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }

        // 9B. Curtidas em Comentários do Usuário
        const { data: commentLikes, error: commentLikesError } = await supabase
          .from("comment_likes")
          .select("id, user_id, comment_id, created_at, comments!inner(content, post_id, user_id)")
          .eq("comments.user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(30);

        if (commentLikesError) {
          console.error("Erro ao buscar curtidas de comentários:", commentLikesError);
        }

        for (const cLike of commentLikes || []) {
          if (cLike.user_id === user.id) continue;

          const { data: profile } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", cLike.user_id)
            .single();

          events.push({
            id: `clike-${cLike.id}`,
            kind: "like_comment",
            created_at: cLike.created_at,
            author: {
              id: cLike.user_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            target_id: cLike.comment_id,
            target_content: (cLike.comments as any)?.content,
            post_id: (cLike.comments as any)?.post_id,
            viewed: new Date(cLike.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }

        // 9C. Respostas aos comentários do usuário
        const { data: replies, error: repliesError } = await supabase
          .from("comments")
          .select("id, user_id, post_id, content, parent_id, created_at")
          .not("parent_id", "is", null)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(30);

        if (repliesError) {
          console.error("Erro ao buscar respostas a comentários:", repliesError);
        }

        for (const reply of replies || []) {
          if (reply.user_id === user.id) continue;

          // Checar se o comentário pai é do usuário logado
          const { data: parentComm } = await supabase
            .from("comments")
            .select("user_id, content")
            .eq("id", reply.parent_id)
            .single();

          if (parentComm?.user_id === user.id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username, full_name, avatar_url")
              .eq("id", reply.user_id)
              .single();

            events.push({
              id: `reply-${reply.id}`,
              kind: "reply_comment",
              created_at: reply.created_at,
              author: {
                id: reply.user_id,
                username: profile?.username ?? null,
                full_name: profile?.full_name ?? null,
                avatar_url: profile?.avatar_url ?? null,
              },
              post_id: reply.post_id,
              parent_comment_content: parentComm.content,
              comment_content: reply.content,
              viewed: new Date(reply.created_at).getTime() <= new Date(lastViewedAt).getTime(),
            });
          }
        }

        // 10. Seguidores
        try {
          const { data: followers, error: followersError } = await supabase
            .from("followers")
            .select("follower_id, created_at")
            .eq("following_id", user.id) // CORRIGIDO: seguindo o usuário atual
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(50);

          if (followersError) {
            console.error("Erro ao buscar followers:", followersError);
          }

          for (const follow of followers || []) {
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("username, full_name, avatar_url")
              .eq("id", follow.follower_id)
              .single();

            if (profileError) {
              console.error("Erro ao buscar perfil para follower:", profileError);
            }

            events.push({
              id: `follow-${follow.follower_id}-${follow.created_at}`,
              kind: "follow",
              created_at: follow.created_at,
              author: {
                id: follow.follower_id,
                username: profile?.username ?? null,
                full_name: profile?.full_name ?? null,
                avatar_url: profile?.avatar_url ?? null,
              },
              viewed: new Date(follow.created_at).getTime() <= new Date(lastViewedAt).getTime(),
            });
          }
        } catch (error) {
          console.error("Erro ao processar followers:", error);
        }

        // 11. Menções
        const { data: mentions, error: mentionsErr } = await supabase
          .from("mentions")
          .select("id, user_id, content_type, content_id, created_at")
          .eq("mentioned_user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(30);

        if (mentionsErr) console.error("Erro ao buscar mentions:", mentionsErr);

        for (const mention of mentions || []) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, full_name, avatar_url")
            .eq("id", mention.user_id)
            .single();

          events.push({
            id: `mention-${mention.id}`,
            kind: "mention",
            created_at: mention.created_at,
            author: {
              id: mention.user_id,
              username: profile?.username ?? null,
              full_name: profile?.full_name ?? null,
              avatar_url: profile?.avatar_url ?? null,
            },
            content: null,
            source_type: mention.content_type as "post" | "comment" | "message" | "community_post",
            source_id: mention.content_id,
            viewed: new Date(mention.created_at).getTime() <= new Date(lastViewedAt).getTime(),
          });
        }

        events.sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());

      } catch (error) {
        console.error("Erro geral ao buscar notificações:", error);
      }

      return { events, lastViewedAt };
    },
  });

  useEffect(() => {
    if (!baselineViewedAt && data?.lastViewedAt) {
      setBaselineViewedAt(data.lastViewedAt);
    }
  }, [baselineViewedAt, data?.lastViewedAt]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`news-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['news-events', user.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-news', user.id] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'relationship_requests', filter: `receiver_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['news-events', user.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-news', user.id] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_requests', filter: `receiver_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['news-events', user.id] });
          queryClient.invalidateQueries({ queryKey: ['unread-news', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const events = data?.events ?? [];
  const lastViewedAt = baselineViewedAt ?? data?.lastViewedAt ?? new Date(0).toISOString();

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === "all") return true;
      if (filter === "feed") return e.kind === "feed_post";
      if (filter === "arena") return e.kind === "arena_post";
      if (filter === "communities") return e.kind === "community_post";
      if (filter === "social") {
        return ['attention_call', 'friend_request', 'relationship_request', 'relationship_request_result', 'family_request', 'family_request_result', 'like', 'comment', 'profile_visit', 'follow', 'friend_accept'].includes(e.kind);
      }
      if (filter === "system") {
        return ['post_approved', 'post_rejected', 'community_join', 'community_leave', 'achievement', 'movement_status'].includes(e.kind);
      }
      return true;
    });
  }, [events, filter]);

  const newCount = useMemo(() => {
    return events.filter((e) => !e.viewed).length;
  }, [events]);

  const openMediaViewer = (url: string, isVideo: boolean) => {
    const cleanUrl = getCleanUrl(url);
    if (!cleanUrl) return;

    setViewerUrl(cleanUrl);
    setViewerIsVideo(isVideo);
    setViewerOpen(true);
  };

  const generateVideoThumbnail = async (videoUrl: string): Promise<string> => {
    const cleanUrl = getCleanUrl(videoUrl);
    if (!cleanUrl) return '';

    try {
      const thumbnail = await getVideoThumbnail(cleanUrl);
      return thumbnail;
    } catch (error) {
      console.error('Erro ao gerar thumbnail:', error);
      return '';
    }
  };

  // Thumbnails de vídeo: usamos URL transformada do Cloudinary (renderEventMedia) para evitar CORS/canvas.

  const renderEventMedia = (event: NewsEvent) => {
    let mediaUrls: string[] = [];

    if ('media_urls' in event && event.media_urls && Array.isArray(event.media_urls)) {
      mediaUrls = event.media_urls;
    } else if ('post_media_urls' in event && event.post_media_urls && Array.isArray(event.post_media_urls)) {
      mediaUrls = event.post_media_urls;
    }

    const validMediaUrls = mediaUrls.filter(url => url && typeof url === 'string' && url.trim().length > 0);

    if (validMediaUrls.length === 0) return null;

    const firstMedia = validMediaUrls[0];
    const cleanUrl = getCleanUrl(firstMedia);

    if (!cleanUrl) return null;

    const isVideo = isVideoUrl(firstMedia);
    const isImage = isImageUrl(firstMedia);
    const isAudio = isAudioUrl(firstMedia);

    if (isImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-border group relative">
          <img
            src={cleanUrl}
            alt="Mídia do post"
            className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
            loading="lazy"
            onClick={() => openMediaViewer(firstMedia, false)}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('hidden');
            }}
          />
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            <span>Imagem</span>
          </div>
        </div>
      );
    } else if (isVideo) {
      const thumbnail = buildCloudinaryVideoThumbnailUrl(firstMedia) || videoThumbnails[firstMedia];

      return (
        <div
          className="mt-2 rounded-lg overflow-hidden border border-border bg-black/5 dark:bg-white/5 group relative cursor-pointer"
          onClick={() => openMediaViewer(firstMedia, true)}
        >
          <div className="relative aspect-video">
            <div className="w-full h-40 bg-black flex items-center justify-center relative">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt="Thumbnail do vídeo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                  <VideoIcon className="h-12 w-12 text-gray-600" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <VideoIcon className="h-3 w-3" />
                <span>Vídeo</span>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (isAudio) {
      return (
        <div className="mt-2 rounded-lg border border-border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
              <Music className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Áudio disponível</p>
              <p className="text-xs text-muted-foreground">Clique para reproduzir</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(cleanUrl, '_blank')}
            >
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4" />
          <span className="text-sm">Arquivo de mídia</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-6 text-xs"
            onClick={() => window.open(cleanUrl, '_blank')}
          >
            Abrir
          </Button>
        </div>
      </div>
    );
  };

  const renderEventContent = (event: NewsEvent) => {
    switch (event.kind) {
      case 'feed_post':
      case 'arena_post':
      case 'community_post':
        if (event.content) {
          return (
            <div className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap break-words">
              <MentionText text={event.content} />
            </div>
          );
        }
        break;

      case 'comment':
        return (
          <div className="mt-3 space-y-2">
            <div className="px-3 py-2 bg-muted/20 border-l-2 border-muted-foreground/30 text-sm italic text-muted-foreground">
              "{event.post_content}"
            </div>
            <div className="p-3 bg-card border rounded-lg shadow-sm text-sm">
              <p className="break-words font-medium"><MentionText text={event.comment_content} /></p>
            </div>
          </div>
        );

      case 'reply_comment':
        return (
          <div className="mt-3 space-y-2 max-w-md">
            <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg text-sm text-foreground/70 border-l-4 border-indigo-400 italic relative">
              <span className="text-xs font-semibold mr-1">Você:</span>
              "{event.parent_comment_content}"
            </div>
            <div className="p-3 bg-card border border-indigo-500/10 rounded-lg text-sm shadow-sm">
              <span className="break-words font-medium text-foreground"><MentionText text={event.comment_content} /></span>
            </div>
          </div>
        );

      case 'like_comment':
        return (
          <div className="mt-3 space-y-2">
            <div className="px-3 py-2 bg-pink-50 dark:bg-pink-950/20 rounded-lg text-sm italic text-foreground border-l-4 border-pink-400 shadow-sm relative overflow-hidden group">
              <div className="pl-1 relative z-10 font-medium">"{event.target_content}"</div>
            </div>
          </div>
        );

      case 'mention':
        return (
          <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-500/20 rounded-lg text-sm shadow-sm">
            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 text-[10px] mb-1.5 font-bold uppercase tracking-wider">
              <AtSign className="h-3 w-3" />
              <span>Mencionado em {event.source_type}</span>
            </div>
            <p className="break-words font-medium text-foreground/90"><MentionText text={event.content || ""} /></p>
          </div>
        );

      case 'attention_call':
        if (event.message) {
          return (
            <div className="mt-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <MentionText text={event.message} />
              </div>
            </div>
          );
        }
        break;

      case 'relationship_request':
        return (
          <div className="mt-2 text-sm text-foreground/80 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-800">
            <div className="flex items-start gap-2">
              <Heart className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-500" />
              <div>
                <div className="font-medium">Pedido de relacionamento</div>
                <div className="text-xs mt-0.5">Status desejado: <span className="font-semibold">{event.desired_status}</span></div>
              </div>
            </div>
          </div>
        );

      case 'relationship_request_result':
        return (
          <div className="mt-2 text-sm text-foreground/80 bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-800">
            <div className="flex items-start gap-2">
              <Heart className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-500" />
              <div>
                <div className="font-medium">Resposta do relacionamento</div>
                <div className="text-xs mt-0.5">Status: <span className="font-semibold">{event.status}</span></div>
              </div>
            </div>
          </div>
        );

      case 'family_request':
        return (
          <div className="mt-2 text-sm text-foreground/80 bg-violet-50 dark:bg-violet-950/20 p-3 rounded-lg border border-violet-100 dark:border-violet-800">
            <div className="flex items-start gap-2">
              <Users2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-violet-500" />
              <div>
                <div className="font-medium">Convite para a árvore genealógica</div>
                <div className="text-xs mt-0.5">Parentesco: <span className="font-semibold">{event.relation_type}</span></div>
              </div>
            </div>
          </div>
        );

      case 'family_request_result':
        return (
          <div className="mt-2 text-sm text-foreground/80 bg-violet-50 dark:bg-violet-950/20 p-3 rounded-lg border border-violet-100 dark:border-violet-800">
            <div className="flex items-start gap-2">
              <Users2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-violet-500" />
              <div>
                <div className="font-medium">Resposta do convite da árvore</div>
                <div className="text-xs mt-0.5">Status: <span className="font-semibold">{event.status}</span></div>
              </div>
            </div>
          </div>
        );

      case 'like':
        if (event.target_content) {
          return (
            <div className="mt-2 text-sm text-foreground/70 italic bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-100 dark:border-rose-800">
              <div className="flex items-start gap-2">
                <Heart className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-500" />
                <span>"{event.target_content.length > 100 ? event.target_content.substring(0, 100) + '...' : event.target_content}"</span>
              </div>
            </div>
          );
        }
        break;
      case 'post_approved':
      case 'post_rejected':
        if (event.post_content) {
          return (
            <div className="mt-2 text-sm text-foreground/70 bg-lime-50 dark:bg-lime-950/20 p-3 rounded-lg border border-lime-100 dark:border-lime-800">
              <div className="flex items-start gap-2">
                {event.kind === 'post_approved' ? (
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                )}
                <span>"{event.post_content.length > 100 ? event.post_content.substring(0, 100) + '...' : event.post_content}"</span>
              </div>
            </div>
          );
        }
        break;
      case 'achievement':
        return (
          <div className="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <Trophy className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{event.description}</span>
            </div>
          </div>
        );
      case 'movement_status':
        return (
          <div className="mt-2 text-sm text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 p-3 rounded-lg border border-sky-200 dark:border-sky-800">
            <div className="flex items-start gap-2">
              <Compass className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <div>Status: <span className="font-medium">{translateMovementStatus(event.status)}</span></div>
              </div>
            </div>
          </div>
        );
    }
    return null;
  };

  const handleMarkAndNavigate = async (event: NewsEvent) => {
    if (!user) return;

    try {
      if (!event.viewed) {
        const { error: upsertError } = await supabase
          .from("last_viewed")
          .upsert({
            user_id: user.id,
            section: "news",
            viewed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,section',
            ignoreDuplicates: false
          });

        if (upsertError && upsertError.code !== '23505') {
          throw upsertError;
        }
      }

      switch (event.kind) {
        case 'feed_post':
        case 'arena_post':
          if (event.id) {
            // VERIFICAÇÃO 60 MINUTOS
            if (isArenaContentExpired(event.created_at)) {
              // Se expirou (mais de 60 min), vai para o feed (rota raiz) com parâmetro de post
              navigate(`/?post=${event.id}`);
            } else {
              // Se não expirou (menos de 60 min), vai para a arena
              navigate(`/arena?post=${event.id}`);
            }
          }
          break;
        case 'community_post':
          if (event.id) {
            if (event.community?.id) {
              navigate(`/communities/${event.community.id}`);
            } else {
              // Fallback com verificação de tempo
              navigate(`/arena?post=${event.id}`);
            }
          }
          break;
        case 'attention_call':
          if (event.author?.id) {
            navigate(`/messages?conversation=${event.author.id}`);
          }
          break;
        case 'mention':
          if (event.source_type === 'post') {
            if (event.source_id) {
              navigate(`/arena?post=${event.source_id}`);
            }
          } else if (event.source_type === 'comment') {
            if (event.post_id) {
              navigate(`/arena?post=${event.post_id}`);
            } else {
              navigate('/');
            }
          } else if (event.source_type === 'message') {
            if (event.author?.id) navigate(`/messages?conversation=${event.author.id}`);
          }
          break;
        case 'like':
          if (event.target_type === 'post') {
            if (event.target_id) navigate(`/arena?post=${event.target_id}`);
          } else if (event.target_type === 'comment') {
            if (event.post_id) {
              navigate(`/arena?post=${event.post_id}`);
            } else {
              navigate('/');
            }
          }
          break;
        case 'comment':
          if (event.post_id) navigate(`/arena?post=${event.post_id}`);
          break;
        case 'post_approved':
        case 'post_rejected':
          if (event.post_id) navigate(`/arena?post=${event.post_id}`);
          break;
        case 'friend_request':
        case 'friend_accept':
          if (event.author?.id) navigate(`/profile/${event.author.id}`);
          break;
        case 'relationship_request':
        case 'relationship_request_result':
        case 'family_request':
        case 'family_request_result':
        case 'profile_visit':
          if (event.author?.id) navigate(`/profile/${event.author.id}`);
          break;
        case 'follow':
          if (event.author?.id) navigate(`/profile/${event.author.id}`);
          break;
        default:
          break;
      }

      queryClient.invalidateQueries({ queryKey: ["news-events", user.id] });

    } catch (error) {
      console.error("Erro ao processar notificação:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível processar a notificação.",
      });
    }
  };

  const handleMarkEventAsRead = async (event: NewsEvent) => {
    if (!user) return;

    try {
      if (event.kind === 'attention_call' && !event.viewed_at) {
        await supabase
          .from("attention_calls")
          .update({ viewed_at: new Date().toISOString() })
          .eq("id", event.id);
      }

      const { error: upsertError } = await supabase
        .from("last_viewed")
        .upsert({
          user_id: user.id,
          section: "news",
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,section',
          ignoreDuplicates: false
        });

      if (upsertError && upsertError.code !== '23505') {
        throw upsertError;
      }

      queryClient.invalidateQueries({ queryKey: ["news-events", user.id] });

      toast({
        title: "Marcado como lido",
        description: "Notificação marcada como visualizada.",
      });

    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível marcar a notificação como lida.",
      });
    }
  };

  const handleDeleteEvent = async (event: NewsEvent) => {
    if (!user) return;

    try {
      switch (event.kind) {
        case 'attention_call':
          await supabase
            .from("attention_calls")
            .delete()
            .eq("id", event.id);
          break;
        default:
          // CORRECAO: antes caia aqui sem apagar nada e mesmo assim mostrava
          // "excluida com sucesso" — o item reaparecia no proximo refetch.
          toast({
            variant: "destructive",
            title: "Não é possível excluir",
            description: "Este tipo de notificação não pode ser removido.",
          });
          return;
      }

      queryClient.invalidateQueries({ queryKey: ["news-events", user.id] });

      toast({
        title: "Notificação removida",
        description: "A notificação foi excluída com sucesso.",
      });

    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a notificação.",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Cabeçalho */}
      <div className="relative flex flex-col items-center justify-center gap-4 mb-6 text-center">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
          <BackButton />
        </div>
        <div className="relative">

          <div className="relative p-4 rounded-full bg-primary shadow-lg">
            <Bell className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Notificador
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
            <span>Últimos 7 dias</span>
            <span className="hidden sm:inline">•</span>
            <Badge
              variant={newCount > 0 ? "default" : "outline"}
              className={cn(
                "px-2 py-1 text-xs",
                newCount > 0 && "animate-pulse"
              )}
            >
              {newCount} novo{newCount !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </div>

      {/* Container Principal de Controles */}
      <div className="flex flex-col gap-4">
        {/* Linha 1: Abas de Filtro */}
        <div className="w-full">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as NewsFilter)} className="w-full">
            <ScrollArea className="w-full pb-2">
              <TabsList className="inline-flex h-10 w-full justify-start sm:justify-center p-1 bg-muted/50">
                <TabsTrigger value="all" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                  <Bell className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Tudo</span>
                  <span className="sm:hidden">Tudo</span>
                </TabsTrigger>
                <TabsTrigger value="feed" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                  <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">World Flow</span>
                  <span className="sm:hidden">Flow</span>
                </TabsTrigger>
                <TabsTrigger value="arena" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                  <Swords className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Arena</span>
                  <span className="sm:hidden">Arena</span>
                </TabsTrigger>
                <TabsTrigger value="communities" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Comunidades</span>
                  <span className="sm:hidden">Com</span>
                </TabsTrigger>
                <TabsTrigger value="social" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                  <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Social</span>
                  <span className="sm:hidden">Soc</span>
                </TabsTrigger>
              </TabsList>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Linha 2: Botões de Ação Centralizados */}
        <div className="flex items-center justify-center gap-2 w-full mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-2 min-w-[120px]"
            disabled={isLoading}
          >
            <Loader2 className={cn("h-3 w-3", isLoading && "animate-spin")} />
            <span>{isLoading ? "Atualizando..." : "Atualizar"}</span>
          </Button>

          <Button
            variant={filter === "system" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(filter === "system" ? "all" : "system")}
            className="gap-2 min-w-[120px]"
          >
            <Shield className="h-3 w-3" />
            <span>Sistema</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 min-w-[120px]">
                <Settings className="h-3 w-3" />
                <span>Ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => markNotificationsAsRead.mutate()}
                disabled={markingAsRead || newCount === 0}
                className="gap-2"
              >
                {markingAsRead ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCheck className="h-3 w-3" />
                )}
                Marcar todas como lidas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowClearDialog(true)}
                className="gap-2"
              >
                <Trash2 className="h-3 w-3" />
                Limpar notificações antigas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Lista de notificações */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 sm:p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Carregando notificações…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-lg mb-2">Nenhuma notificação</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {filter === "all"
                ? "Nenhuma atividade nos últimos 7 dias. Interaja mais com a comunidade!"
                : `Nenhuma notificação do tipo "${filter}" nos últimos 7 dias.`}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((event) => {
              const authorName = event.kind !== 'post_approved' && event.kind !== 'post_rejected' && event.kind !== 'achievement' && event.kind !== 'community_join' && event.kind !== 'community_leave'
                ? event.author?.full_name || event.author?.username || "Usuário"
                : null;

              return (
                <div
                  key={`${event.kind}:${event.id}`}
                  className={cn(
                    "p-3 sm:p-4 hover:bg-muted/30 transition-colors group relative",
                    !event.viewed && "bg-primary/5"
                  )}
                >
                  {!event.viewed && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}

                  <div className="flex items-start gap-3">
                    {event.author?.avatar_url && (
                      <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-background">
                        <AvatarImage src={event.author.avatar_url} />
                        <AvatarFallback>
                          {event.author.username?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    {!event.author?.avatar_url && (
                      <div className="relative flex-shrink-0">
                        <div className={cn(
                          "p-2 rounded-lg",
                          getEventColor(event.kind),
                          "text-white"
                        )}>
                          {getEventIcon(event.kind)}
                        </div>
                        {!event.viewed && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {authorName && (
                              <div className="flex items-center gap-2">
                                <UserLink
                                  userId={event.author?.id || ''}
                                  username={authorName}
                                  className="font-semibold hover:underline text-sm sm:text-base"
                                >
                                  {authorName}
                                </UserLink>
                              </div>
                            )}
                            <span className="text-sm text-foreground/80">
                              {getEventDescription(event)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {timeAgo(event.created_at)}
                          </span>
                          {!event.viewed && (
                            <Badge variant="default" className="h-5 px-2 text-[10px]">
                              NOVO
                            </Badge>
                          )}
                        </div>
                      </div>

                      {renderEventContent(event)}
                      {renderEventMedia(event)}

                      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {event.kind === 'friend_request' && 'status' in event && event.status === 'pending' && (
                            <>
                              <Button size="sm" variant="default" className="h-7 text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Aceitar
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs">
                                <X className="h-3 w-3 mr-1" />
                                Recusar
                              </Button>
                            </>
                          )}

                          {event.kind === 'relationship_request' && 'status' in event && event.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                disabled={respondRelationshipRequest.isPending}
                                onClick={() => respondRelationshipRequest.mutate({ requestId: event.id, accept: true })}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Aceitar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={respondRelationshipRequest.isPending}
                                onClick={() => respondRelationshipRequest.mutate({ requestId: event.id, accept: false })}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Recusar
                              </Button>
                            </>
                          )}

                          {event.kind === 'family_request' && 'status' in event && event.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                disabled={respondFamilyRequest.isPending}
                                onClick={() => respondFamilyRequest.mutate({ requestId: event.id, accept: true })}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Aceitar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={respondFamilyRequest.isPending}
                                onClick={() => respondFamilyRequest.mutate({ requestId: event.id, accept: false })}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Recusar
                              </Button>
                            </>
                          )}

                          {event.kind === 'attention_call' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleMarkAndNavigate(event)}
                            >
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Responder
                            </Button>
                          )}

                          {(['feed_post', 'arena_post', 'community_post', 'mention', 'comment', 'reply_comment', 'like', 'like_comment', 'post_approved', 'post_rejected', 'follow', 'friend_accept', 'relationship_request_result', 'family_request_result', 'profile_visit'].includes(event.kind)) && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs"
                              onClick={() => handleMarkAndNavigate(event)}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Ver
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                          {!event.viewed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => handleMarkEventAsRead(event)}
                            >
                              <EyeOff className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">Marcar lida</span>
                              <span className="sm:hidden">Lida</span>
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2">
                                <Bookmark className="h-3 w-3" />
                                Salvar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteEvent(event)}
                                className="gap-2 text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                                Excluir
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gap-2">
                                <Flag className="h-3 w-3" />
                                Denunciar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2">
                                <Ban className="h-3 w-3" />
                                Silenciar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rodapé informativo */}
      <div className="flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground text-center">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>World Flow</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Arena</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Comunidades</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Social</span>
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Sistema</span>
          </span>
        </div>
        <p className="max-w-2xl">
          As notificações são mantidas por 7 dias. Use as ações para gerenciar suas notificações.
        </p>
      </div>

      {/* Dialog para limpar notificações */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Limpar Notificações Antigas
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="days">Remover notificações com mais de:</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="days"
                  type="number"
                  min="1"
                  max="365"
                  value={clearDays}
                  onChange={(e) => setClearDays(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Notificações mais recentes serão mantidas.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Esta ação é irreversível
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Notificações antigas serão permanentemente excluídas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              disabled={clearing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => clearOldNotifications.mutate(parseInt(clearDays))}
              disabled={clearing || !clearDays || parseInt(clearDays) < 1}
              className="gap-2"
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Limpar Notificações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visualizador de mídia */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/90 border-0">
          <div className="relative h-[80vh] flex items-center justify-center">
            {viewerUrl && (
              <>
                {viewerIsVideo ? (
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
    </div>
  );
}