import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserLink } from "@/components/UserLink";
import { X, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StoryItem {
  id: string;
  user_id: string;
  media_type: "image" | "video" | "audio";
  media_url: string;
  caption?: string | null;
  created_at: string;
  profiles?: { username?: string; avatar_url?: string | null } | null;
}

const DURATION_MS = 6500;

export function StoryViewer({
  open,
  stories,
  initialIndex = 0,
  onClose,
}: {
  open: boolean;
  stories: StoryItem[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [views, setViews] = useState<{ username?: string; avatar_url?: string | null }[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  const story = stories[index];
  const isOwn = story?.user_id === user?.id;
  const isUser = isOwn;

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      setProgress(0);
    }
  }, [open, initialIndex]);

  // Marca visualização (apenas se não for o autor)
  useEffect(() => {
    if (!open || !story || !user) return;
    let cancelled = false;
    const recordView = async () => {
      if (!isUser) {
        try {
          const { data: existing } = await supabase
            .from("story_views")
            .select("id")
            .eq("story_id", story.id)
            .eq("viewer_id", user.id)
            .maybeSingle();
          if (!existing) {
            await supabase.from("story_views").insert({ story_id: story.id, viewer_id: user.id });
          }
        } catch {}
      }
    };
    void recordView();
    if (isUser) {
      // busca lista de quem viu
      supabase
        .from("story_views")
        .select("viewer:profiles!story_views_viewer_id_fkey(username, avatar_url)")
        .eq("story_id", story.id)
        .then(({ data }) => setViews((data || []).map((r: any) => r.viewer)));
    }
    return () => { cancelled = true; };
  }, [open, story?.id, user?.id, isUser]);

  // Timer de avanço
  useEffect(() => {
    if (!open || !story || paused) return;
    const interval = 50;
    const started = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - started;
      const pct = Math.min(elapsed / DURATION_MS, 1);
      setProgress(pct);
      if (pct >= 1) {
        goNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, story, paused]);

  const goNext = useCallback(() => {
    setProgress(0);
    if (index < stories.length - 1) setIndex(index + 1);
    else onClose();
  }, [index, stories.length, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0);
    if (index > 0) setIndex(index - 1);
  }, [index]);

  const togglePause = () => setPaused((p) => !p);

  if (!open || !story) return null;

  // Mapa de progresso por story (simplificado: só o atual)
  const isVideo = story.media_type === "video";

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center select-none" onClick={togglePause}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full h-full max-w-2xl mx-auto">
        {/* Topo: avatar + nome + viewers */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-5">
          <Avatar className="h-10 w-10 ring-2 ring-white/60">
            <AvatarImage src={story.profiles?.avatar_url || ""} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {(story.profiles?.username || "?")[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <UserLink userId={story.user_id} username={story.profiles?.username || ""} className="text-white font-semibold text-sm hover:underline">
              {story.profiles?.username}
            </UserLink>
            <div className="text-white/70 text-xs">
              {story.created_at ? new Date(story.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
            </div>
          </div>
          {isUser && views.length > 0 && (
            <button
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-medium rounded-full px-3 py-1.5"
              onClick={() => {}}
            >
              <Eye className="h-3.5 w-3.5" /> {views.length}
            </button>
          )}
          <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Barra de progresso */}
        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 px-4 pt-2">
          <div className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-50 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        {/* Mídia */}
        <div className="absolute inset-0 flex items-center justify-center px-4">
          {isVideo ? (
            <video
              ref={videoRef}
              src={story.media_url}
              className="max-h-full max-w-full rounded-lg object-contain"
              autoPlay
              muted={isUser}
              playsInline
            />
          ) : (
            <img src={story.media_url} alt="Story" className="max-h-full max-w-full rounded-lg object-contain" />
          )}
        </div>

        {/* Legenda */}
        {story.caption && (
          <div className="absolute bottom-10 left-0 right-0 z-20 px-6 text-center">
            <p className="text-white text-lg font-medium drop-shadow-lg bg-black/30 inline-block px-4 py-2 rounded-full backdrop-blur-sm">
              {story.caption}
            </p>
          </div>
        )}

        {/* Navegação por toque nas laterais */}
        <button
          className="absolute left-0 top-0 bottom-0 w-1/2 z-10"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          aria-label="Anterior"
        />
        <button
          className="absolute right-0 top-0 bottom-0 w-1/2 z-10"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          aria-label="Próximo"
        />

        {/* Botões visuais de navegação quando > 1 story */}
        {stories.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); goPrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 hidden sm:flex">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white rounded-full p-2 hidden sm:flex">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}