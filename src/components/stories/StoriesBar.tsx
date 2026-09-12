import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer, type StoryItem } from "./StoryViewer";

// Agrupa stories por usuário, mantendo a ordem (autor primeiro, depois quem tem stories)
export function StoriesBar({ className }: { className?: string }) {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const loadStories = async () => {
    const { data } = await supabase
      .from("stories")
      .select("*, profiles:user_id(username, avatar_url)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setStories((data as StoryItem[]) || []);
  };

  useEffect(() => {
    loadStories();
    const channel = supabase
      .channel("stories-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => loadStories())
      .subscribe();
    const iv = setInterval(loadStories, 60_000); // re-refresh para expiração
    return () => {
      supabase.removeChannel(channel);
      clearInterval(iv);
    };
  }, []);

  // Agrupa: primeiro o autor (se tiver stories) e depois o restante, por created_at desc
  const groups = useMemo(() => {
    const map = new Map<string, StoryItem[]>();
    for (const s of stories) {
      const arr = map.get(s.user_id) || [];
      arr.push(s);
      map.set(s.user_id, arr);
    }
    const shuffled: { user_id: string; items: StoryItem[] }[] = [];
    map.forEach((items, user_id) => shuffled.push({ user_id, items }));
    shuffled.sort((a, b) => (b.items[0].created_at || "").localeCompare(a.items[0].created_at || ""));
    if (user) {
      const own = shuffled.find((g) => g.user_id === user.id);
      if (own) {
        const rest = shuffled.filter((g) => g.user_id !== user.id);
        shuffled.splice(0, shuffled.length, own, ...rest);
      }
    }
    return shuffled;
  }, [stories, user]);

  const storyFlatIndex = (groupIdx: number): number => {
    let idx = 0;
    for (let i = 0; i < groupIdx; i++) idx += groups[i].items.length;
    return idx;
  };

  // Ordem de exibição real (autor primeiro, depois por data) — usada pelo viewer
  const orderedStories = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups]
  );

  const ownGroup = user ? groups.find((g) => g.user_id === user.id) : undefined;
  const hasOwnStory = !!ownGroup && ownGroup.items.length > 0;

  return (
    <>
      <div className={cn("flex gap-3 overflow-x-auto py-3 px-1 hide-scrollbar", className)}>
        {/* Botão Meu Story */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
          <button
            type="button"
            onClick={() => (hasOwnStory ? setViewerIndex(0) : setComposerOpen(true))}
            className={cn(
              "relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center transition-colors",
              hasOwnStory
                ? "bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[3px]"
                : "border-2 border-dashed border-primary/60 bg-card hover:bg-card/70"
            )}
          >
            {user?.user_metadata?.avatar_url ? (
              <Avatar className="w-full h-full">
                <AvatarImage src={user.user_metadata.avatar_url as string} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Plus className="h-6 w-6 text-primary" />
            )}
          </button>
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
            {hasOwnStory ? "Seu Story" : "Novo Story"}
          </span>
        </div>

        {/* Stories dos outros */}
        {groups.filter((g) => g.user_id !== user?.id).map((g, gi) => {
          const first = g.items[0];
          const total = g.items.length;
          const idx = storyFlatIndex(gi + (user && groups.some((x) => x.user_id === user.id) ? 1 : 0));
          return (
            <button
              key={g.user_id}
              type="button"
              onClick={() => setViewerIndex(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 w-16 group"
            >
              <div className="w-16 h-16 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 group-hover:opacity-80 transition-opacity">
                <div className="w-full h-full rounded-full border-[3px] border-background overflow-hidden bg-background">
                  <Avatar className="w-full h-full">
                    <AvatarImage src={first.profiles?.avatar_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {(first.profiles?.username || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                @{first.profiles?.username || "?"} {total > 1 ? `• ${total}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      <StoryComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onSuccess={loadStories}
      />
      {viewerIndex !== null && (
        <StoryViewer
          open={viewerIndex !== null}
          stories={orderedStories}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}