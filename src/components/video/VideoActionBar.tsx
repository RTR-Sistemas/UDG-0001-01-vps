import { Bomb, Heart, MessageCircle, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoPost, Viewer } from "./types";

interface VideoActionBarProps {
  post: VideoPost;
  user: Viewer;
  onVote: (postId: string, voteType: "heart" | "bomb") => void;
  onLike: (postId: string) => void;
  onComment: (post: VideoPost) => void;
  onShare: (post: VideoPost) => void;
}

const roundButton =
  "h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-black/30 text-white hover:bg-black/50 border border-white/20 backdrop-blur-md transition-all active:scale-90 flex items-center justify-center";

export default function VideoActionBar({ post, user, onVote, onLike, onComment, onShare }: VideoActionBarProps) {
  const heartVotes = (post.post_votes ?? []).filter((vote) => vote.vote_type === "heart").length;
  const bombVotes = (post.post_votes ?? []).filter((vote) => vote.vote_type === "bomb").length;
  const userVote = (post.post_votes ?? []).find((vote) => vote.user_id === user?.id);
  const isLiked = (post.likes ?? []).some((like) => like.user_id === user?.id);
  const commentCount = (post.comments ?? []).length;
  const shareCount = post.share_count ?? 0;

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="Votar com coração"
          onClick={(e) => {
            e.stopPropagation();
            onVote(post.id, "heart");
          }}
          className={cn(roundButton, userVote?.vote_type === "heart" && "bg-red-500/40 border-red-400/50")}
        >
          <Heart
            className={cn(
              "h-6 w-6 drop-shadow-md transition-colors",
              userVote?.vote_type === "heart" ? "fill-red-500 text-red-500" : "text-white"
            )}
          />
        </button>
        <span className="text-[11px] font-bold text-white drop-shadow">{heartVotes}</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="Votar com bomba"
          onClick={(e) => {
            e.stopPropagation();
            onVote(post.id, "bomb");
          }}
          className={cn(roundButton, userVote?.vote_type === "bomb" && "bg-orange-500/40 border-orange-400/50")}
        >
          <Bomb
            className={cn(
              "h-6 w-6 drop-shadow-md transition-colors",
              userVote?.vote_type === "bomb" ? "fill-orange-500 text-orange-500" : "text-white"
            )}
          />
        </button>
        <span className="text-[11px] font-bold text-white drop-shadow">{bombVotes}</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="Curtir"
          onClick={(e) => {
            e.stopPropagation();
            onLike(post.id);
          }}
          className={cn(roundButton, isLiked && "bg-red-500/40 border-red-400/50")}
        >
          <Heart
            className={cn(
              "h-6 w-6 drop-shadow-md transition-colors",
              isLiked ? "fill-red-500 text-red-500" : "text-white"
            )}
          />
        </button>
        <span className="text-[11px] font-bold text-white drop-shadow">Curtir</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="Comentar"
          onClick={(e) => {
            e.stopPropagation();
            onComment(post);
          }}
          className={roundButton}
        >
          <MessageCircle className="h-6 w-6 drop-shadow-md text-white" />
        </button>
        <span className="text-[11px] font-bold text-white drop-shadow">{commentCount > 0 ? commentCount : "Comentar"}</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label="Compartilhar"
          onClick={(e) => {
            e.stopPropagation();
            onShare(post);
          }}
          className={roundButton}
        >
          <Share2 className="h-6 w-6 drop-shadow-md text-white" />
        </button>
        <span className="text-[11px] font-bold text-white drop-shadow">{shareCount > 0 ? shareCount : "Compartilhar"}</span>
      </div>
    </div>
  );
}