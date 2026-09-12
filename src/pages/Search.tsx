import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Users,
  MessageCircle,
  FileText,
  Hash,
  Loader2,
  Clock,
  X,
  ChevronRight,
  Lock,
  TrendingUp,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeLocalStorage } from "@/utils/safeStorage";
import BackButton from "@/components/BackButton";

interface ProfileHit {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface PostHit {
  id: string;
  content: string | null;
  created_at: string;
  media_urls: string[] | null;
  user_id: string;
  profiles: ProfileHit | null;
}

interface CommunityHit {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_private: boolean;
}

interface MessageHit {
  id: string;
  conversation_id: string;
  content: string | null;
  sender_id: string;
  created_at: string;
}

interface EnrichedMessageHit extends MessageHit {
  senderName: string | null;
  senderAvatar: string | null;
  conversationName: string;
}

type SearchMessagesRpc = (
  fn: "search_messages",
  args: { p_query: string; p_limit: number },
) => Promise<{ data: MessageHit[] | null; error: unknown }>;

const RECENT_KEY = "udg_recent_searches";

function loadRecentSearches(): string[] {
  try {
    const raw = safeLocalStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, 8);
  } catch {
    return [];
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m3u8)(\?.*)?$/i.test(url);
}

function initials(name: string): string {
  return (name || "U")[0]?.toUpperCase() || "U";
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);
  const [tab, setTab] = useState("people");

  const active = debouncedQuery.length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 600);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!active) return;
    setRecentSearches((prev) => {
      const next = [debouncedQuery, ...prev.filter((item) => item !== debouncedQuery)].slice(0, 8);
      try {
        safeLocalStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        return prev;
      }
      return next;
    });
  }, [debouncedQuery, active]);

  const featuredQuery = useQuery({
    queryKey: ["global-search", "featured"],
    enabled: !active,
    queryFn: async (): Promise<ProfileHit[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .order("created_at", { ascending: true })
        .limit(5);
      if (error) {
        console.error("Erro ao carregar pessoas em destaque:", error);
        return [];
      }
      return data || [];
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["global-search", "people", debouncedQuery],
    enabled: active,
    queryFn: async (): Promise<ProfileHit[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${debouncedQuery}%,full_name.ilike.%${debouncedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.error("Erro ao buscar pessoas:", error);
        return [];
      }
      return data || [];
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["global-search", "messages", debouncedQuery],
    enabled: active,
    queryFn: async (): Promise<EnrichedMessageHit[]> => {
      const { data, error } = await (supabase.rpc as unknown as SearchMessagesRpc)(
        "search_messages",
        { p_query: debouncedQuery, p_limit: 30 },
      );
      if (error || !data || data.length === 0) return [];
      const senderIds = Array.from(new Set(data.map((hit) => hit.sender_id)));
      const conversationIds = Array.from(new Set(data.map((hit) => hit.conversation_id)));
      const [profilesResult, conversationsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", senderIds),
        supabase
          .from("conversations")
          .select("id, name, is_group")
          .in("id", conversationIds),
      ]);
      const senderById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
      const conversationById = new Map((conversationsResult.data || []).map((conv) => [conv.id, conv]));
      return data.map((hit) => {
        const sender = senderById.get(hit.sender_id);
        const conversation = conversationById.get(hit.conversation_id);
        const senderName = sender?.username || null;
        return {
          ...hit,
          senderName,
          senderAvatar: sender?.avatar_url || null,
          conversationName:
            conversation?.name ||
            (conversation?.is_group ? "Grupo" : senderName ? `@${senderName}` : "Conversa"),
        };
      });
    },
  });

  const postsQuery = useQuery({
    queryKey: ["global-search", "posts", debouncedQuery],
    enabled: active,
    queryFn: async (): Promise<PostHit[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, content, created_at, media_urls, user_id, profiles:user_id (id, username, full_name, avatar_url)",
        )
        .ilike("content", `%${debouncedQuery}%`)
        .eq("is_blocked", false)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.error("Erro ao buscar posts:", error);
        return [];
      }
      return data || [];
    },
  });

  const communitiesQuery = useQuery({
    queryKey: ["global-search", "communities", debouncedQuery],
    enabled: active,
    queryFn: async (): Promise<CommunityHit[]> => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, description, avatar_url, is_private")
        .ilike("name", `%${debouncedQuery}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.error("Erro ao buscar comunidades:", error);
        return [];
      }
      return data || [];
    },
  });

  const renderPersonCard = (profile: ProfileHit) => (
    <div
      key={profile.id}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/profile/${profile.id}`)}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={profile.avatar_url ?? undefined} />
        <AvatarFallback>{initials(profile.full_name || profile.username)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{profile.full_name || profile.username}</div>
        <div className="text-xs text-muted-foreground truncate">@{profile.username}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );

  const renderMessageCard = (hit: EnrichedMessageHit) => (
    <div
      key={hit.id}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/messages?conversation=${hit.conversation_id}`)}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={hit.senderAvatar ?? undefined} />
        <AvatarFallback>{initials(hit.senderName || "U")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm truncate">{hit.senderName ? `@${hit.senderName}` : "Remetente"}</span>
          <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            {hit.conversationName}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {hit.content || "Mídia anexada"}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(hit.created_at)}</span>
    </div>
  );

  const renderPostCard = (post: PostHit) => {
    const media = Array.isArray(post.media_urls)
      ? post.media_urls.filter((url): url is string => !!url)
      : [];
    return (
      <div
        key={post.id}
        className="p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => navigate(`/feed?post=${post.id}`)}
      >
        <div
          className="flex items-center gap-3"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/profile/${post.user_id}`);
          }}
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={post.profiles?.avatar_url ?? undefined} />
            <AvatarFallback>{initials(post.profiles?.username || "U")}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm truncate">{post.profiles?.username || "Usuário"}</div>
            <div className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</div>
          </div>
        </div>
        {post.content && <p className="mt-2 text-sm whitespace-pre-wrap break-words">{post.content}</p>}
        {media.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {media.slice(0, 3).map((url, index) => (
              <div key={`${post.id}-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                {isVideoUrl(url) ? (
                  <Video className="absolute inset-0 m-auto h-8 w-8 text-white/90" />
                ) : (
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCommunityCard = (community: CommunityHit) => (
    <div
      key={community.id}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-pink-500/50 transition-colors cursor-pointer"
      onClick={() => navigate("/communities")}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={community.avatar_url ?? undefined} />
        <AvatarFallback>{initials(community.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate">{community.name}</div>
        {community.description && (
          <div className="text-xs text-muted-foreground truncate">{community.description}</div>
        )}
      </div>
      {community.is_private && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );

  const renderSpinner = () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const renderEmpty = (icon: typeof Users, title: string) => {
    const EmptyIcon = icon;
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
        <EmptyIcon className="h-10 w-10 opacity-40" />
        <p className="text-sm text-center">
          {title} <span className="font-semibold">"{debouncedQuery}"</span>
        </p>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-background text-foreground font-sans">
      <div className="absolute top-0 left-0 right-0 z-40 p-3 md:p-4 flex items-center justify-between bg-background/80 backdrop-blur border-b border-border h-16 md:h-20">
        <div className="flex-shrink-0">
          <BackButton />
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-auto pointer-events-none">
          <h1 className="text-xl md:text-2xl font-black tracking-tighter text-foreground text-center">
            Pesquisa Global
          </h1>
          <span className="text-[8px] md:text-[10px] text-muted-foreground font-medium tracking-wide mt-0.5">
            Pessoas, mensagens, posts e comunidades
          </span>
        </div>
        <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10"></div>
      </div>

      <div className="w-full h-full pt-16 md:pt-20 pb-24 bg-background overflow-y-auto">
        <div className="container mx-auto max-w-2xl px-4 py-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pessoas, mensagens, posts e comunidades..."
              className="pl-10 pr-10 h-12 text-base bg-card border-input text-foreground placeholder:text-muted-foreground focus:border-ring rounded-xl"
            />
            {query.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!active ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              {recentSearches.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Pesquisas recentes
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => setQuery(term)}
                        className="px-3 py-1.5 rounded-full bg-card border border-border text-sm hover:border-primary/50 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Pessoas em destaque
                </h2>
                {featuredQuery.isLoading ? (
                  renderSpinner()
                ) : featuredQuery.data && featuredQuery.data.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {featuredQuery.data.map(renderPersonCard)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhuma pessoa em destaque por enquanto.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full grid grid-cols-4 h-11 p-1">
                <TabsTrigger value="people" className="px-1 gap-1 text-xs sm:text-sm">
                  <Users className="h-4 w-4 shrink-0" /> Pessoas
                </TabsTrigger>
                <TabsTrigger value="messages" className="px-1 gap-1 text-xs sm:text-sm">
                  <MessageCircle className="h-4 w-4 shrink-0" /> Mensagens
                </TabsTrigger>
                <TabsTrigger value="posts" className="px-1 gap-1 text-xs sm:text-sm">
                  <FileText className="h-4 w-4 shrink-0" /> Posts
                </TabsTrigger>
                <TabsTrigger value="communities" className="px-1 gap-1 text-xs sm:text-sm">
                  <Hash className="h-4 w-4 shrink-0" /> Comunidades
                </TabsTrigger>
              </TabsList>

              <TabsContent value="people">
                {peopleQuery.isLoading ? (
                  renderSpinner()
                ) : peopleQuery.data && peopleQuery.data.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {peopleQuery.data.map(renderPersonCard)}
                  </div>
                ) : (
                  renderEmpty(Users, "Nenhuma pessoa encontrada para")
                )}
              </TabsContent>

              <TabsContent value="messages">
                {messagesQuery.isLoading ? (
                  renderSpinner()
                ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {messagesQuery.data.map(renderMessageCard)}
                  </div>
                ) : (
                  renderEmpty(MessageCircle, "Nenhuma mensagem encontrada para")
                )}
              </TabsContent>

              <TabsContent value="posts">
                {postsQuery.isLoading ? (
                  renderSpinner()
                ) : postsQuery.data && postsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {postsQuery.data.map(renderPostCard)}
                  </div>
                ) : (
                  renderEmpty(FileText, "Nenhum post encontrado para")
                )}
              </TabsContent>

              <TabsContent value="communities">
                {communitiesQuery.isLoading ? (
                  renderSpinner()
                ) : communitiesQuery.data && communitiesQuery.data.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {communitiesQuery.data.map(renderCommunityCard)}
                  </div>
                ) : (
                  renderEmpty(Hash, "Nenhuma comunidade encontrada para")
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}