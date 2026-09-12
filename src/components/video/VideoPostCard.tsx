import { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserLink } from "@/components/UserLink";
import { cn } from "@/lib/utils";
import { highlightMentions } from "@/utils/highlightMentions";
import VideoActionBar from "./VideoActionBar";
import type { VideoPost, Viewer } from "./types";

const VIDEO_EXTENSION = /\.(mp4|webm|ogg|mov|m4v|avi|mkv|flv|wmv)(\?.*)?$/i;

const stripPrefix = (url: string): string => url.replace(/^(image::|video::|audio::)/, "");

const isVideoUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;
  const cleanUrl = stripPrefix(url);
  return url.startsWith("video::") || VIDEO_EXTENSION.test(cleanUrl);
};

const getResponsiveVideoUrl = (url: string): string => {
  const cleanUrl = stripPrefix(url);
  if (!cleanUrl.includes("res.cloudinary.com")) return cleanUrl;

  const connection = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
  const isSlow =
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "3g";

  const uploadIdx = cleanUrl.indexOf("/upload/");
  if (uploadIdx !== -1) {
    const transform = isSlow ? "q_auto:low,w_480,h_854,c_fill/" : "q_auto:good/";
    return cleanUrl.slice(0, uploadIdx + 8) + transform + cleanUrl.slice(uploadIdx + 8);
  }
  return cleanUrl;
};

const getVideoSrc = (post: VideoPost): string | null => {
  const urls = Array.isArray(post.media_urls) ? post.media_urls : [];
  const videoUrl = urls.find((url) => isVideoUrl(url));
  return videoUrl ? getResponsiveVideoUrl(videoUrl) : null;
};

const getVideoPoster = (src: string | null): string | undefined => {
  if (!src || !src.includes("res.cloudinary.com")) return undefined;
  return src.replace(VIDEO_EXTENSION, ".jpg");
};

interface VideoPostCardProps {
  post: VideoPost;
  user: Viewer;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onVote: (postId: string, voteType: "heart" | "bomb") => void;
  onLike: (postId: string) => void;
  onComment: (post: VideoPost) => void;
  onShare: (post: VideoPost) => void;
  onActivate: () => void;
}

export default function VideoPostCard({
  post,
  user,
  active,
  muted,
  onToggleMute,
  onVote,
  onLike,
  onComment,
  onShare,
  onActivate,
}: VideoPostCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const src = getVideoSrc(post);
  const poster = getVideoPoster(src);

  useEffect(() => {
    setIsPlaying(active);
  }, [active]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active || !src) return;
    video.play().catch(() => undefined);
  }, [active, src]);

  const handleTap = () => {
    if (!active) {
      onActivate();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    setIsPlaying(!video.paused);
  };

  return (
    <div className="relative w-full h-full snap-start snap-always bg-black overflow-hidden select-none">
      <video
        ref={videoRef}
        src={active ? (src ?? undefined) : undefined}
        poster={active ? poster : undefined}
        preload={active ? "auto" : "none"}
        muted={muted}
        loop
        playsInline
        autoPlay
        className="w-full h-full object-cover"
        onClick={handleTap}
      />

      {poster && !active && (
        <img
          src={poster}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {!active && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-14 w-14 rounded-full bg-black/40 backdrop-blur-sm border border-white/30 flex items-center justify-center">
            <Play className="h-7 w-7 text-white drop-shadow" />
          </div>
        </div>
      )}

      {active && !isPlaying && src && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Play className="h-16 w-16 text-white/70 drop-shadow-lg" />
        </div>
      )}

      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <Avatar className="h-8 w-8 ring-2 ring-white/30 shadow-lg">
          <AvatarImage src={post.profiles?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-to-tr from-purple-500 to-orange-500 text-xs font-bold">
            {post.profiles?.username?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <UserLink
          userId={post.user_id}
          username={post.profiles?.username ?? ""}
          className="text-white text-sm font-bold drop-shadow-md hover:text-pink-300"
        >
          @{post.profiles?.username}
        </UserLink>
      </div>

      <button
        type="button"
        aria-label={muted ? "Ativar som" : "Silenciar"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className={cn(
          "absolute top-3 right-3 z-30 h-10 w-10 rounded-full bg-black/30 text-white hover:bg-black/50 border border-white/20 backdrop-blur-md transition-all active:scale-90 flex items-center justify-center"
        )}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      <div className="absolute right-2 sm:right-3 bottom-24 sm:bottom-28 z-20">
        <VideoActionBar
          post={post}
          user={user}
          onVote={onVote}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 ring-2 ring-white/30 shadow-lg">
            <AvatarImage src={post.profiles?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-to-tr from-purple-500 to-orange-500 text-xs font-bold">
              {post.profiles?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <UserLink
              userId={post.user_id}
              username={post.profiles?.username ?? ""}
              className="text-white text-sm font-bold drop-shadow-md hover:text-pink-300"
            >
              @{post.profiles?.username}
            </UserLink>
            <span className="text-[10px] text-white/60 mt-0.5">
              {new Date(post.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>
        <p className="text-white/95 text-xs sm:text-sm font-medium leading-relaxed drop-shadow-md pr-16 line-clamp-3">
          {highlightMentions(post.content ?? "")}
        </p>
      </div>
    </div>
  );
}