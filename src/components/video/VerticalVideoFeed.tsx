import { useCallback, useEffect, useRef } from "react";
import { Film, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import VideoPostCard from "./VideoPostCard";
import type { VideoPost, Viewer } from "./types";

interface VerticalVideoFeedProps {
  posts: VideoPost[];
  user: Viewer;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onVote: (postId: string, voteType: "heart" | "bomb") => void;
  onLike: (postId: string) => void;
  onComment: (post: VideoPost) => void;
  onShare: (post: VideoPost) => void;
  onNearEnd: () => void;
  muted: boolean;
  onToggleMute: () => void;
  isLoading: boolean;
  isLoadingMore?: boolean;
  className?: string;
}

export default function VerticalVideoFeed({
  posts,
  user,
  activeIndex,
  onActiveIndexChange,
  onVote,
  onLike,
  onComment,
  onShare,
  onNearEnd,
  muted,
  onToggleMute,
  isLoading,
  isLoadingMore,
  className,
}: VerticalVideoFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(activeIndex);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const nextIndex = Math.round(el.scrollTop / el.clientHeight);
    if (nextIndex >= 0 && nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      onActiveIndexChange(nextIndex);
    }

    if (posts.length > 0 && nextIndex >= posts.length - 1) {
      onNearEnd();
    }
  }, [onActiveIndexChange, onNearEnd, posts.length]);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: index * el.clientHeight, behavior: "smooth" });
  }, []);

  return (
    <div className={cn("relative w-full h-full bg-black", className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-auto snap-y snap-mandatory overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post, index) => (
          <VideoPostCard
            key={post.id}
            post={post}
            user={user}
            active={index === activeIndex}
            muted={muted}
            onToggleMute={onToggleMute}
            onVote={onVote}
            onLike={onLike}
            onComment={onComment}
            onShare={onShare}
            onActivate={() => scrollToIndex(index)}
          />
        ))}

        {(isLoading || isLoadingMore) && (
          <div className="w-full h-full snap-start snap-always bg-black flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-white/60" />
          </div>
        )}

        {posts.length === 0 && !isLoading && (
          <div className="w-full h-full snap-start snap-always bg-black flex flex-col items-center justify-center text-center px-8 text-white/70">
            <Film className="h-12 w-12 mb-4 text-white/40" />
            <p className="text-sm font-medium">Nenhum vídeo por aqui ainda.</p>
            <p className="text-xs text-white/50 mt-1">World Flash e posts com vídeo aparecerão aqui.</p>
          </div>
        )}
      </div>

      {posts.length > 0 && (
        <div className="pointer-events-none absolute top-3 inset-x-0 z-30 flex justify-center">
          <span className="rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1 text-[11px] font-bold text-white">
            {Math.min(activeIndex + 1, posts.length)} / {posts.length}
          </span>
        </div>
      )}
    </div>
  );
}