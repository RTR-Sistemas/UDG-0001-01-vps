/**
 * =============================================================================
 * File: src/pages/Profile.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Camera,
  ArrowLeft,
  Settings,
  UserPlus,
  UserMinus,
  Calendar,
  Copy,
  Check,
  Heart,
  Bomb,
  MessageCircle,
  Bookmark,
  MoreVertical,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Video,
  Loader2,
  Image,
  HeartHandshake,
  FileText,
  Users,
  Swords,
} from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brazilPoliticalParties, brazilSerieATeams, genderOptions, relationshipStatusOptions } from "@/utils/profileOptions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { uploadToCloudinary } from "@/integrations/cloudinary/upload";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MovementStatusBadge } from "@/components/movement/MovementStatusBadge";
import { MoodStatusBadge } from "@/components/mood/MoodStatusBadge";
import { GoldSeal } from "@/components/GoldSeal";
import { SecurityKeyCard } from "@/components/SecurityKeyCard";
import { KeyRound, ShieldCheck, Download as DownloadIcon } from "lucide-react";


// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type MiniProfile = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

// ===== UTILS FUNCTIONS =====
const MEDIA_PREFIX = { image: "image::", video: "video::", audio: "audio::" } as const;

const isVideoUrl = (u: any): boolean => {
  if (!u || typeof u !== 'string') return false;
  return u.startsWith(MEDIA_PREFIX.video) || /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(u.split("::").pop() || u);
};

const isAudioUrl = (u: any): boolean => {
  if (!u || typeof u !== 'string') return false;
  return u.startsWith(MEDIA_PREFIX.audio) || /\.(mp3|wav|ogg|m4a)$/i.test(u.split("::").pop() || u);
};

const stripPrefix = (u: any): string => {
  if (!u) return '';
  if (typeof u !== 'string') {
    try {
      u = String(u);
    } catch {
      return '';
    }
  }
  return u.replace(/^image::|^video::|^audio::/, "");
};

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
};

const ensureMediaUrlsArray = (mediaUrls: any): string[] => {
  if (!mediaUrls) return [];
  if (Array.isArray(mediaUrls)) {
    return mediaUrls.filter((url): url is string =>
      typeof url === 'string' && url.trim() !== ''
    );
  }
  return [];
};

// ===== VIDEO PLAYER COMPONENT =====
const VideoPlayer = ({ src, className, onClick }: { src: string; className?: string; onClick?: () => void }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
    onClick?.();
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  return (
    <div className={cn("relative bg-black aspect-square group", className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="metadata"
        onEnded={() => setIsPlaying(false)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={toggleMute}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ===== POST ITEM COMPONENT =====
const PostItem = ({ post, user, onLike, onDelete, onEdit }: any) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerIsVideo, setViewerIsVideo] = useState(false);

  const isLiked = post.likes?.some((like: any) => like.user_id === user?.id);
  const isVoting = post.voting_period_active;
  const heartCount = post.post_votes?.filter((v: any) => v.vote_type === 'heart').length || 0;
  const bombCount = post.post_votes?.filter((v: any) => v.vote_type === 'bomb').length || 0;
  const totalVotes = heartCount + bombCount;
  const approvalRate = totalVotes > 0 ? (heartCount / totalVotes) * 100 : 50;

  const mediaUrls = ensureMediaUrlsArray(post.media_urls);

  const handleMediaClick = (url: string) => {
    const cleanUrl = stripPrefix(url);
    if (isVideoUrl(url)) {
      setViewerIsVideo(true);
      setViewerUrl(cleanUrl);
    } else {
      setViewerIsVideo(false);
      setViewerUrl(cleanUrl);
    }
    setViewerOpen(true);
  };

  return (
    <>
      <Card key={post.id} className={cn("border border-border/60 overflow-hidden transition-colors", isVoting ? "ring-2 ring-orange-400/50" : "hover:border-border")}>
        <CardContent className="p-0">
          {/* Cabeçalho do Post */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={post.profiles?.avatar_url} />
                <AvatarFallback>{post.profiles?.username?.[0]}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm hover:underline">{post.profiles?.username}</span>
                  {isVoting && (
                    <Badge variant="secondary" className="text-[10px] h-4 bg-orange-100 text-orange-700">
                      Em Votação
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{fmtDateTime(post.created_at)}</p>
              </div>
            </div>
            {post.user_id === user?.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(post)}>
                    <Settings className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-red-600">
                    <MoreVertical className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Conteúdo do Post */}
          {post.content && (
            <div className="px-4 pb-3 text-sm">
              {post.content}
            </div>
          )}

          {/* Mídias do Post */}
          {mediaUrls.length > 0 && (
            <div className={cn("grid gap-0.5", mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {mediaUrls.map((u: string, i: number) => {
                const url = stripPrefix(u);
                if (isVideoUrl(u)) {
                  return (
                    <VideoPlayer
                      key={i}
                      src={url}
                      className="aspect-square cursor-pointer"
                      onClick={() => handleMediaClick(u)}
                    />
                  );
                }
                return (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden bg-muted cursor-pointer group"
                    onClick={() => handleMediaClick(u)}
                  >
                    <img
                      src={url}
                      alt="Post media"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        console.error("Erro ao carregar imagem:", e);
                        e.currentTarget.src = 'https://placehold.co/400x400?text=Imagem+Indisponível';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Área de Interações */}
          <div className="p-3 flex items-center gap-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike(post.id)}
              className={cn(
                "rounded-full transition-colors",
                isLiked && "text-red-500 bg-red-50"
              )}
            >
              <Heart className={cn("h-5 w-5 mr-1", isLiked && "fill-current")} />
              {post.likes?.length || 0}
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full">
              <MessageCircle className="h-5 w-5 mr-1" />
              {post.comments?.length || 0}
            </Button>
            <div className="ml-auto">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Bookmark className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para visualizar mídia */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black/90 border-0">
          <div className="relative h-[80vh] flex items-center justify-center">
            {viewerIsVideo ? (
              <video
                src={viewerUrl || ""}
                className="max-h-full max-w-full object-contain"
                controls
                autoPlay
              />
            ) : (
              <img
                src={viewerUrl || ""}
                className="max-h-full max-w-full object-contain"
                alt="Visualização ampliada"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/800x800?text=Imagem+Indisponível';
                }}
              />
            )}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-4 right-4 rounded-full"
              onClick={() => setViewerOpen(false)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ===== MAIN PROFILE COMPONENT =====
export default function Profile() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const chatOnly = location.state?.chatOnly === true;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);

  const [editData, setEditData] = useState({
    username: "",
    full_name: "",
    bio: "",
    gender: "",
    gender_public: true,
    favorite_team: "",
    favorite_team_public: true,
    political_party: "",
    political_party_public: true,
    relationship_status: "",
    relationship_status_public: true,
    birth_date: "",
    birth_date_public: false,
    mood_status_enabled: false,
    mood_public: true,
  });

  // ===== Relacionamento: enviar pedido para outro usuário =====
  const [openRelationshipDialog, setOpenRelationshipDialog] = useState(false);
  const [relSearch, setRelSearch] = useState("");
  const [relSelectedUser, setRelSelectedUser] = useState<any | null>(null);
  const [relSelectedStatus, setRelSelectedStatus] = useState<string>("Namorando");

  useEffect(() => {
    if (!openRelationshipDialog) return;
    setRelSearch("");
    setRelSelectedUser(null);
    setRelSelectedStatus("Namorando");
  }, [openRelationshipDialog]);
  const [editingPost, setEditingPost] = useState<any>(null);
  const [editPostContent, setEditPostContent] = useState("");

  const profileId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;



  // ===== Header/Avatar =====
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const [coverH, setCoverH] = useState<number | null>(null);
  useEffect(() => {
    const recalc = () => setCoverH(avatarRef.current?.offsetHeight ?? 0);
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  // ===== Queries =====
  const { data: profile } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (error) throw error;

      if (isOwnProfile) {
        setEditData({
          username: data.username || "",
          full_name: data.full_name || "",
          bio: data.bio || "",
          // Compat: `gender` é o novo campo. Se não existir, usa o antigo.
          gender: (data as any).gender || data.sexual_orientation || "",
          gender_public: (data as any).gender_public ?? data.sexual_orientation_public ?? true,
          favorite_team: data.favorite_team || "",
          favorite_team_public: data.favorite_team_public ?? true,
          political_party: data.political_party || "",
          political_party_public: data.political_party_public ?? true,
          relationship_status: data.relationship_status || "",
          relationship_status_public: data.relationship_status_public ?? true,
          birth_date: (data as any).birth_date || "",
          birth_date_public: (data as any).birth_date_public ?? false,
          mood_status_enabled: (data as any).mood_status_enabled ?? false,
          mood_public: (data as any).mood_public ?? true,
        });
      }
      return data;
    },
    enabled: !!profileId,
  });

  // ===== Relacionamento: dados básicos do parceiro (se houver) =====
  const relationshipPartnerId = (profile as any)?.relationship_partner_id as string | undefined;
  const { data: relationshipPartner } = useQuery({
    queryKey: ["relationshipPartner", relationshipPartnerId],
    queryFn: async () => {
      if (!relationshipPartnerId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .eq("id", relationshipPartnerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!relationshipPartnerId,
  });

  // Busca de usuários para marcar relacionamento
  const { data: relCandidates, isLoading: relCandidatesLoading } = useQuery({
    queryKey: ["relCandidates", relSearch],
    queryFn: async () => {
      const q = relSearch.trim();
      if (q.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .neq("id", user?.id || "")
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && openRelationshipDialog && relSearch.trim().length >= 2,
    staleTime: 10_000,
  });

  const sendRelationshipRequest = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sem usuário");
      if (!relSelectedUser?.id) throw new Error("Selecione um usuário");
      if (relSelectedUser.id === user.id) throw new Error("Você não pode se marcar");
      const desired_status = relSelectedStatus?.trim();
      if (!desired_status) throw new Error("Selecione o status");

      const { error } = await supabase.from("relationship_requests").insert({
        sender_id: user.id,
        receiver_id: relSelectedUser.id,
        desired_status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Pedido enviado",
        description: "A pessoa vai receber o pedido em Notificações (News).",
      });
      setOpenRelationshipDialog(false);
      // Atualiza feeds/requests
      queryClient.invalidateQueries({ queryKey: ["news"] });
    },
    onError: (e: any) => {
      toast({ title: "Não foi possível enviar", description: e?.message || "Erro" });
    },
  });

  // Registra visita quando visualiza perfil de outra pessoa (RLS bloqueia quando algum dos dois desativou)
  useEffect(() => {
    if (!user?.id || !profileId || isOwnProfile) return;
    supabase
      .from("profile_visits")
      .insert({ visitor_id: user.id, visited_id: profileId })
      .then(({ error }) => {
        // se RLS bloquear, ignoramos sem poluir o console
        if (error) return;
      });
  }, [user?.id, profileId, isOwnProfile]);


  // ===== Bubbles do usuário (públicas sempre; privadas só para o próprio usuário) =====
  const { data: bubblesMembership, isLoading: bubblesLoading } = useQuery({
    queryKey: ["profileBubbles", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("community_members")
        .select(
          "community:communities!community_members_community_id_fkey(id, name, avatar_url, is_private, custom_color, custom_accent)"
        )
        .eq("user_id", profileId)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => r.community).filter(Boolean);
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });

  const visibleBubbles = useMemo(() => {
    const items: any[] = (bubblesMembership as any) || [];
    const filtered = isOwnProfile ? items : items.filter((c) => !c?.is_private);
    const seen = new Set<string>();
    const out: any[] = [];
    for (const c of filtered) {
      const id = String(c?.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(c)
    }
    return out;
  }, [bubblesMembership, isOwnProfile]);

  // Query para posts do usuário
  const { data: userPosts } = useQuery({
    queryKey: ["userPosts", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (id, username, avatar_url, full_name),
          likes (id, user_id),
          comments (id),
          post_votes (id, user_id, vote_type)
        `)
        .eq("user_id", profileId)
        .eq("is_community_approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Processar media_urls para garantir que seja um array válido
      return (data || []).map(post => ({
        ...post,
        media_urls: ensureMediaUrlsArray(post.media_urls)
      }));
    },
    enabled: !!profileId,
  });

  // Query para mídias do usuário
  const { data: userMedia } = useQuery({
    queryKey: ["userMedia", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (id, username, avatar_url, full_name),
          likes (id, user_id),
          comments (id)
        `)
        .eq("user_id", profileId)
        .eq("is_community_approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filtrar posts que têm mídias e processar media_urls
      return (data || [])
        .filter(post => {
          const urls = ensureMediaUrlsArray(post.media_urls);
          return urls.length > 0;
        })
        .map(post => ({
          ...post,
          media_urls: ensureMediaUrlsArray(post.media_urls)
        }));
    },
    enabled: !!profileId,
  });

  // Query para posts curtidos pelo usuário
  const { data: likedPosts } = useQuery({
    queryKey: ["likedPosts", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      // Primeiro, pega os IDs dos posts que o usuário curtiu
      const { data: likesData, error: likesError } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", profileId);

      if (likesError) throw likesError;

      if (!likesData || likesData.length === 0) return [];

      const postIds = likesData.map(like => like.post_id);

      // Agora busca os posts completos
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (id, username, avatar_url, full_name),
          likes (id, user_id),
          comments (id),
          post_votes (id, user_id, vote_type)
        `)
        .in("id", postIds)
        .eq("is_community_approved", true)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Processar media_urls
      return (postsData || []).map(post => ({
        ...post,
        media_urls: ensureMediaUrlsArray(post.media_urls)
      }));
    },
    enabled: !!profileId,
  });

  const { data: stats } = useQuery({
    queryKey: ["profileStats", profileId],
    queryFn: async () => {
      const [postsCount, followersCount, followingCount] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact" }).eq("user_id", profileId),
        supabase.from("followers").select("id", { count: "exact" }).eq("following_id", profileId),
        supabase.from("followers").select("id", { count: "exact" }).eq("follower_id", profileId),
      ]);
      return {
        posts: postsCount.count || 0,
        followers: followersCount.count || 0,
        following: followingCount.count || 0,
      };
    },
    enabled: !!profileId,
  });

  // ===== Contadores persistidos: aprovadas/removidas =====
  const { data: moderationStats } = useQuery({
    queryKey: ["profileModerationStats", profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_moderation_stats")
        .select("approved_count, removed_count")
        .eq("user_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return {
        approved: data?.approved_count ?? 0,
        removed: data?.removed_count ?? 0,
      };
    },
    enabled: !!profileId,
  });

  // ===== Follow state =====
  const { data: isFollowing } = useQuery({
    queryKey: ["isFollowing", profileId, user?.id],
    queryFn: async () => {
      if (!user?.id || !profileId || isOwnProfile) return false;
      const { data, error } = await supabase
        .from("followers")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id && !!profileId && !isOwnProfile,
  });

  // ===== Friendship state =====
  const { data: isFriend } = useQuery({
    queryKey: ["isFriend", user?.id, profileId],
    queryFn: async () => {
      if (!user?.id || !profileId || user?.id === profileId) return false;
      const { data, error } = await supabase
        .from("friendships")
        .select("id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${profileId}),and(user_id.eq.${profileId},friend_id.eq.${user.id})`
        )
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id && !!profileId && user?.id !== profileId,
  });

  const { data: pendingBetween } = useQuery({
    queryKey: ["pendingFriendRequestBetween", user?.id, profileId],
    queryFn: async () => {
      if (!user?.id || !profileId || user?.id === profileId) return null;
      const { data, error } = await supabase
        .from("friend_requests")
        .select("id,sender_id,receiver_id,status")
        .eq("status", "pending")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${user.id})`
        )
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!user?.id && !!profileId && user?.id !== profileId,
  });

  // ===== Follow actions =====
  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profileId) return;
      if (isFollowing) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", profileId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("followers")
          .insert({ follower_id: user.id, following_id: profileId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isFollowing", profileId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profileStats", profileId] });
      toast({
        title: isFollowing ? "Deixou de seguir" : "Seguindo!",
        description: isFollowing
          ? `Você não segue mais @${profile?.username}`
          : `Agora você segue @${profile?.username}`,
      });
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (data: typeof editData) => {
      if (!user?.id) return;

      // Some installs may not have all optional columns yet (e.g. if migrations
      // weren't applied). Sending unknown columns causes Supabase REST to
      // return 400 (Bad Request) and nothing is saved.
      const supports = {
        birth_date_public: (profile as any) && Object.prototype.hasOwnProperty.call(profile as any, "birth_date_public"),
        gender: (profile as any) && Object.prototype.hasOwnProperty.call(profile as any, "gender"),
        gender_public: (profile as any) && Object.prototype.hasOwnProperty.call(profile as any, "gender_public"),
      };

      const payload: any = {
        username: data.username?.trim() || null,
        full_name: data.full_name?.trim() || null,
        bio: data.bio?.trim() || null,
        // Novo: Gênero. Mantemos compatibilidade gravando também em `sexual_orientation`.
        gender: data.gender || null,
        gender_public: !!data.gender_public,
        sexual_orientation: data.gender || null,
        sexual_orientation_public: !!data.gender_public,
        favorite_team: data.favorite_team || null,
        favorite_team_public: !!data.favorite_team_public,
        political_party: data.political_party || null,
        political_party_public: !!data.political_party_public,
        relationship_status: data.relationship_status || null,
        relationship_status_public: !!data.relationship_status_public,
        birth_date: data.birth_date || null,
        birth_date_public: !!data.birth_date_public,
      };

      // If the column does not exist in this database, remove it from the payload.
      if (!supports.birth_date_public) delete payload.birth_date_public;

      // If gender columns don't exist, fall back to the older fields only.
      if (!supports.gender) delete payload.gender;
      if (!supports.gender_public) delete payload.gender_public;

      // Evita gravar username como null (campo NOT NULL no schema atual)
      // Prefer: if the user erased the username, keep the current one instead
      // of trying to write an empty string (which can violate unique constraints).
      if (!payload.username) {
        delete payload.username;
      }

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Refresh the profile query used by this page.
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      setIsEditing(false);
      toast({ title: "Perfil atualizado!", description: "Suas alterações foram salvas." });
    },
    onError: (e: any) => {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Não foi possível salvar",
        description: e?.message || "Verifique os dados e tente novamente.",
      });
    },
  });

  // ===== Avatar upload =====
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile) return;
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      const { url } = await uploadToCloudinary(file, {
        kind: "profiles",
        userId: user.id,
        folder: `profiles/${user.id}`,
      });
      // CORRECAO: o supabase-js devolve { error } em vez de lancar, entao o
      // catch abaixo nunca disparava. Uma falha de RLS/sessao expirada dava
      // "Foto atualizada!" e a foto antiga continuava la depois do refetch.
      const { error: avatarError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (avatarError) throw avatarError;
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível fazer upload da imagem." });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
    toast({ title: "Foto atualizada!", description: "Sua foto de perfil foi alterada." });
  };

  // ===== Amizade: adicionar/aceitar (com RPC) =====
  const addOrAcceptFriend = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profileId || user.id === profileId) throw new Error("Operação inválida.");

      const { data: already, error: fErr } = await supabase
        .from("friendships")
        .select("id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${profileId}),and(user_id.eq.${profileId},friend_id.eq.${user.id})`
        )
        .maybeSingle();
      if (fErr) throw fErr;
      if (already) return { action: "already-friends" as const };

      const { data: pending, error: pErr } = await supabase
        .from("friend_requests")
        .select("id,sender_id,receiver_id,status")
        .eq("status", "pending")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${profileId}),and(sender_id.eq.${profileId},receiver_id.eq.${user.id})`
        )
        .maybeSingle();
      if (pErr) throw pErr;

      if (pending && pending.sender_id === profileId && pending.receiver_id === user.id) {
        const { error: rpcErr } = await supabase.rpc("create_friendship_pair", { a: user.id, b: profileId });
        if (rpcErr) {
          const { error: ins1 } = await supabase
            .from("friendships")
            .insert({ user_id: user.id, friend_id: profileId });
          if (ins1) throw rpcErr;
        }

        const { error: upd } = await supabase
          .from("friend_requests")
          .update({ status: "accepted" })
          .eq("id", pending.id);
        if (upd) throw upd;

        return { action: "accepted" as const };
      }

      if (pending && pending.sender_id === user.id && pending.receiver_id === profileId) {
        return { action: "already-pending" as const };
      }

      const { data: fr, error: reqErr } = await supabase
        .from("friend_requests")
        .insert({
          sender_id: user.id,
          receiver_id: profileId,
          status: "pending",
        })
        .select('id')
        .single();
      if (reqErr) throw reqErr;

      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente ao INSERT em friend_requests.

      return { action: "requested" as const };
    },
    onSuccess: ({ action }) => {
      queryClient.invalidateQueries({ queryKey: ["pendingFriendRequestBetween", user?.id, profileId] });
      queryClient.invalidateQueries({ queryKey: ["isFriend", user?.id, profileId] });

      if (action === "accepted") {
        toast({ title: "Amizade confirmada!", description: "Vocês agora são amigos." });
      } else if (action === "already-pending") {
        toast({ title: "Solicitação já enviada", description: "Aguarde a confirmação do usuário." });
      } else if (action === "requested") {
        toast({ title: "Solicitação enviada!", description: "O usuário foi notificado." });
      } else if (action === "already-friends") {
        toast({ title: "Vocês já são amigos", description: "Nada a fazer por aqui." });
      }
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Não foi possível enviar a solicitação",
        description: err?.message ?? "Tente novamente.",
      });
    },
  });

  // ===== Remover amigo (com RPC) =====
  const removeFriend = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profileId) throw new Error("Operação inválida.");
      const { error: rpcErr } = await supabase.rpc("remove_friendship_pair", { a: user.id, b: profileId });
      if (rpcErr) {
        const { error: del1 } = await supabase
          .from("friendships")
          .delete()
          .eq("user_id", user.id)
          .eq("friend_id", profileId);
        if (del1) throw rpcErr;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["isFriend", user?.id, profileId] }),
        queryClient.invalidateQueries({ queryKey: ["pendingFriendRequestBetween", user?.id, profileId] }),
      ]);
      toast({ title: "Amizade removida", description: "Vocês não são mais amigos." });
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Não foi possível remover",
        description: err?.message ?? "Tente novamente.",
      });
    },
  });

  // ===== Followers / Following MODALS =====
  const [openFollowers, setOpenFollowers] = useState(false);
  const [openFollowing, setOpenFollowing] = useState(false);

  const { data: followersList, isLoading: loadingFollowers } = useQuery({
    queryKey: ["followersList", profileId, openFollowers],
    enabled: !!profileId && openFollowers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select(
          "follower:profiles!followers_follower_id_fkey(id, username, full_name, avatar_url)"
        )
        .eq("following_id", profileId);
      if (error) throw error;
      const list: MiniProfile[] = (data || [])
        .map((r: any) => r.follower)
        .filter(Boolean);
      return list.sort((a, b) => a.username.localeCompare(b.username));
    },
  });

  const { data: followingList, isLoading: loadingFollowing } = useQuery({
    queryKey: ["followingList", profileId, openFollowing],
    enabled: !!profileId && openFollowing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select(
          "following:profiles!followers_following_id_fkey(id, username, full_name, avatar_url)"
        )
        .eq("follower_id", profileId);
      if (error) throw error;
      const list: MiniProfile[] = (data || [])
        .map((r: any) => r.following)
        .filter(Boolean);
      return list.sort((a, b) => a.username.localeCompare(b.username));
    },
  });

  // Navegar para perfil ao clicar num usuário da lista
  const goToProfile = (id: string) => {
    setOpenFollowers(false);
    setOpenFollowing(false);
    navigate(`/profile/${id}`);
  };

  // ===== Opcional: copiar UDG do próprio perfil =====
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!profile?.friend_code) return;
    try {
      await navigator.clipboard.writeText(profile.friend_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { }
  };

  // ===== Ações nos posts =====
  const handleLike = async (postId: string) => {
    try {
      const allPosts = [...(userPosts || []), ...(likedPosts || []), ...(userMedia || [])];
      const post = allPosts.find(p => p.id === postId);
      const has = post?.likes?.find((l: any) => l.user_id === user?.id);

      // CORRECAO: erro do supabase vem em { error }; sem checar, curtir/descurtir
      // bloqueado por RLS nao mostrava nada e o coracao so voltava ao estado
      // anterior, parecendo bug de interface.
      let likeError: any = null;
      if (has) {
        ({ error: likeError } = await supabase.from("likes").delete().match({ id: has.id }));
      } else {
        ({ error: likeError } = await supabase.from("likes").insert({ post_id: postId, user_id: user?.id }));
      }
      if (likeError) throw likeError;

      // Invalida todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["userPosts", profileId] });
      queryClient.invalidateQueries({ queryKey: ["userMedia", profileId] });
      queryClient.invalidateQueries({ queryKey: ["likedPosts", profileId] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao curtir",
        description: "Não foi possível processar sua ação."
      });
    }
  };

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Post excluído" });
      // Invalida todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["userPosts", profileId] });
      queryClient.invalidateQueries({ queryKey: ["userMedia", profileId] });
      queryClient.invalidateQueries({ queryKey: ["likedPosts", profileId] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: "Não foi possível excluir o post."
      });
    }
  });

  const updatePost = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const { error } = await supabase
        .from("posts")
        .update({ content })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Post atualizado" });
      setEditingPost(null);
      setEditPostContent("");
      // Invalida todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["userPosts", profileId] });
      queryClient.invalidateQueries({ queryKey: ["userMedia", profileId] });
      queryClient.invalidateQueries({ queryKey: ["likedPosts", profileId] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o post."
      });
    }
  });

  const handleEditPost = (post: any) => {
    setEditingPost(post);
    setEditPostContent(post.content || "");
  };

  // ===== Renderização da aba de mídia =====
  const renderMediaTab = () => {
    if (!userMedia || userMedia.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma mídia ainda</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {userMedia.flatMap((post: any) => {
          const mediaUrls = ensureMediaUrlsArray(post.media_urls);
          return mediaUrls.map((mediaUrl: string, index: number) => {
            const url = stripPrefix(mediaUrl);
            const isVideo = isVideoUrl(mediaUrl);

            return (
              <div
                key={`${post.id}-${index}`}
                className="relative aspect-square overflow-hidden rounded-lg bg-muted cursor-pointer group"
                onClick={() => {
                  if (isVideo) {
                    setViewerUrl(url);
                    setViewerIsVideo(true);
                    setViewerOpen(true);
                  } else {
                    setViewerUrl(url);
                    setViewerIsVideo(false);
                    setViewerOpen(true);
                  }
                }}
              >
                {isVideo ? (
                  <>
                    <video
                      src={url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-12 w-12 text-white/80" />
                    </div>
                    <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                      <Video className="h-4 w-4 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <img
                      src={url}
                      alt={`Mídia do post ${post.id}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        console.error("Erro ao carregar imagem:", e);
                        e.currentTarget.src = 'https://placehold.co/400x400?text=Imagem+Indisponível';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                      <Image className="h-4 w-4 text-white" />
                    </div>
                  </>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full bg-black/50 text-white hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike(post.id);
                    }}
                  >
                    <Heart className={cn("h-3 w-3", post.likes?.some((l: any) => l.user_id === user?.id) && "fill-current")} />
                  </Button>
                  <span className="text-xs text-white bg-black/50 px-2 py-1 rounded-full">
                    {post.likes?.length || 0}
                  </span>
                </div>
              </div>
            );
          });
        })}
      </div>
    );
  };

  // Estados para viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerIsVideo, setViewerIsVideo] = useState(false);

  // Seção do perfil aberta no popup (posts | media | likes | debates | bubbles)
  const [activeProfileTab, setActiveProfileTab] = useState<string | null>(null);

  return (
    <div className="min-h-[100dvh] pb-20 bg-background text-foreground">
      {/* HEADER */}
      <div className="relative">
        <div className="bg-gradient-to-r from-primary via-secondary to-accent h-32 sm:h-40 md:h-48" />

        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 sm:top-4 sm:left-4 h-9 w-9 rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm z-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-16 sm:-bottom-20">
          <div ref={avatarRef} className="relative">
            <Avatar className="h-28 w-28 sm:h-32 sm:w-32 md:h-40 md:w-40 border-4 border-background shadow-sm">
              <AvatarImage src={profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl sm:text-4xl">
                {profile?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {isOwnProfile && (
              <label className="absolute -bottom-1 -right-1 p-2 rounded-full bg-primary text-white cursor-pointer hover:bg-primary/90 transition-colors shadow-sm">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className={cn("mt-20 sm:mt-24 grid gap-6", !chatOnly ? "grid-cols-1 md:grid-cols-[1fr_300px]" : "grid-cols-1 max-w-2xl mx-auto")}>
          {/* COLUNA PRINCIPAL */}
          <div className="space-y-6">
            {isEditing ? (
              <div className="space-y-4 bg-card p-4 rounded-lg border shadow-sm w-full">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Editar perfil</h2>
                    <p className="text-sm text-muted-foreground">Atualize seus dados e defina o que fica público.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Nome de usuário</Label>
                    <Input value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })} rows={3} />
                  </div>
                </div>

                {!chatOnly && (
                <div className="mt-2 rounded-lg border bg-background/50 p-3">
                  <h3 className="text-sm font-semibold mb-3">Informações adicionais</h3>

                  <div className="space-y-4">
                    {/* Gênero */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="space-y-2">
                        <Label>Gênero</Label>
                        <Select
                          value={editData.gender || ""}
                          onValueChange={(v) => setEditData({ ...editData, gender: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {genderOptions.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between sm:justify-center gap-2">
                        <Label className="text-xs text-muted-foreground">Público</Label>
                        <Switch
                          checked={!!editData.gender_public}
                          onCheckedChange={(checked) =>
                            setEditData({ ...editData, gender_public: checked })
                          }
                        />
                      </div>
                    </div>

                    {/* Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="space-y-2">
                        <Label>Time (Série A)</Label>
                        <Select
                          value={editData.favorite_team || ""}
                          onValueChange={(v) => setEditData({ ...editData, favorite_team: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {brazilSerieATeams.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between sm:justify-center gap-2">
                        <Label className="text-xs text-muted-foreground">Público</Label>
                        <Switch
                          checked={!!editData.favorite_team_public}
                          onCheckedChange={(checked) =>
                            setEditData({ ...editData, favorite_team_public: checked })
                          }
                        />
                      </div>
                    </div>

                    {/* Partido */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="space-y-2">
                        <Label>Partido político</Label>
                        <Select
                          value={editData.political_party || ""}
                          onValueChange={(v) => setEditData({ ...editData, political_party: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {brazilPoliticalParties.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between sm:justify-center gap-2">
                        <Label className="text-xs text-muted-foreground">Público</Label>
                        <Switch
                          checked={!!editData.political_party_public}
                          onCheckedChange={(checked) =>
                            setEditData({ ...editData, political_party_public: checked })
                          }
                        />
                      </div>
                    </div>

                    {/* Relacionamento */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="space-y-2">
                        <Label>Status de relacionamento</Label>
                        <Select
                          value={editData.relationship_status || ""}
                          onValueChange={(v) => setEditData({ ...editData, relationship_status: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {relationshipStatusOptions.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between sm:justify-center gap-2">
                        <Label className="text-xs text-muted-foreground">Público</Label>
                        <Switch
                          checked={!!editData.relationship_status_public}
                          onCheckedChange={(checked) =>
                            setEditData({ ...editData, relationship_status_public: checked })
                          }
                        />
                      </div>
                    </div>

                    {/* Data de nascimento */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="space-y-2">
                        <Label>Data de nascimento</Label>
                        <Input
                          type="date"
                          value={(editData as any).birth_date || ""}
                          onChange={(e) => setEditData({ ...editData, birth_date: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Você pode deixar como privado se não quiser que outras pessoas vejam.
                        </p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-center gap-2">
                        <Label className="text-xs text-muted-foreground">Público</Label>
                        <Switch
                          checked={!!(editData as any).birth_date_public}
                          onCheckedChange={(checked) =>
                            setEditData({ ...editData, birth_date_public: checked })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button onClick={() => updateProfile.mutate(editData)} className="bg-gradient-to-r from-primary to-secondary">Salvar</Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* CARTAO PRINCIPAL */}
                <Card className="bg-card/70 shadow-sm">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">{profile?.full_name || profile?.username}</h1>
                          {(profile as any)?.registration_number ? (
                            <GoldSeal registrationNumber={(profile as any).registration_number} size="md" />
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">@{profile?.username}</p>

                        {profile?.bio ? (
                          <>
                            <p className="mt-3 text-sm text-foreground whitespace-pre-line">{profile.bio}</p>

                            {!isOwnProfile && (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                {profile?.movement_status_enabled && (
                                  <MovementStatusBadge userId={profile.id} />
                                )}
                                {profile?.mood_status_enabled && profile?.mood_public && (
                                  <MoodStatusBadge userId={profile.id} viewerId={user?.id ?? null} />
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">Sem bio</p>
                        )}

                        {isOwnProfile && profile?.friend_code && (
                          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs">
                            <span className="font-medium">Código UDG:</span>
                            <code className="font-mono">{profile.friend_code}</code>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopy} title="Copiar código">
                              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        )}

                        {isOwnProfile && (profile as any)?.registration_number && (
                          <SecurityKeyCard
                            profileId={profile.id}
                            registrationNumber={(profile as any).registration_number}
                          />
                        )}
                      </div>

                      {/* MINI STATS */}
                      {!chatOnly && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <div className="text-lg font-bold">{stats?.posts || 0}</div>
                          <div className="text-xs text-muted-foreground">Posts</div>
                        </div>
                        <button className="text-center" onClick={() => setOpenFollowers(true)} title="Ver seguidores">
                          <div className="text-lg font-bold hover:underline">{stats?.followers || 0}</div>
                          <div className="text-xs text-muted-foreground">Seguidores</div>
                        </button>
                        <button className="text-center" onClick={() => setOpenFollowing(true)} title="Ver seguindo">
                          <div className="text-lg font-bold hover:underline">{stats?.following || 0}</div>
                          <div className="text-xs text-muted-foreground">Seguindo</div>
                        </button>
                      </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* INFORMACOES (respeita publico/privado) */}
                {!chatOnly && (() => {
                  const genderValue = (profile as any)?.gender || (profile as any)?.sexual_orientation;
                  const genderPublic = (profile as any)?.gender_public ?? (profile as any)?.sexual_orientation_public;
                  const rows: Array<{ key: string; label: string; value: any; isPublic: boolean | null | undefined }> = [
                    { key: "gender", label: "Gênero", value: genderValue, isPublic: genderPublic },
                    { key: "favorite_team", label: "Time", value: (profile as any)?.favorite_team, isPublic: (profile as any)?.favorite_team_public },
                    { key: "political_party", label: "Partido", value: (profile as any)?.political_party, isPublic: (profile as any)?.political_party_public },
                    { key: "relationship", label: "Relacionamento", value: (profile as any)?.relationship_status, isPublic: (profile as any)?.relationship_status_public },
                    {
                      key: "birth_date",
                      label: "Data de nascimento",
                      value: (profile as any)?.birth_date
                        ? new Date((profile as any).birth_date + "T00:00:00").toLocaleDateString("pt-BR")
                        : null,
                      isPublic: (profile as any)?.birth_date_public,
                    },
                  ];
                  const visible = rows.filter((r) => !!r.value && (isOwnProfile || !!r.isPublic));
                  if (visible.length === 0) return null;

                  return (
                    <Card className="bg-card/60">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Informações</div>
                          {isOwnProfile ? (
                            <div className="text-xs text-muted-foreground">Privado = só você vê</div>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          {rows.map((r) => {
                            const show = !!r.value && (isOwnProfile || !!r.isPublic);
                            if (!show) return null;
                            return (
                              <div key={r.key} className="flex items-center justify-between gap-3 rounded-md border bg-background/40 px-3 py-2">
                                <div className="min-w-0">
                                  <div className="text-xs text-muted-foreground">{r.label}</div>
                                  {r.key === "relationship" && relationshipPartner ? (
                                    <div className="mt-1 flex items-center gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={relationshipPartner.avatar_url || ""} />
                                        <AvatarFallback>{(relationshipPartner.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                                      </Avatar>
                                      <div className="text-sm font-medium truncate">{relationshipPartner.full_name || `@${relationshipPartner.username}`}</div>
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-sm font-medium truncate">{r.value}</div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {r.key === "relationship" ? (
                                    <Badge variant="secondary" className="text-xs">{(profile as any)?.relationship_status}</Badge>
                                  ) : null}
                                  {isOwnProfile && !r.isPublic ? (
                                    <Badge variant="secondary" className="text-xs">Privado</Badge>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            )}
          </div>

          {/* COLUNA LATERAL */}
          <div className="space-y-4">
            {!isEditing && (
              <Card className="bg-card/70">
                <CardContent className="p-4 space-y-2">
                  <div className="text-sm font-semibold">Ações</div>
                  <div className="flex flex-col gap-2">
                    {isOwnProfile ? (
                      <>
                        <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full justify-start">
                          <Settings className="h-4 w-4 mr-2" />
                          Editar perfil
                        </Button>
                        {!chatOnly && (
                        <Button onClick={() => setOpenRelationshipDialog(true)} variant="outline" className="w-full justify-start">
                          <HeartHandshake className="h-4 w-4 mr-2" />
                          Relacionamento
                        </Button>
                        )}
                        {!chatOnly && relationshipPartner && (profile as any)?.relationship_status ? (
                          <div className="flex items-center gap-2 rounded-md border bg-background/40 px-3 py-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={relationshipPartner.avatar_url || ""} />
                              <AvatarFallback>{(relationshipPartner.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{relationshipPartner.full_name || `@${relationshipPartner.username}`}</div>
                              <div className="text-xs text-muted-foreground truncate">{(profile as any)?.relationship_status}</div>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => followMutation.mutate()}
                          disabled={followMutation.isPending}
                          variant={isFollowing ? "outline" : "default"}
                          className="w-full justify-start"
                        >
                          {isFollowing ? (
                            <>
                              <UserMinus className="h-4 w-4 mr-2" />
                              Deixar de seguir
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Seguir
                            </>
                          )}
                        </Button>

                        {isFriend ? (
                          <Button
                            variant="outline"
                            className="w-full justify-start mt-2"
                            onClick={() => removeFriend.mutate()}
                            disabled={removeFriend.isPending}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Remover amigo
                          </Button>
                        ) : pendingBetween && pendingBetween.sender_id === user?.id ? (
                          <Button className="w-full mt-2" disabled>
                            Solicitação enviada
                          </Button>
                        ) : (
                          <Button
                            className="w-full justify-start mt-2"
                            onClick={() => addOrAcceptFriend.mutate()}
                            disabled={addOrAcceptFriend.isPending}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Adicionar como amigo
                          </Button>
                        )}


                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {!chatOnly && (
            <Card className="bg-card/60">
              <CardContent className="p-4">
                <div className="text-sm font-semibold mb-3">Moderação</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Heart className="h-4 w-4" />
                      <span className="font-semibold">{moderationStats?.approved ?? 0}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Aprovadas</div>
                  </div>
                  <div className="rounded-md border bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Bomb className="h-4 w-4" />
                      <span className="font-semibold">{moderationStats?.removed ?? 0}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Removidas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

          </div>
        </div>

        {/* SEÇÕES DO PERFIL: CARDS + POPUP */}
        {!chatOnly && (
          <>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { key: "posts", label: "Posts", icon: FileText },
                { key: "media", label: "Mídia", icon: Image },
                { key: "likes", label: "Curtidas", icon: Heart },
                { key: "bubbles", label: "Comunidades", icon: Users },
              ].map((sec) => {
                const count =
                  sec.key === "posts" ? userPosts?.length
                  : sec.key === "media" ? userMedia?.length
                  : sec.key === "likes" ? likedPosts?.length
                  : sec.key === "bubbles" ? visibleBubbles?.length
                  : undefined;
                const Icon = sec.icon;
                return (
                  <Card
                    key={sec.key}
                    className="bg-card/60 cursor-pointer hover:bg-card hover:border-primary/40 transition-colors border-border/60"
                  >
                    <button
                      type="button"
                      className="w-full h-full text-left"
                      onClick={() => setActiveProfileTab(sec.key)}
                    >
                      <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center">
                        <div className="p-2 rounded-full bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-semibold leading-tight">{sec.label}</span>
                        {typeof count === "number" && (
                          <span className="text-xs text-muted-foreground">{count}</span>
                        )}
                      </CardContent>
                    </button>
                  </Card>
                );
              })}
            </div>

            {/* POPUP DA SEÇÃO SELECIONADA (fecha ao clicar fora) */}
            <Dialog
              open={!!activeProfileTab}
              onOpenChange={(open) => { if (!open) setActiveProfileTab(null); }}
            >
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader className="pb-3">
                  <DialogTitle>
                    {activeProfileTab === "posts" ? "Posts"
                      : activeProfileTab === "media" ? "Mídia"
                      : activeProfileTab === "likes" ? "Curtidas"
                      : activeProfileTab === "bubbles" ? "Comunidades"
                      : ""}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-1">
                  {activeProfileTab === "posts" && (
                    userPosts?.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Nenhum post ainda</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userPosts?.map((post: any) => (
                          <PostItem
                            key={post.id}
                            post={post}
                            user={user}
                            onLike={handleLike}
                            onDelete={deletePost.mutate}
                            onEdit={handleEditPost}
                          />
                        ))}
                      </div>
                    )
                  )}
                  {activeProfileTab === "media" && renderMediaTab()}
                  {activeProfileTab === "likes" && (
                    likedPosts?.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Nenhuma curtida ainda</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {likedPosts?.map((post: any) => (
                          <PostItem
                            key={post.id}
                            post={post}
                            user={user}
                            onLike={handleLike}
                            onDelete={deletePost.mutate}
                            onEdit={handleEditPost}
                          />
                        ))}
                      </div>
                    )
                  )}
                  {activeProfileTab === "bubbles" && (
                    bubblesLoading ? (
                      <div className="text-center py-12 text-muted-foreground">Carregando...</div>
                    ) : (
                      visibleBubbles?.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {visibleBubbles.map((c: any) => (
                            <Card key={c.id} className="bg-card/60">
                              <CardContent className="p-4 flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={c.avatar_url || ''} />
                                  <AvatarFallback>{(c.name || 'B')[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{c.name}</div>
                                  {isOwnProfile && c.is_private ? (
                                    <div className="text-xs text-muted-foreground">Privada</div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground">Pública</div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <p>Nenhuma comunidade para mostrar.</p>
                          {!isOwnProfile && (
                            <p className="text-xs mt-2">Apenas comunidades públicas aparecem em perfis de outras pessoas.</p>
                          )}
                        </div>
                      )
                    )
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* ===== Modais de Seguidores / Seguindo ===== */}
      <Dialog open={openFollowers} onOpenChange={setOpenFollowers}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seguidores</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-3">
            {loadingFollowers ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (followersList?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum seguidor.</p>
            ) : (
              followersList!.map((p) => (
                <button
                  key={p.id}
                  onClick={() => goToProfile(p.id)}
                  className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-muted text-left"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p.avatar_url || ""} />
                    <AvatarFallback>{p.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.full_name || p.username}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openFollowing} onOpenChange={setOpenFollowing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seguindo</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-3">
            {loadingFollowing ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (followingList?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Não está seguindo ninguém.</p>
            ) : (
              followingList!.map((p) => (
                <button
                  key={p.id}
                  onClick={() => goToProfile(p.id)}
                  className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-muted text-left"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p.avatar_url || ""} />
                    <AvatarFallback>{p.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.full_name || p.username}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Modal: Marcar Relacionamento ===== */}
      <Dialog open={openRelationshipDialog} onOpenChange={setOpenRelationshipDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relacionamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={relSelectedStatus} onValueChange={setRelSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {relationshipStatusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ao enviar, a pessoa recebe um pedido em Notificações (News) e pode aceitar ou recusar.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Marcar usuário</Label>
              <Input
                value={relSearch}
                onChange={(e) => setRelSearch(e.target.value)}
                placeholder="Buscar por @username ou nome..."
              />
              <div className="rounded-md border bg-card max-h-[260px] overflow-auto">
                {relSearch.trim().length < 2 ? (
                  <div className="p-3 text-sm text-muted-foreground">Digite pelo menos 2 caracteres.</div>
                ) : relCandidatesLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
                ) : (relCandidates?.length ?? 0) === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
                ) : (
                  <div className="divide-y">
                    {relCandidates!.map((p: any) => {
                      const selected = relSelectedUser?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setRelSelectedUser(p)}
                          className={cn(
                            "flex w-full items-center gap-3 p-3 text-left hover:bg-muted",
                            selected && "bg-muted"
                          )}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.avatar_url || ""} />
                            <AvatarFallback>{(p.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{p.full_name || `@${p.username}`}</div>
                            <div className="text-xs text-muted-foreground truncate">@{p.username}</div>
                          </div>
                          {selected && <Check className="ml-auto h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {relSelectedUser && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Selecionado:</span>
                  <span className="font-medium">{relSelectedUser.full_name || `@${relSelectedUser.username}`}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenRelationshipDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => sendRelationshipRequest.mutate()}
                disabled={sendRelationshipRequest.isPending || !relSelectedUser}
              >
                {sendRelationshipRequest.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </span>
                ) : (
                  "Enviar pedido"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* Modal de edição de post */}
      <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Post</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editPostContent}
            onChange={(e) => setEditPostContent(e.target.value)}
            placeholder="Edite seu post..."
            className="min-h-[100px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingPost(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingPost) {
                  updatePost.mutate({ postId: editingPost.id, content: editPostContent });
                }
              }}
              disabled={updatePost.isPending}
            >
              {updatePost.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}