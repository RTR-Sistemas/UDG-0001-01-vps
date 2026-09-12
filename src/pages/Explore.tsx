/**
 * =============================================================================
 * File: src/pages/Explore.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserLink } from "@/components/UserLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Heart, MessageCircle, Share2, Bookmark, 
  MoreHorizontal, TrendingUp, Globe, Film, Play,
  Volume2, VolumeX, Clock, X, Menu,
  ChevronLeft, ChevronRight, Loader2, ArrowLeft,
  Users, Compass, Hash, UserPlus
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MentionText } from "@/components/MentionText";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


/* ---------- FUNÇÕES AUXILIARES ---------- */
const stripPrefix = (url: string): string => {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/^(image::|video::|audio::)/, "");
};

const isVideoUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = stripPrefix(url);
  const videoExtensions = /\.(mp4|webm|ogg|mov|m4v|avi|mkv|flv|wmv)$/i;
  return url.startsWith('video::') || videoExtensions.test(cleanUrl);
};

/* ---------- COMPONENTE VIDEO PLAYER ---------- */
interface VideoPlayerProps {
  src: string;
  className?: string;
}

const VideoPlayer = ({ src, className }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={cn("relative w-full h-full bg-black rounded-lg overflow-hidden", className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        loop
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onClick={togglePlay}
      />
      
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
          <div className="bg-black/50 rounded-full p-4">
            <Play className="h-10 w-10 text-white/80" />
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/50">
        <div 
          className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="absolute bottom-4 right-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

/* ---------- MODAL DE MIDIA EM TELA CHEIA ---------- */
interface MediaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string | null;
  post: any;
}

const MediaModal = ({ open, onOpenChange, mediaUrl, post }: MediaModalProps) => {
  if (!mediaUrl || !post) return null;

  const isVideo = isVideoUrl(mediaUrl);
  const cleanUrl = stripPrefix(mediaUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border text-foreground max-w-7xl w-full h-[90vh] p-0 overflow-hidden">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent md:from-white/80 md:to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-tr from-blue-500 to-purple-500">
                    {post.profiles?.username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <UserLink 
                    userId={post.user_id} 
                    username={post.profiles?.username || ''}
                    className="font-bold text-white hover:text-blue-400 md:text-gray-900 md:hover:text-blue-600"
                  >
                    @{post.profiles?.username}
                  </UserLink>
                  <p className="text-xs text-gray-400 md:text-gray-600">
                    {new Date(post.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 md:text-gray-900 md:hover:bg-gray-100"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Media Content */}
          <div className="flex-1 flex items-center justify-center bg-black p-4 md:bg-white">
            {isVideo ? (
              <video
                src={cleanUrl}
                className="w-full h-full max-h-[80vh] object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={cleanUrl}
                alt="Post media"
                className="w-full h-full max-h-[80vh] object-contain"
              />
            )}
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent md:from-white/80 md:to-transparent">
            {post.content && (
              <p className="text-white text-sm mb-3 md:text-gray-900">{post.content}</p>
            )}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span className="text-white text-sm md:text-gray-900">{post.likes?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                <span className="text-white text-sm md:text-gray-900">{post.comments?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function Explore() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const isSearching = searchQuery.trim().length > 0 || selectedTag !== null;

  const { data: posts, isLoading: isLoadingPosts, refetch: refetchPosts } = useQuery({
    queryKey: ["explore-posts", searchQuery, selectedTag],
    enabled: isSearching,
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          likes (id, user_id),
          comments (id)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (searchQuery) {
        query = query.ilike("content", `%${searchQuery}%`);
      }

      if (selectedTag) {
        const cleanTag = selectedTag.replace('#', '');
        query = query.ilike("content", `%#${cleanTag}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching posts:", error);
        throw error;
      }
      
      // Garantir que media_urls seja um array válido
      return (data || []).map(post => ({
        ...post,
        media_urls: Array.isArray(post.media_urls) 
          ? post.media_urls.filter(url => url && typeof url === 'string').map(url => url.trim())
          : []
      }));
    },
  });

  const { data: trendingTags, isLoading: isLoadingTags } = useQuery({
    queryKey: ["trending-tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("content")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching trending tags:", error);
        throw error;
      }

      const tagCounts: Record<string, number> = {};
      data?.forEach((post) => {
        const hashtags = post.content?.match(/#[\w\u00C0-\u00FF]+/g) || [];
        hashtags.forEach((tag) => {
          const cleanTag = tag.toLowerCase();
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        });
      });

      return Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([tag, count]) => ({ tag, count }));
    },
  });

  const { data: suggestedUsers } = useQuery({
    queryKey: ["explore-suggested-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .neq("avatar_url", null)
        .limit(4);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: suggestedBubbles } = useQuery({
    queryKey: ["explore-suggested-communities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, avatar_url, description")
        .eq("is_private", false)
        .limit(4);
      if (error) {
         console.error("Erro bubbles:", error);
         return [];
      }
      return data || [];
    },
  });

  const { data: viralClips } = useQuery({
    queryKey: ["explore-viral-clips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(`
          id, content, media_urls, created_at, user_id, post_type,
          profiles:user_id (username, avatar_url)
        `)
        .eq("post_type", "viral_clips")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) {
         console.error("Erro viralClips:", error);
         return [];
      }
      // Guarantee valid array
      return (data || []).map(post => ({
        ...post,
        media_urls: Array.isArray(post.media_urls) 
          ? post.media_urls.filter((url: any) => url && typeof url === 'string').map((url: string) => url.trim())
          : []
      }));
    },
  });

  const { data: searchedUsers, isLoading: isLoadingSearchedUsers } = useQuery({
    queryKey: ["explore-search-users", searchQuery],
    enabled: isSearching && searchQuery.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(5);
      if (error) {
        console.error("Error fetching searched users:", error);
        return [];
      }
      return data || [];
    },
  });

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("explore-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => refetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, () => refetchPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => refetchPosts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchPosts]);

  const toggleLike = async (postId: string, isLiked: boolean) => {
    if (!user) {
      toast({
        title: "Ação necessária",
        description: "Você precisa estar logado para curtir posts",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isLiked) {
        await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
      }
      refetchPosts();
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a curtida",
        variant: "destructive",
      });
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const handleTagClick = (tag: string) => {
    const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
    setSelectedTag(cleanTag);
  };

  const clearTagFilter = () => {
    setSelectedTag(null);
  };

  const handleMediaClick = (post: any, mediaUrl: string) => {
    setSelectedPost(post);
    setSelectedMediaUrl(mediaUrl);
    setMediaModalOpen(true);
  };

  const renderMediaGrid = (post: any) => {
    const mediaUrls = post.media_urls || [];
    if (mediaUrls.length === 0) return null;

    if (mediaUrls.length === 1) {
      const mediaUrl = stripPrefix(mediaUrls[0]);
      const isVideo = isVideoUrl(mediaUrls[0]);
      
      return (
        <div 
          className="relative rounded-lg overflow-hidden mt-3 cursor-pointer bg-black"
          onClick={() => handleMediaClick(post, mediaUrls[0])}
        >
          {isVideo ? (
            <VideoPlayer src={mediaUrl} className="h-64 sm:h-80 md:h-96" />
          ) : (
            <img
              src={mediaUrl}
              alt="Post media"
              className="w-full h-64 sm:h-80 md:h-96 object-contain bg-black"
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          )}
          {isVideo && (
            <div className="absolute top-2 right-2 bg-black/50 rounded-full p-2 md:bg-black/30">
              <Film className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={cn(
        "grid gap-2 rounded-lg overflow-hidden mt-3",
        mediaUrls.length === 2 && "grid-cols-2",
        mediaUrls.length >= 3 && "grid-cols-2"
      )}>
        {mediaUrls.slice(0, 4).map((url: string, idx: number) => {
          const mediaUrl = stripPrefix(url);
          const isVideo = isVideoUrl(url);
          
          return (
            <div 
              key={idx} 
              className={cn(
                "relative overflow-hidden bg-black rounded-md cursor-pointer group",
                mediaUrls.length === 1 && "h-96",
                mediaUrls.length > 1 && "h-48"
              )}
              onClick={() => handleMediaClick(post, url)}
            >
              {isVideo ? (
                <>
                  <video
                    src={mediaUrl}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <div className="bg-black/50 rounded-full p-2">
                      <Play className="h-6 w-6 text-white/80" />
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                    <Film className="h-3 w-3 text-white" />
                  </div>
                </>
              ) : (
                <img
                  src={mediaUrl}
                  alt={`Mídia ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              )}
              
              {/* Overlay indicador de múltiplas mídias */}
              {mediaUrls.length > 1 && idx === 3 && mediaUrls.length > 4 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center md:bg-black/40">
                  <span className="text-white font-bold text-lg">+{mediaUrls.length - 4}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const popularTags = [
    "#tecnologia",
    "#design",
    "#dev",
    "#startup",
    "#ia",
    "#webX",
    "#programacao",
    "#inovacao",
    "#mobile",
    "#web3",
    "#gaming",
    "#art"
  ];

  return (
    <div className="relative w-full h-full overflow-hidden bg-background text-foreground font-sans">
      <MediaModal
        open={mediaModalOpen}
        onOpenChange={setMediaModalOpen}
        mediaUrl={selectedMediaUrl}
        post={selectedPost}
      />
      
      {/* Header fixo - título completamente centralizado */}
      <div className="absolute top-0 left-0 right-0 z-40 p-3 md:p-4 flex items-center justify-between bg-background/80 backdrop-blur border-b border-border h-16 md:h-20">
        {/* Botão de voltar à esquerda */}
        <div className="flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-foreground hover:bg-accent rounded-full h-9 w-9 md:h-10 md:w-10"
          >
            <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </div>

        {/* Título completamente centralizado */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-auto">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tighter text-foreground text-center">
            Explore <span className="font-black">World</span>
          </h1>
          <span className="text-[8px] md:text-[10px] lg:text-xs text-muted-foreground font-medium tracking-wide mt-0.5">
            Descubra os posts mais interessantes
          </span>
        </div>

        {/* Elemento invisível para balancear o layout */}
        <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10"></div>
      </div>

      {/* Conteúdo principal - fundo escuro apenas no mobile */}
      <div className="w-full h-full pt-16 md:pt-20 pb-24 bg-background overflow-y-auto">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
            {/* Main Content */}
            <div className="lg:col-span-8 space-y-4">
              {/* Hero & Search Bar */}
              <div className="space-y-6">
                {!isSearching && (
                  <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-3xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 mb-2">
                       O que você quer explorar hoje?
                    </h2>
                    <p className="text-sm md:text-base text-muted-foreground">
                      Busque por pessoas, posts incríveis ou navegue pelos tópicos em alta.
                    </p>
                  </div>
                )}
                
                <Card className={cn("p-4 bg-card border-border transition-all duration-300", !isSearching ? "shadow-lg shadow-blue-500/10 scale-105 mx-4 md:mx-12" : "")}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por pessoas, posts, hashtags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 text-base bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-ring rounded-xl"
                    />
                  </div>
                </Card>
              </div>

              {/* Selected Tag */}
              {selectedTag && (
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-800/30 md:bg-gradient-to-r md:from-blue-50 md:to-purple-50 md:border-blue-200">
                  <Badge variant="secondary" className="text-sm bg-gradient-to-r from-blue-600 to-purple-600 md:from-blue-500 md:to-purple-500">
                    {selectedTag}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTagFilter}
                    className="h-7 px-2 text-gray-300 hover:text-white md:text-gray-600 md:hover:text-gray-900"
                  >
                    Limpar filtro
                  </Button>
                </div>
              )}

              {/* Main Layout Area */}
              {!isSearching ? (
                <div className="space-y-8 animate-in fade-in duration-500">


                  {/* Viral Clips Preview */}
                  {viralClips && viralClips.length > 0 && (
                    <div>
                      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                         <Play className="h-5 w-5 text-pink-500" /> World Flash
                      </h2>
                      <div className="grid grid-cols-3 gap-3">
                        {viralClips.map((clip: any) => {
                          const mediaUrl = clip.media_urls?.[0] ? stripPrefix(clip.media_urls[0]) : null;
                          const isVideo = true; // World Flash clips are always videos
                          
                          if (!mediaUrl) return null;

                          return (
                            <div 
                              key={clip.id} 
                              className="relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer group bg-black"
                              onClick={() => handleMediaClick(clip, clip.media_urls[0])}
                            >
                              {isVideo ? (
                                <video
                                  src={mediaUrl}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                                  muted
                                  playsInline
                                  autoPlay
                                  loop
                                />
                              ) : (
                                <img
                                  src={mediaUrl}
                                  alt="Clip cover"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                                />
                              )}
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 md:p-3">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5 md:h-6 md:w-6 border border-white/20">
                                    <AvatarImage src={clip.profiles?.avatar_url} />
                                    <AvatarFallback className="text-[8px]">{(clip.profiles?.username || "U")[0]?.toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-bold text-white truncate text-shadow-sm">@{clip.profiles?.username}</span>
                                </div>
                              </div>

                              <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md rounded-full p-1.5 md:p-2 border border-white/10 group-hover:bg-white/20 transition-colors">
                                <Film className="h-3 w-3 md:h-4 md:w-4 text-white" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Usuários Sugeridos */}
                  {suggestedUsers && suggestedUsers.length > 0 && (
                    <div>
                      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                         <Users className="h-5 w-5 text-purple-500" /> Pessoas Interessantes
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {suggestedUsers.map((u: any) => (
                           <div key={u.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:border-purple-500/50 transition-colors">
                              <div className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1" onClick={() => navigate(`/profile/${u.id}`)}>
                                <Avatar className="h-10 w-10 border-2 border-purple-500/20 shrink-0">
                                  <AvatarImage src={u.avatar_url} />
                                  <AvatarFallback>{(u.username||"")[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                   <div className="font-bold text-sm truncate">{u.full_name || u.username}</div>
                                   <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" className="rounded-full shrink-0 ml-2" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${u.id}`); }}>
                                 <UserPlus className="h-4 w-4" />
                              </Button>
                           </div>
                         ))}
                      </div>
                    </div>
                  )}

                  {/* Comunidades Sugeridas */}
                  {suggestedBubbles && suggestedBubbles.length > 0 && (
                    <div>
                      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                         <Hash className="h-5 w-5 text-pink-500" /> Comunidades Populares
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {suggestedBubbles.map((c: any) => (
                           <div key={c.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-pink-500/50 transition-colors cursor-pointer" onClick={() => navigate(`/communities/${c.id}`)}>
                              <Avatar className="h-12 w-12 rounded-lg border-2 border-pink-500/20 shrink-0">
                                <AvatarImage src={c.avatar_url} />
                                <AvatarFallback className="rounded-lg bg-pink-500/10 text-pink-500 font-bold">{(c.name||"")[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                 <div className="font-bold text-sm truncate">{c.name}</div>
                                 <div className="text-xs text-muted-foreground line-clamp-1">{c.description || "Participe desta comunidade"}</div>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Resultados de Usuários */}
                  {searchQuery && !isLoadingSearchedUsers && searchedUsers && searchedUsers.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" /> Pessoas encontradas
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchedUsers.map((u: any) => (
                          <div 
                            key={u.id} 
                            className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-blue-500/50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/profile/${u.id}`)}
                          >
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarImage src={u.avatar_url} />
                              <AvatarFallback className="bg-blue-500/10 text-blue-500">{(u.username||"U")[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-bold text-sm truncate">{u.full_name || u.username}</div>
                              <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resultados de Posts */}
                  {searchQuery && (
                    <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                      <Search className="h-5 w-5 text-gray-500" /> Posts encontrados
                    </h3>
                  )}

                  {isLoadingPosts ? (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <Card key={idx} className="p-6 space-y-4 bg-gray-900/50 backdrop-blur-sm border-gray-800 md:bg-white md:border-gray-200 md:shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full bg-gray-800 md:bg-gray-200" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-24 bg-gray-800 md:bg-gray-200" />
                            <Skeleton className="h-3 w-16 bg-gray-800 md:bg-gray-200" />
                          </div>
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md bg-gray-800 md:bg-gray-200" />
                      </div>
                      <Skeleton className="h-20 w-full bg-gray-800 md:bg-gray-200" />
                      <Skeleton className="h-48 w-full rounded-lg bg-gray-800 md:bg-gray-200" />
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-6">
                          <Skeleton className="h-8 w-16 bg-gray-800 md:bg-gray-200" />
                          <Skeleton className="h-8 w-16 bg-gray-800 md:bg-gray-200" />
                          <Skeleton className="h-8 w-16 bg-gray-800 md:bg-gray-200" />
                        </div>
                        <Skeleton className="h-8 w-8 rounded-md bg-gray-800 md:bg-gray-200" />
                      </div>
                    </Card>
                  ))
                ) : posts && posts.length > 0 ? (
                  posts.map((post: any) => {
                    const isLiked = post.likes?.some((like: any) => like.user_id === user?.id);
                    const likesCount = post.likes?.length || 0;
                    const commentsCount = post.comments?.length || 0;

                    return (
                      <Card key={post.id} className="p-6 space-y-4 bg-gray-900/50 backdrop-blur-sm border-gray-800 hover:border-blue-500/30 transition-all duration-300 md:bg-white md:border-gray-200 md:hover:border-blue-300 md:shadow-sm">
                        {/* Post Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 ring-2 ring-blue-500/30 md:ring-blue-200">
                              <AvatarImage 
                                src={post.profiles?.avatar_url || undefined} 
                                alt={post.profiles?.username}
                              />
                              <AvatarFallback className="bg-gradient-to-tr from-blue-500 to-purple-500 text-white font-bold md:from-blue-400 md:to-purple-400">
                                {post.profiles?.username?.[0]?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <UserLink 
                                  userId={post.user_id} 
                                  username={post.profiles?.username || ''}
                                  className="font-bold text-white hover:text-blue-400 transition-colors md:text-gray-900 md:hover:text-blue-600"
                                >
                                  @{post.profiles?.username || "usuário"}
                                </UserLink>
                                {post.post_type === 'viral_clips' && (
                                  <Badge className="bg-gradient-to-r from-pink-600 to-purple-600 text-xs md:from-pink-500 md:to-purple-500">
                                    <Film className="h-3 w-3 mr-1" /> Clip
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 flex items-center gap-1 md:text-gray-500">
                                <Clock className="h-3 w-3" />
                                há {formatTimeAgo(post.created_at)}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground md:text-gray-500 md:hover:text-gray-700">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Post Content */}
                        <div className="space-y-3">
                          {post.content && (
                            <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap md:text-gray-700">
                              <MentionText
                                text={post.content}
                                onHashtagClick={handleTagClick}
                              />
                            </div>
                          )}

                          {/* Post Media */}
                          {renderMediaGrid(post)}
                        </div>

                        {/* Post Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-800 md:border-gray-200">
                          <div className="flex items-center gap-4 md:gap-6">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "gap-2 h-8 px-3 rounded-full bg-gray-800/50 hover:bg-gray-800 md:bg-gray-100 md:hover:bg-gray-200",
                                isLiked && "text-red-500 bg-red-500/10 hover:bg-red-500/20 md:bg-red-50 md:hover:bg-red-100"
                              )}
                              onClick={() => toggleLike(post.id, isLiked)}
                            >
                              <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
                              <span className="text-xs font-medium md:text-gray-700">{likesCount}</span>
                            </Button>

                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="gap-2 h-8 px-3 rounded-full bg-gray-800/50 hover:bg-gray-800 md:bg-gray-100 md:hover:bg-gray-200"
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span className="text-xs font-medium md:text-gray-700">{commentsCount}</span>
                            </Button>

                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 rounded-full bg-gray-800/50 hover:bg-gray-800 md:bg-gray-100 md:hover:bg-gray-200"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 rounded-full bg-gray-800/50 hover:bg-gray-800 md:bg-gray-100 md:hover:bg-gray-200"
                          >
                            <Bookmark className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="p-8 md:p-12 text-center bg-gray-900/50 backdrop-blur-sm border-gray-800 md:bg-white md:border-gray-200 md:shadow-sm">
                    <div className="flex flex-col items-center gap-4">
                      <Globe className="h-16 w-16 text-gray-600" />
                      <div>
                        <p className="text-gray-300 font-medium md:text-gray-700">
                          {searchQuery || selectedTag
                            ? "Nenhum post encontrado"
                            : "Nenhum post disponível no momento"}
                        </p>
                        <p className="text-gray-500 text-sm mt-2 md:text-gray-600">
                          {searchQuery || selectedTag
                            ? "Tente buscar com outras palavras ou tags"
                            : "Os posts mais votados aparecerão aqui!"}
                        </p>
                      </div>
                      {(searchQuery || selectedTag) && (
                        <Button 
                          variant="outline" 
                          className="mt-2 border-gray-700 text-gray-300 hover:text-white hover:border-blue-500 md:border-gray-300 md:text-gray-600 md:hover:text-gray-900 md:hover:border-blue-500"
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedTag(null);
                          }}
                        >
                          Limpar busca
                        </Button>
                      )}
                    </div>
                  </Card>
                )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Trending Section */}
              <Card className="p-4 bg-gray-900/50 backdrop-blur-sm border-gray-800 md:bg-white md:border-gray-200 md:shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <h3 className="font-bold text-white md:text-gray-900">Trending</h3>
                </div>
                <div className="space-y-3">
                  {isLoadingTags ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <div key={idx} className="space-y-2 p-2">
                        <Skeleton className="h-4 w-24 bg-gray-800 md:bg-gray-200" />
                        <Skeleton className="h-3 w-16 bg-gray-800 md:bg-gray-200" />
                      </div>
                    ))
                  ) : trendingTags && trendingTags.length > 0 ? (
                    trendingTags.slice(0, 5).map(({ tag, count }) => (
                      <button
                        key={tag}
                        onClick={() => handleTagClick(tag)}
                        className="w-full text-left hover:bg-gray-800/50 p-2 rounded-lg transition-colors group md:hover:bg-gray-100"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm text-white group-hover:text-blue-400 md:text-gray-900 md:group-hover:text-blue-600">{tag}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 md:bg-blue-50 md:text-blue-600">
                            {count}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 md:text-gray-500">{count} posts</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 p-2 md:text-gray-500">Nenhuma tag trending</p>
                  )}
                </div>
              </Card>

              {/* Popular Tags */}
              <Card className="p-4 bg-gray-900/50 backdrop-blur-sm border-gray-800 md:bg-white md:border-gray-200 md:shadow-sm">
                <h3 className="font-bold text-white mb-4 md:text-gray-900">Tags populares</h3>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer bg-gray-800 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 transition-all duration-300 text-gray-300 hover:text-white md:bg-gray-100 md:text-gray-700 md:hover:bg-gradient-to-r md:hover:from-blue-500 md:hover:to-purple-500 md:hover:text-white"
                      onClick={() => handleTagClick(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Card>


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}