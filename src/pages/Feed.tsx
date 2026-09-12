/**
 * =============================================================================
 * File: src/pages/Feed.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { moderatePost } from "@/services/contentModeration";
import { consumeFeature, featureReasonMessage } from "@/services/monetization";
import { ReportButton, REASONS } from "@/components/feed/ReportButton";
import { supabase } from "@/integrations/supabase/client";
import {
  Heart, MessageCircle, Send,
  Camera, Video, Images, Play,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
  Clock, Loader2, Globe,
  Menu, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  Film, Plus, Bomb, Timer,
  X, Camera as CameraIcon, Video as VideoIcon,
  Wand2, Sparkles, Info, Check, HelpCircle,
  MoveVertical, MoveHorizontal, Hand,
  Bookmark, MoreVertical, Upload, Pencil, Trash2,
  Maximize2, Share2, CheckCircle, ExternalLink,
  Facebook, Twitter, Instagram, Linkedin, MessageSquare,
  Link, Copy, Flag, ShieldAlert, Search, Rocket,
  Coins as CoinsIcon, Crown as CrownIcon
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserLink } from "@/components/UserLink";
import { MovementStatusBadge } from "@/components/movement/MovementStatusBadge";
import { MoodStatusBadge } from "@/components/mood/MoodStatusBadge";
import { GoldSeal } from "@/components/GoldSeal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { MentionText } from "@/components/MentionText";
import { CommentItem, CommentType } from "@/components/feed/CommentItem";
import { PostMediaCarousel } from "@/components/feed/PostMediaCarousel";
import { useBookmarkedPostIds, useToggleBookmark, useTogglePin, REACTIONS, type ReactionType } from "@/hooks/useEngagement";
import NewMentionTextarea from "@/components/ui/new-mention-textarea";
import { uploadToCloudinary } from "@/integrations/cloudinary/upload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { StoriesBar } from "@/components/stories/StoriesBar";import { DailyQuestionCard } from "@/components/feed/DailyQuestionCard";
import VerticalVideoFeed from "@/components/video/VerticalVideoFeed";
import type { VideoPost as VideoFeedPost } from "@/components/video/types";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------

/* ---------- CONFIGURAÇÕES DE ESTILO IA ---------- */
const AI_STYLES = [
  { id: 'rejuvenate', label: 'Rejuvenescer', icon: Sparkles, color: 'bg-green-100 text-green-600', prompt: 'make them look 20 years younger, remove deep wrinkles, face lift, glowing youthful skin, high fidelity, 8k, soft studio lighting', filter: 'rejuvenate' },
  { id: 'beauty', label: 'Embelezar', icon: Sparkles, color: 'bg-pink-100 text-pink-600', prompt: 'high quality, beautified, perfect lighting, 8k, smooth skin, makeup, glamour', filter: 'beauty' },
  { id: 'hdr', label: 'HDR / Nitidez', icon: Sparkles, color: 'bg-orange-100 text-orange-600', prompt: 'hdr, high contrast, sharp focus, detailed, hyperrealistic, 4k', filter: 'hdr' },
  { id: 'oil', label: 'Pintura a Óleo', icon: Sparkles, color: 'bg-yellow-100 text-yellow-700', prompt: 'oil painting style, van gogh style, thick brushstrokes, artistic, masterpiece', filter: 'oil' },
  { id: 'cartoon', label: 'Cartoon 3D', icon: Sparkles, color: 'bg-blue-50 text-blue-500', prompt: '3d pixar style character, cute, big eyes, disney style, smooth render', filter: 'cartoon' },
  { id: 'sketch', label: 'Esboço', icon: Sparkles, color: 'bg-stone-100 text-stone-600', prompt: 'pencil sketch, charcoal drawing, rough lines, black and white sketch', filter: 'sketch' },
  { id: 'fantasy', label: 'Fantasia', icon: Sparkles, color: 'bg-indigo-100 text-indigo-600', prompt: 'fantasy art, magical atmosphere, glowing lights, ethereal, dreamlike', filter: 'fantasy' },
  { id: 'bw', label: 'Preto & Branco', icon: Sparkles, color: 'bg-gray-100 text-gray-600', prompt: 'black and white photography, artistic, monochrome, noir film', filter: 'bw' },
  { id: 'vintage', label: 'Vintage 1950', icon: Sparkles, color: 'bg-amber-100 text-amber-700', prompt: 'vintage photo, 1950s style, sepia, grain, old photo texture', filter: 'vintage' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: Sparkles, color: 'bg-purple-100 text-purple-600', prompt: 'cyberpunk style, neon lights, magenta and cyan, futuristic, scifi city', filter: 'cyberpunk' },
  { id: 'matrix', label: 'Matrix', icon: Sparkles, color: 'bg-emerald-100 text-emerald-600', prompt: 'matrix code style, green tint, hacker atmosphere, digital rain', filter: 'matrix' },
  { id: 'anime', label: 'Anime', icon: Sparkles, color: 'bg-blue-100 text-blue-600', prompt: 'anime style, vibrant colors, 2d animation style, japanese animation', filter: 'anime' },
  { id: 'terror', label: 'Terror', icon: Sparkles, color: 'bg-red-100 text-red-600', prompt: 'horror style, dark atmosphere, scary, zombie apocalypse, blood', filter: 'terror' },
  { id: 'cold', label: 'Frio / Inverno', icon: Sparkles, color: 'bg-cyan-100 text-cyan-600', prompt: 'cold atmosphere, winter, blue tones, ice, snow', filter: 'cold' },
];



/* ---------- FUNÇÕES DE IA PARA IMAGENS ---------- */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
};

const createFileFromBase64 = async (base64: string, filename: string): Promise<File> => {
  const res = await fetch(base64);
  const blob = await res.blob();
  return new File([blob], filename, { type: "image/jpeg", lastModified: Date.now() });
};

const processImageLocally = async (base64Image: string, filterType: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      if (filterType === 'rejuvenate') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.filter = 'blur(12px)';
        tempCtx.drawImage(img, 0, 0);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(tempCanvas, 0, 0);

        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.4;
        ctx.filter = 'contrast(1.2)';
        ctx.drawImage(img, 0, 0);

        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffb7a5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.filter = 'saturate(1.1)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'oil') {
        ctx.filter = 'saturate(1.8) contrast(1.2) brightness(1.1)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'cartoon') {
        ctx.filter = 'saturate(2.0) contrast(1.3)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'sketch') {
        ctx.filter = 'grayscale(1) contrast(2.0) brightness(1.3)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'fantasy') {
        ctx.filter = 'contrast(1.2) saturate(1.3)';
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, 'rgba(100,0,255,0.2)');
        g.addColorStop(1, 'rgba(255,0,100,0.2)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      else if (filterType === 'beauty') {
        ctx.filter = 'brightness(1.05) saturate(1.2) contrast(1.05)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'hdr') {
        ctx.filter = 'contrast(1.3) saturate(1.3) brightness(1.1)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'bw') {
        ctx.filter = 'grayscale(1.0) contrast(1.2)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'vintage') {
        ctx.filter = 'sepia(0.8) brightness(0.9) contrast(1.2)';
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(255,200,100,0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      else if (filterType === 'cyberpunk') {
        ctx.filter = 'contrast(1.4) saturate(1.5)';
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'color-dodge';
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        g.addColorStop(0, 'rgba(255,0,255,0.3)');
        g.addColorStop(1, 'rgba(0,255,255,0.3)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      else if (filterType === 'matrix') {
        ctx.filter = 'grayscale(1) contrast(1.5)';
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(0,255,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      else if (filterType === 'anime') {
        ctx.filter = 'saturate(2.5) contrast(1.2)';
        ctx.drawImage(canvas, 0, 0);
      }
      else if (filterType === 'terror') {
        ctx.filter = 'grayscale(0.8) contrast(1.8)';
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(100,0,0,0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      else if (filterType === 'cold') {
        ctx.filter = 'saturate(0.8) brightness(1.1)';
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = 'rgba(0,200,255,0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '16px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('✨ AI Filter', 10, canvas.height - 10);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (e) => reject(e);
    img.src = base64Image;
  });
};

/* ---------- FUNÇÕES DE COMPRESSÃO DE ARQUIVOS ---------- */
const compressImage = async (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
  return new Promise((resolve) => {
    if (file.size < 3 * 1024 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], `image_${Date.now()}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const processMediaFile = async (file: File): Promise<File> => {
  try {
    if (file.type.startsWith('image/')) {
      return await compressImage(file);
    }
    return file;
  } catch (error) {
    console.error('Erro ao processar arquivo:', error);
    return file;
  }
};

/* ---------- FUNÇÕES DE REDE E MÍDIA ---------- */
const getResponsiveVideoUrl = (url: string): string => {
  if (!url || typeof url !== 'string') return url;
  const cleanUrl = stripPrefix(url);
  if (!cleanUrl.includes('res.cloudinary.com')) return cleanUrl;

  const conn = (navigator as any).connection;
  const isSlow = conn && (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g' || conn.effectiveType === '3g');
  
  const uploadIdx = cleanUrl.indexOf('/upload/');
  if (uploadIdx !== -1) {
    const transform = isSlow ? 'q_auto:low,w_480,h_854,c_fill/' : 'q_auto:good/';
    return cleanUrl.slice(0, uploadIdx + 8) + transform + cleanUrl.slice(uploadIdx + 8);
  }
  return cleanUrl;
};

/* ---------- HELPERS ---------- */
const stripPrefix = (u: any): string => {
  if (!u || typeof u !== 'string') return '';
  return u.replace(/^(image::|video::|audio::)/, "");
};

const isVideoUrl = (u: any): boolean => {
  if (!u || typeof u !== 'string') return false;
  const cleanUrl = stripPrefix(u);
  const videoExtensions = /\.(mp4|webm|ogg|mov|m4v|avi|mkv|flv|wmv)(\?.*)?$/i;
  return u.startsWith('video::') || videoExtensions.test(cleanUrl);
};

/* ---------- COMPONENTE: VideoPlayer Udg (World Flash) ---------- */
interface UdgVideoPlayerProps {
  src: string;
  post: any;
  user: any;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onShowLikes?: (post: any) => void;
  onVote?: (postId: string, voteType: "heart" | "bomb") => void;
  hasPrevClip: boolean;
  hasNextClip: boolean;
  onNextClip: () => void;
  onPreviousClip: () => void;
  onEnded?: () => void;
}

const UdgVideoPlayer = ({
  src, post, user, onLike, onComment, onShare, onShowLikes, onVote,
  hasPrevClip, hasNextClip, onNextClip, onPreviousClip, onEnded
}: UdgVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const isLiked = post.likes?.some((l: any) => l.user_id === user?.id);
  const userVote = post.post_votes?.find((v: any) => v.user_id === user?.id);
  const heartVotes = post.post_votes?.filter((v: any) => v.vote_type === "heart").length || 0;
  const bombVotes = post.post_votes?.filter((v: any) => v.vote_type === "bomb").length || 0;
  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;

    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Deslizar para direita -> Próximo vídeo
        if (hasNextClip) onNextClip();
      } else {
        // Deslizar para esquerda -> Vídeo anterior
        if (hasPrevClip) onPreviousClip();
      }
    }
    touchStartX.current = null;
  };

  useEffect(() => {
    setIsPlaying(true);
    return () => setIsPlaying(false);
  }, [post.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isPlaying) {
      if (!(v as any).isConnected) return;
      v.play().catch((e: any) => {
        const name = e?.name;
        if (name === 'AbortError' || name === 'NotAllowedError') return;
        // silently ignore expected play() errors
      });
    } else {
      v.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        src={getResponsiveVideoUrl(src)}
        className="w-full h-full object-cover"
        loop={!onEnded}
        playsInline
        onEnded={onEnded}
        onTimeUpdate={handleTimeUpdate}
        onClick={() => setIsPlaying(!isPlaying)}
      />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10">
          <Play className="h-16 w-16 text-white/50" />
        </div>
      )}

      {hasPrevClip && (
        <Button
           variant="ghost"
           size="icon"
           className="hidden sm:flex absolute top-6 right-20 z-[50] rounded-full bg-pink-600/80 text-white hover:bg-pink-600 w-12 h-12 backdrop-blur-md border-2 border-white/30 shadow-[0_0_15px_rgba(236,72,153,0.5)] transition-all active:scale-95"
           onClick={(e) => { e.stopPropagation(); onPreviousClip(); }}
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
      )}

      {hasNextClip && (
        <Button
           variant="ghost"
           size="icon"
           className="hidden sm:flex absolute top-6 right-6 z-[50] rounded-full bg-pink-600/80 text-white hover:bg-pink-600 w-12 h-12 backdrop-blur-md border-2 border-white/30 shadow-[0_0_15px_rgba(236,72,153,0.5)] transition-all active:scale-95"
           onClick={(e) => { e.stopPropagation(); onNextClip(); }}
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </Button>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 z-30">
        <div
          className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="absolute right-2 sm:right-4 bottom-28 sm:bottom-32 flex flex-col items-center gap-4 sm:gap-6 z-20">
        <div className="flex flex-col items-center group">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/20 text-white hover:bg-black/50 backdrop-blur-md transition-all active:scale-90"
            onClick={onLike}
          >
            <Heart className={cn("h-5 w-5 sm:h-7 sm:w-7 transition-colors drop-shadow-md", isLiked ? "fill-red-500 text-red-500" : "text-white")} />
          </Button>
          <button
            type="button"
            onClick={() => onShowLikes?.(post)}
            className="text-white text-xs font-bold drop-shadow-md mt-1 hover:underline"
            title="Ver quem curtiu"
          >
            {post.likes?.length || 0}
          </button>
        </div>

        {/* Vote: Heart (Aprovar) */}
        {onVote && (
          <div className="flex flex-col items-center group">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 sm:h-12 sm:w-12 rounded-full backdrop-blur-md transition-all active:scale-90",
                userVote?.vote_type === "heart"
                  ? "bg-green-600/40 text-green-400 border-2 border-green-500/50"
                  : "bg-black/20 text-white hover:bg-black/50"
              )}
              onClick={() => onVote(post.id, "heart")}
            >
              <Heart className={cn("h-5 w-5 sm:h-7 sm:w-7 drop-shadow-md", userVote?.vote_type === "heart" && "fill-green-400 text-green-400")} />
            </Button>
            <span className={cn("text-xs font-bold drop-shadow-md mt-1", userVote?.vote_type === "heart" ? "text-green-400" : "text-white")}>
              {heartVotes}
            </span>
          </div>
        )}

        {/* Vote: Bomb (Rejeitar) */}
        {onVote && (
          <div className="flex flex-col items-center group">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 sm:h-12 sm:w-12 rounded-full backdrop-blur-md transition-all active:scale-90",
                userVote?.vote_type === "bomb"
                  ? "bg-orange-600/40 text-orange-400 border-2 border-orange-500/50"
                  : "bg-black/20 text-white hover:bg-black/50"
              )}
              onClick={() => onVote(post.id, "bomb")}
            >
              <Bomb className={cn("h-5 w-5 sm:h-7 sm:w-7 drop-shadow-md", userVote?.vote_type === "bomb" && "fill-orange-400 text-orange-400")} />
            </Button>
            <span className={cn("text-xs font-bold drop-shadow-md mt-1", userVote?.vote_type === "bomb" ? "text-orange-400" : "text-white")}>
              {bombVotes}
            </span>
          </div>
        )}

        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/20 text-white hover:bg-black/50 backdrop-blur-md transition-all active:scale-90"
            onClick={onComment}
          >
            <MessageCircle className="h-5 w-5 sm:h-7 sm:w-7 drop-shadow-md" />
          </Button>
          <span className="text-white text-xs font-bold drop-shadow-md mt-1">{post.comments?.length || 0}</span>
        </div>

        <div className="flex flex-col items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/20 text-white hover:bg-black/50 backdrop-blur-md transition-all active:scale-90"
            onClick={onShare}
          >
            <Share2 className="h-5 w-5 sm:h-7 sm:w-7 drop-shadow-md" />
          </Button>
          <span className="text-white text-xs font-bold drop-shadow-md mt-1">Compartilhar</span>
        </div>

        {/* Botão de denúncia para Desktop/Mobile no World Flash */}
        {user?.id !== post.user_id && (
          <div className="flex flex-col items-center">
            <ReportButton
              postId={post.id}
              reporterId={user?.id}
              variant="icon"
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/20 text-white hover:bg-black/50 hover:text-orange-500 backdrop-blur-md transition-all active:scale-90"
            />
            <span className="text-white text-xs font-bold drop-shadow-md mt-1 mb-2">Denunciar</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-black/20 text-white hover:bg-black/50 backdrop-blur-md transition-all active:scale-90"
          onClick={() => setIsMuted(!isMuted)}
        >
          {isMuted ? <VolumeX className="h-4 w-4 sm:h-6 sm:w-6 drop-shadow-md" /> : <Volume2 className="h-4 w-4 sm:h-6 sm:w-6 drop-shadow-md" />}
        </Button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-16 sm:pt-20">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 ring-2 ring-white/30 shadow-lg">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback className="bg-gradient-to-tr from-purple-500 to-orange-500 font-bold text-xs sm:text-sm">
              {post.profiles?.username?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <UserLink
              userId={post.user_id}
              username={post.profiles?.username || ''}
              className="font-bold text-white text-sm sm:text-md drop-shadow-md hover:text-pink-300 transition-colors"
            >
              @{post.profiles?.username}
            </UserLink>

            <div className="flex items-center flex-wrap mt-1 gap-2">
              {(post.profiles?.movement_status_enabled || post.profiles?.mood_status_enabled) && (
                <>
                  {post.profiles?.movement_status_enabled && post.profiles?.movement_status && (
                    <MovementStatusBadge
                      userId={post.user_id}
                      snapshotEnabled={true}
                      snapshotStatus={post.profiles.movement_status}
                    />
                  )}
                  {post.profiles?.mood_status_enabled && post.profiles?.current_mood && (
                    <MoodStatusBadge
                      userId={post.user_id}
                      viewerId={user?.id}
                      snapshotEnabled={true}
                      snapshotMood={post.profiles.current_mood}
                      snapshotEmoji={post.profiles.current_mood_emoji || undefined}
                      snapshotPublic={post.profiles.mood_public}
                    />
                  )}
                </>
              )}
            </div>

            <span className="text-xs text-white/70 flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {new Date(post.created_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
        <p className="text-white/95 text-xs sm:text-sm mb-2 line-clamp-3 font-medium drop-shadow-md leading-relaxed pr-4">
          <MentionText text={(post.content) ?? ""} />
        </p>
      </div>
    </div>
  );
};

/* ---------- MODAL DE COMPARTILHAMENTO ---------- */
interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: any;
  user: any;
  onShareComplete: (platform: string) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ open, onOpenChange, post, user, onShareComplete }) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const getShareUrl = () => {
    // CORRIGIDO: Usa Query Param ?post=ID para garantir navegação correta e evitar 404
    const baseUrl = window.location.origin;
    return `${baseUrl}/?post=${post.id}`;
  };

  const getShareText = () => {
    const username = post.profiles?.username || 'usuário';
    const postType = post.post_type === 'viral_clips' ? 'World Flash' : 'World Flow';
    const contentPreview = post.content ?
      (post.content.length > 100 ? post.content.substring(0, 100) + "..." : post.content) :
      "Confira este conteúdo incrível!";

    return `🌟 ${postType} de @${username} no World Flow:\n"${contentPreview}"\n\n🔗 Veja no World Flow: ${getShareUrl()}`;
  };

  const shareOnPlatform = async (platform: string) => {
    try {
      setSharing(true);
      const shareUrl = getShareUrl();
      const shareText = getShareText();
      const encodedText = encodeURIComponent(shareText);
      const encodedUrl = encodeURIComponent(shareUrl);

      let shareWindow = null;

      switch (platform) {
        case 'whatsapp':
          shareWindow = window.open(`https://wa.me/?text=${encodedText}`, '_blank');
          break;
        case 'facebook':
          shareWindow = window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`, '_blank', 'width=600,height=400');
          break;
        case 'twitter':
          shareWindow = window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, '_blank', 'width=550,height=420');
          break;
        case 'telegram':
          shareWindow = window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank', 'width=550,height=420');
          break;
        case 'instagram':
          toast({
            title: "Instagram",
            description: "Para compartilhar no Instagram, abra o app e cole o link!",
          });
          setCopied(true);
          await navigator.clipboard.writeText(shareUrl);
          setTimeout(() => setCopied(false), 2000);
          onShareComplete('instagram');
          break;
        case 'copy':
          const fullText = `${shareText}\n\n📱 Baixe o World Flow: ${window.location.origin}`;
          await navigator.clipboard.writeText(fullText);
          setCopied(true);
          toast({
            title: "Link copiado!",
            description: "O conteúdo foi copiado para a área de transferência.",
          });
          setTimeout(() => setCopied(false), 2000);
          onShareComplete('copy');
          break;
      }

      if (shareWindow && platform !== 'copy' && platform !== 'instagram') {
        // Registra o compartilhamento após abrir a janela
        await registerShare(post.id, platform);
        onShareComplete(platform);

        toast({
          title: "Compartilhando...",
          description: `Abrindo ${platform} para compartilhar.`,
        });
      }
    } catch (error) {
      console.error('Erro ao compartilhar:', error);
      toast({
        variant: "destructive",
        title: "Erro ao compartilhar",
        description: "Não foi possível compartilhar no momento.",
      });
    } finally {
      setSharing(false);
    }
  };

  const handleNativeShare = async () => {
    try {
      setSharing(true);
      const shareData = {
        title: `World Flow - ${post.post_type === 'viral_clips' ? 'World Flash' : 'Post'}`,
        text: getShareText(),
        url: getShareUrl(),
      };

      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        await registerShare(post.id, 'native_share');
        onShareComplete('native_share');
        toast({
          title: "Compartilhado!",
          description: "Post compartilhado com sucesso.",
        });
      } else {
        // Fallback para desktop
        const fallbackText = `${shareData.text}\n\n${shareData.url}`;
        await navigator.clipboard.writeText(fallbackText);
        setCopied(true);
        toast({
          title: "Link copiado!",
          description: "Conteúdo copiado para a área de transferência. Cole em qualquer rede social!",
        });
        setTimeout(() => setCopied(false), 2000);
        onShareComplete('copy');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Erro ao compartilhar:', error);
      }
    } finally {
      setSharing(false);
    }
  };

  const registerShare = async (postId: string, platform: string) => {
    if (!user) return;

    try {
      // Registra o compartilhamento no banco de dados
      const { error } = await supabase
        .from("post_shares")
        .insert({
          post_id: postId,
          user_id: user.id,
          platform: platform,
          shared_at: new Date().toISOString(),
          metadata: {
            user_agent: navigator.userAgent,
            platform_type: 'social',
            post_type: post.post_type,
            share_url: getShareUrl()
          }
        });

      if (error) throw error;

      // Atualiza estatísticas do post
      await supabase.rpc('increment_share_count', { post_uuid: postId });

    } catch (error) {
      console.error('Erro ao registrar compartilhamento:', error);
    }
  };

  const shareOptions = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500 hover:bg-green-600' },
    { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-600 hover:bg-blue-700' },
    { id: 'twitter', label: 'Twitter', icon: Twitter, color: 'bg-sky-500 hover:bg-sky-600' },
    { id: 'telegram', label: 'Telegram', icon: Send, color: 'bg-blue-500 hover:bg-blue-600' },
    { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-pink-600 hover:bg-pink-700' },
    { id: 'copy', label: copied ? 'Copiado!' : 'Copiar Link', icon: copied ? Check : Copy, color: 'bg-gray-700 hover:bg-gray-800' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border text-foreground max-w-md p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="sticky top-0 z-10 bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">Compartilhar {post.post_type === 'viral_clips' ? 'World Flash' : 'Post'}</DialogTitle>
              <DialogDescription className="text-gray-400 text-sm">
                Compartilhe este conteúdo com seus amigos
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          {/* Native Share Button */}
          <div className="mb-6">
            <Button
              onClick={handleNativeShare}
              disabled={sharing}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-12 rounded-lg"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Share2 className="h-4 w-4 mr-2" />
              )}
              {navigator.share ? 'Compartilhar no Dispositivo' : 'Copiar para Compartilhar'}
            </Button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {navigator.share
                ? 'Usa o sistema de compartilhamento do seu dispositivo'
                : 'Copie o link e cole em qualquer rede social'}
            </p>
          </div>

          <Separator className="bg-gray-800 my-4" />

          {/* Social Media Options */}
          <div className="mb-4">
            <h3 className="font-medium mb-3 text-gray-300">Compartilhar em redes sociais</h3>
            <div className="grid grid-cols-3 gap-3">
              {shareOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <TooltipProvider key={option.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => shareOnPlatform(option.id)}
                          disabled={sharing}
                          className={cn(
                            "h-14 flex flex-col gap-1 rounded-lg",
                            option.color,
                            option.id === 'copy' && copied && "bg-green-600 hover:bg-green-700"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs font-medium">{option.label}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Compartilhar no {option.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>

          {/* Post Preview */}
          <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-10 w-10 ring-1 ring-purple-500/30">
                <AvatarImage src={post.profiles?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600">
                  {post.profiles?.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-white flex items-center gap-1.5">
                  @{post.profiles?.username}
                  {post.profiles?.registration_number ? (
                    <GoldSeal registrationNumber={post.profiles.registration_number} />
                  ) : null}
                </p>
                <p className="text-xs text-gray-400">
                  {post.post_type === 'viral_clips' ? '🎬 World Flash' : '🌍 World Flow'}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-300 line-clamp-2 mb-3">
              {post.content || "Post sem texto..."}
            </p>
            {post.media_urls?.[0] && (
              <div className="mt-3 rounded overflow-hidden border border-gray-700">
                {isVideoUrl(post.media_urls[0]) ? (
                  <div className="aspect-video bg-black flex items-center justify-center">
                    <div className="relative w-full h-full">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-pink-900/20"></div>
                      <Film className="h-10 w-10 text-purple-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={stripPrefix(post.media_urls[0])}
                    alt="Preview"
                    className="w-full h-32 object-cover"
                  />
                )}
              </div>
            )}
            <div className="mt-3 text-xs text-gray-400">
              <p>🔗 Link permanente: <span className="text-purple-300 break-all">{getShareUrl()}</span></p>
            </div>
          </div>

          {/* Share Stats */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Share2 className="h-3 w-3" />
                {post.share_count || 0} compartilhamentos
              </span>
            </div>
            <Badge variant="outline" className="border-gray-700">
              {post.post_type === 'viral_clips' ? '🎬 World Flash' : '🌍 World Flow'}
            </Badge>
          </div>
        </div>

        <div className="border-t border-gray-800 p-4">
          <Button
            variant="outline"
            className="w-full border-gray-700 hover:bg-gray-800 rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ---------- MODAL DE CRIAÇÃO SEPARADO ---------- */
interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  onSuccess: () => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ open, onOpenChange, user, onSuccess }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [newPost, setNewPost] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [postType, setPostType] = useState<'standard' | 'viral_clips'>('standard');
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [aiEditing, setAiEditing] = useState<{
    open: boolean;
    imageIndex: number;
    selectedStyle: string | null;
    loading: boolean;
  }>({
    open: false,
    imageIndex: -1,
    selectedStyle: null,
    loading: false
  });

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoInputRef = useRef<HTMLInputElement>(null);

  const getAcceptedMediaTypes = () => {
    if (postType === 'viral_clips') {
      return {
        gallery: 'video/*',
        cameraPhoto: null,
        cameraVideo: 'video/*'
      };
    } else {
      return {
        gallery: 'image/*,video/*',
        cameraPhoto: 'image/*',
        cameraVideo: 'video/*'
      };
    }
  };

  const mediaTypes = getAcceptedMediaTypes();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const MAX_PHOTOS = 6;
    const incoming = Array.from(files);
    const isMultiPhoto = incoming.length > 1 || (incoming.length === 1 && mediaFiles.length > 0 && mediaFiles[0].type.startsWith('image/') && incoming[0].type.startsWith('image/'));

    // World Flash: apenas 1 vídeo
    if (postType === 'viral_clips') {
      const file = files[0];
      if (!file.type.startsWith('video/')) {
        toast({
          variant: "destructive",
          title: "Tipo de arquivo inválido",
          description: "Para World Flash, apenas vídeos são permitidos."
        });
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 100MB"
        });
        return;
      }
      try {
        const processedFile = await processMediaFile(file);
        setMediaFiles([processedFile]);
        setShowMediaOptions(false);
      } catch {
        toast({ variant: "destructive", title: "Erro ao processar arquivo" });
      }
      return;
    }

    // World Flow (standard): até 6 fotos OU 1 vídeo
    const allImage = incoming.every(f => f.type.startsWith('image/'));
    const allVideo = incoming.every(f => f.type.startsWith('video/'));

    if (allVideo) {
      if (incoming.length > 1) {
        toast({ variant: "destructive", title: "Apenas 1 vídeo por post" });
        return;
      }
      if (incoming[0].size > 100 * 1024 * 1024) {
        toast({ variant: "destructive", title: "Arquivo muito grande", description: "Máximo 100MB" });
        return;
      }
      try {
        const processedFile = await processMediaFile(incoming[0]);
        setMediaFiles([processedFile]);
        setShowMediaOptions(false);
      } catch {
        toast({ variant: "destructive", title: "Erro ao processar vídeo" });
      }
      return;
    }

    if (!allImage) {
      toast({ variant: "destructive", title: "Mix de fotos e vídeo não permitido", description: "Envie apenas fotos ou apenas 1 vídeo" });
      return;
    }

    // Fotos: até 6, somando com as existentes
    const existing = mediaFiles.filter(f => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - existing.length;
    if (room <= 0) {
      toast({ variant: "destructive", title: `Máximo ${MAX_PHOTOS} fotos por post` });
      return;
    }
    const toAdd = incoming.slice(0, room);
    if (incoming.length > room) {
      toast({ description: `Adicionando ${toAdd.length} de ${incoming.length} fotos (limite ${MAX_PHOTOS})` });
    }
    const processed: File[] = [];
    for (const f of toAdd) {
      if (f.size > 100 * 1024 * 1024) {
        toast({ variant: "destructive", title: `${f.name} excede 100MB` });
        continue;
      }
      try {
        processed.push(await processMediaFile(f));
      } catch {}
    }
    if (processed.length > 0) {
      setMediaFiles([...existing, ...processed]);
      setShowMediaOptions(false);
    }
  };

  const openCameraPhoto = () => {
    if (cameraPhotoInputRef.current) {
      cameraPhotoInputRef.current.click();
    }
  };

  const openCameraVideo = () => {
    if (cameraVideoInputRef.current) {
      cameraVideoInputRef.current.click();
    }
  };

  const openGallery = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  const removeMedia = (index?: number) => {
    if (typeof index === "number") {
      setMediaFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setMediaFiles([]);
    }
  };

  const handleApplyStyle = async (styleId: string) => {
    const selectedStyle = AI_STYLES.find(s => s.id === styleId);
    if (!selectedStyle || aiEditing.imageIndex === -1) return;

    setAiEditing(prev => ({ ...prev, loading: true, selectedStyle: styleId }));

    try {
      const base64Image = await fileToBase64(mediaFiles[aiEditing.imageIndex]);
      let processed: string;

      try {
        const res = await fetch('/api/huggingface-proxy', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: selectedStyle.prompt, image: base64Image })
        });
        const json = await res.json();

        if (!res.ok || !json.success) throw new Error("Fallback");
        processed = json.image;
        toast({ title: "✨ Sucesso Nuvem", description: selectedStyle.label });
      } catch {
        processed = await processImageLocally(base64Image, selectedStyle.filter);
        toast({ title: "⚡ Sucesso Local", description: selectedStyle.label });
      }

      const newFile = await createFileFromBase64(processed, `ai-${styleId}-${Date.now()}.jpg`);
      setMediaFiles(p => {
        const n = [...p];
        n[aiEditing.imageIndex] = newFile;
        return n;
      });

      setAiEditing({ open: false, imageIndex: -1, selectedStyle: null, loading: false });
    } catch {
      toast({ variant: "destructive", title: "Erro ao aplicar estilo" });
      setAiEditing(p => ({ ...p, loading: false }));
    }
  };

  const handleCreatePost = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erro de autenticação",
        description: "Você precisa estar logado para criar um post."
      });
      return;
    }

    if (!newPost.trim() && mediaFiles.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Adicione texto ou mídia para postar"
      });
      return;
    }

    setUploading(true);

    try {
      const mediaUrls: string[] = [];

      if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const { url } = await uploadToCloudinary(file, { kind: "posts", userId: user.id });
          mediaUrls.push(url);
        }
      }

      const votingEndsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();


      // Snapshot dos status do usuário no momento da postagem (movimento + humor)
      const { data: statusSnap } = await supabase
        .from("profiles")
        // CORRECAO: `mood_public` faltava aqui, mas era lido logo abaixo em
        // `mood_public_at_post`. Sem a coluna no select o valor era undefined
        // e o `?? true` marcava TODO post como humor publico, inclusive de
        // quem tinha o humor privado.
        .select("movement_status, movement_status_enabled, mood_status_enabled, current_mood, current_mood_emoji, mood_public")
        .eq("id", user.id)
        .single();

      const { data: newPostData, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: newPost,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          post_type: postType,
          voting_period_active: true,
          voting_ends_at: votingEndsAt,
          is_community_approved: false,
          movement_status_at_post: (statusSnap as any)?.movement_status ?? null,
          movement_status_enabled_at_post: !!(statusSnap as any)?.movement_status_enabled,
          mood_at_post: (statusSnap as any)?.current_mood ?? null,
          mood_emoji_at_post: (statusSnap as any)?.current_mood_emoji ?? null,
          mood_status_enabled_at_post: !!(statusSnap as any)?.mood_status_enabled,
          mood_public_at_post: ((statusSnap as any)?.mood_public ?? true),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar post:', error);
        throw error;
      }

      try {
        if (newPostData?.id && user?.id) {
          const { saveMentions } = await import("@/utils/mentionsHelper");
          await saveMentions(newPostData.id, "post", newPost || "", user.id);
        }
      } catch (e) {
        console.warn('Falha ao salvar menções do post', e);
      }

      // Nota: o webhook do Supabase (db-webhook.js) envia o push automaticamente ao INSERT de posts.

      toast({
        title: "🎯 Post enviado para a Arena!",
        description: `Seu post ${postType === 'viral_clips' ? '(World Flash)' : ''} tem 60 minutos para receber votos!`,
        duration: 5000
      });

      setNewPost("");
      setMediaFiles([]);
      onOpenChange(false);

      queryClient.invalidateQueries({ queryKey: ["arena-posts"] });
      queryClient.invalidateQueries({ queryKey: ["arena-my-posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts-infinite"] });

      setTimeout(() => {
        navigate('/arena');
      }, 2000);

      onSuccess();

    } catch (e: any) {
      console.error('Erro geral ao criar post:', e);
      toast({
        variant: "destructive",
        title: "Erro ao criar post",
        description: e.message || "Erro desconhecido. Tente novamente."
      });
    }
    finally {
      setUploading(false);
    }
  };

  const renderMediaOptions = () => {
    if (postType === 'viral_clips') {
      return (
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-14 flex-col gap-1 border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 text-xs sm:text-sm"
            onClick={openCameraVideo}
          >
            <VideoIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs">Gravar Vídeo</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-14 flex-col gap-1 border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 text-xs sm:text-sm"
            onClick={openGallery}
          >
            <Video className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs">Galeria de Vídeos</span>
          </Button>
        </div>
      );
    } else {
      return (
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-14 flex-col gap-1 border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 text-xs sm:text-sm"
            onClick={openCameraPhoto}
          >
            <CameraIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs">Tirar Foto</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-14 flex-col gap-1 border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 text-xs sm:text-sm"
            onClick={openCameraVideo}
          >
            <VideoIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs">Gravar Vídeo</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-12 sm:h-14 flex-col gap-1 border-gray-700 bg-gray-800/30 hover:bg-gray-800/50 col-span-2 text-xs sm:text-sm"
            onClick={openGallery}
          >
            <Images className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs">Galeria (Fotos e Vídeos)</span>
          </Button>
        </div>
      );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background border border-border text-foreground max-w-lg w-[95vw] sm:w-[90vw] max-h-[92vh] sm:max-h-[88vh] overflow-y-auto shadow-2xl shadow-black/60 p-0 rounded-3xl z-[9999]" aria-describedby={undefined}>
          <div className="sticky top-0 z-20 bg-background/98 backdrop-blur-xl border-b border-border/50 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Timer className="h-5 w-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold leading-none">Criar Novo Post</DialogTitle>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                    {postType === 'viral_clips' ? "World Flash — apenas vídeos" : "Será enviado para a Arena para votação"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={cn(
                  "text-[10px] px-2.5 py-1 rounded-full font-bold border-0 shadow-sm",
                  postType === 'viral_clips'
                    ? "bg-gradient-to-r from-pink-500 to-purple-500"
                    : "bg-gradient-to-r from-amber-500 to-orange-500"
                )}>
                  {postType === 'viral_clips' ? <Film className="h-3 w-3 mr-1" /> : <Timer className="h-3 w-3 mr-1" />}
                  {postType === 'viral_clips' ? 'Flash' : '60min'}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-800 text-muted-foreground hover:text-foreground" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setPostType('standard'); setMediaFiles([]); }}
                className={cn(
                  "h-12 rounded-2xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 border-2",
                  postType === 'standard'
                    ? "bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10"
                    : "bg-gray-900/60 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300"
                )}
              >
                <Globe className="h-4.5 w-4.5" /> World Flow
              </button>
              <button
                type="button"
                onClick={() => { setPostType('viral_clips'); setMediaFiles([]); }}
                className={cn(
                  "h-12 rounded-2xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 border-2",
                  postType === 'viral_clips'
                    ? "bg-pink-600/20 border-pink-500 text-pink-400 shadow-lg shadow-pink-500/10"
                    : "bg-gray-900/60 border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-300"
                )}
              >
                <Film className="h-4.5 w-4.5" /> World Flash
              </button>
            </div>

            <div className="relative">
              <MentionTextarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder={postType === 'viral_clips' ? "Descreva seu World Flash… use @ para mencionar" : "No que você está pensando? Use @ para mencionar alguém…"}
                className="w-full bg-gray-900/80 border border-gray-800 rounded-2xl p-4 pb-10 min-h-[110px] sm:min-h-[120px] text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all resize-none text-[15px] leading-relaxed"
              />
              <span className="absolute bottom-3 right-14 text-[10px] text-gray-600 font-mono">{newPost.length}/500</span>
            </div>

            <input
              type="file"
              ref={galleryInputRef}
              className="hidden"
              accept={mediaTypes.gallery || ''}
              multiple={postType !== 'viral_clips'}
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            />
            <input
              type="file"
              ref={cameraPhotoInputRef}
              className="hidden"
              accept={mediaTypes.cameraPhoto || ''}
              capture="environment"
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            />
            <input
              type="file"
              ref={cameraVideoInputRef}
              className="hidden"
              accept={mediaTypes.cameraVideo || ''}
              capture="environment"
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            />

            <div className="mt-3 sm:mt-4">
              {mediaFiles.length === 0 ? (
                <>
                  {!showMediaOptions ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-2 border-gray-600/50 bg-gray-800/20 hover:bg-gray-800/40 hover:border-primary/30 h-12 rounded-2xl text-sm font-medium"
                      onClick={() => setShowMediaOptions(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {mediaFiles.length > 0
                        ? `Adicionar mais (${mediaFiles.length}/6)`
                        : postType === 'viral_clips' ? 'Adicionar Vídeo' : 'Adicionar Fotos'}
                    </Button>
                  ) : (
                    <div className="space-y-3 animate-in fade-in">
                      {renderMediaOptions()}

                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-muted-foreground hover:text-foreground text-sm"
                        onClick={() => setShowMediaOptions(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  {/* Múltiplas fotos */}
                  {mediaFiles.length > 1 && mediaFiles.every(f => f.type.startsWith('image/')) ? (
                    <div className="grid grid-cols-3 gap-2">
                      {mediaFiles.map((file, idx) => (
                        <div key={idx} className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-800/30 aspect-square">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-red-600/90 hover:bg-red-700"
                            onClick={() => removeMedia(idx)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : mediaFiles[0].type.startsWith('image/') ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-800/30">
                      <img
                        src={URL.createObjectURL(mediaFiles[0])}
                        alt="Preview"
                        className="w-full h-40 sm:h-48 object-contain bg-black"
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-600 hover:bg-blue-700"
                          onClick={() => setAiEditing({
                            open: true,
                            imageIndex: 0,
                            selectedStyle: null,
                            loading: false
                          })}
                        >
                          <Wand2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-600 hover:bg-red-700"
                          onClick={() => removeMedia(0)}
                        >
                          <X className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-800/30">
                      <video
                        src={URL.createObjectURL(mediaFiles[0])}
                        controls
                        className="w-full h-40 sm:h-48 object-contain bg-black"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-red-600 hover:bg-red-700"
                        onClick={() => removeMedia(0)}
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    {mediaFiles.length} arquivo(s) • {Math.round(mediaFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024 * 100) / 100}MB
                  </p>
                </div>
              )}
            </div>

            <div className="mt-1 p-3.5 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-900/40 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg",
                  postType === 'viral_clips'
                    ? "bg-gradient-to-br from-pink-500 to-purple-600 shadow-pink-500/20"
                    : "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20"
                )}>
                  {postType === 'viral_clips' ? <Film className="h-4.5 w-4.5 text-white" /> : <Timer className="h-4.5 w-4.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white text-[13px]">
                    {postType === 'viral_clips' ? 'World Flash' : 'Sistema de Votação'}
                  </h4>
                  <div className="flex items-center gap-2.5 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-[11px] font-semibold text-red-300">
                      <Heart className="h-3 w-3 text-red-400" /> Aprovar
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800/60 border border-gray-700/40 text-[11px] font-semibold text-gray-400">
                      <Bomb className="h-3 w-3 text-gray-500" /> Rejeitar
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-gray-400 mt-2">
                    60 minutos em votação. Aprova se <span className="text-red-400">❤️</span> for <strong className="text-white">MAIOR</strong> que <span className="text-gray-300">💣</span> (empate reprova).
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreatePost}
              disabled={uploading || (!newPost.trim() && mediaFiles.length === 0)}
              className={cn(
                "w-full h-12 rounded-2xl font-bold text-[15px] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg",
                postType === 'viral_clips'
                  ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:shadow-xl hover:shadow-pink-500/25"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-xl hover:shadow-blue-500/25"
              )}
            >
              {uploading ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Enviando...
                </span>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {postType === 'viral_clips' ? 'Enviar World Flash' : 'Enviar para Votação'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiEditing.open} onOpenChange={o => setAiEditing(p => ({ ...p, open: o }))}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-background border-border text-foreground" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-400" />
              Estúdio Mágico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {mediaFiles[aiEditing.imageIndex] && (
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center">
                <img
                  src={URL.createObjectURL(mediaFiles[aiEditing.imageIndex])}
                  className="w-full h-full object-contain"
                  alt="Imagem para edição"
                />
                {aiEditing.loading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <Wand2 className="h-10 w-10 animate-spin text-purple-400 mb-2" />
                    <span className="font-bold">Aplicando mágica...</span>
                  </div>
                )}
              </div>
            )}
            <ScrollArea className="h-48">
              <div className="grid grid-cols-2 gap-2 pr-4">
                {AI_STYLES.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      disabled={aiEditing.loading}
                      onClick={() => handleApplyStyle(s.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border border-gray-700 text-left transition-all hover:bg-gray-800",
                        aiEditing.loading && "opacity-50"
                      )}
                    >
                      <div className={cn("p-2 rounded-lg", s.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAiEditing(p => ({ ...p, open: false }))}
              className="text-muted-foreground hover:text-foreground"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ---------- COMPONENTE DE VIDEO PARA DESKTOP ---------- */
interface DesktopVideoPlayerProps {
  src: string;
  post: any;
  userId?: string;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onFullscreen: () => void;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
}

const DesktopVideoPlayer = ({
  src,
  post,
  userId,
  isPlaying,
  onPlayToggle,
  onFullscreen,
  onLike,
  onComment,
  onShare
}: DesktopVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const isLiked = post.likes?.some((l: any) => l.user_id === userId);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => { /* expected on autoplay restriction */ });
    } else {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = isMuted;
    }
  }, [isMuted]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-black group h-[500px]">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onClick={onPlayToggle}
        id={`video-${post.id}`}
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
              onClick={onPlayToggle}
            >
              {isPlaying ? (
                <div className="w-2 h-3 bg-white" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>

            <div className="text-xs text-white ml-2">
              {Math.floor(videoRef.current?.currentTime || 0)}s
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
            onClick={onFullscreen}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-full h-1 bg-gray-700 mt-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
          onClick={onLike}
        >
          <Heart className={cn("h-4 w-4", isLiked && "fill-red-500 text-red-500")} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
          onClick={onComment}
        >
          <MessageCircle className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 bg-black/50 text-white hover:bg-black/70"
          onClick={onShare}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

/* ---------- SELETOR DE MODO FEED / VÍDEOS ---------- */
interface FeedModeToggleProps {
  mode: "feed" | "videos";
  onChange: (mode: "feed" | "videos") => void;
}

const FeedModeToggle = ({ mode, onChange }: FeedModeToggleProps) => {
  const options = [
    { id: "feed" as const, label: "Feed", icon: Globe },
    { id: "videos" as const, label: "Vídeos", icon: Film },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full bg-muted/80 border border-border/40 p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

/* ---------- COMPONENTE PRINCIPAL ---------- */
export default function WorldFlow() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // CORREÇÃO: Inicialização dos params

  const [verticalIndex, setVerticalIndex] = useState(0);
  const [horizontalClipIndex, setHorizontalClipIndex] = useState(0);

  const [openingCommentsFor, setOpeningCommentsFor] = useState<any>(null);
  const [showLikesFor, setShowLikesFor] = useState<any>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<{ id: string; username: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [feedTab, setFeedTab] = useState<"all" | "friends" | "recent">("all");
  const { data: bookmarkedIds, refetch: refetchBookmarks } = useBookmarkedPostIds();
  const toggleBookmark = useToggleBookmark();
  const togglePin = useTogglePin();

  const isBookmarked = (postId: string) => bookmarkedIds?.has(postId) || false;

  const handleBookmark = (postId: string) => {
    toggleBookmark.mutate(postId, {
      onSuccess: (data: any) => {
        refetchBookmarks();
      },
    });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth < 768);

  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [fullscreenVideo, setFullscreenVideo] = useState<{ src: string, post: any } | null>(null);
  const [shareModalPost, setShareModalPost] = useState<any>(null);

  const [editingPost, setEditingPost] = useState<any>(null);
  const [editContent, setEditContent] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const isBoosted = useCallback((post: any) => {
    return !!post.boost_until && new Date(post.boost_until).getTime() > Date.now();
  }, []);

  const boostPost = async (post: any) => {
    try {
      const res = await consumeFeature("boost_destaque", crypto.randomUUID());
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Não foi possível impulsionar",
          description: featureReasonMessage(res),
        });
        return;
      }
      const boostUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      // CORRECAO: o credito ja foi consumido acima. Se este update falhar
      // (RLS, rede), as moedas sumiam e a UI dizia "impulsionado" mesmo assim.
      const { error: boostError } = await supabase
        .from("posts")
        .update({ boost_until: boostUntil })
        .eq("id", post.id);
      if (boostError) throw boostError;
      toast({
        title: "Post impulsionado!",
        description: "Seu post ficará em destaque no feed por 2 horas.",
      });
      queryClient.invalidateQueries({ queryKey: ["posts-infinite", user?.id] });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível impulsionar",
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  };

  const pendingNewCount = 0;

  const [shortsViewerIndex, setShortsViewerIndex] = useState<number | null>(null);

  const [feedMode, setFeedMode] = useState<"feed" | "videos">("feed");
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoMuted, setVideoMuted] = useState(true);
  const feedModeRef = useRef<"feed" | "videos">("feed");

  useEffect(() => {
    feedModeRef.current = feedMode;
  }, [feedMode]);

  const verticalIndexRef = useRef<number>(0);
  const modalOpenRef = useRef<boolean>(false);
  const tutorialOpenRef = useRef<boolean>(false);
  const knownPostIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { verticalIndexRef.current = verticalIndex; }, [verticalIndex]);
  useEffect(() => { modalOpenRef.current = isModalOpen; }, [isModalOpen]);

  useEffect(() => {
    const handleExtensionError = (e: ErrorEvent) => {
      if (e.message?.includes?.('Could not establish connection') ||
        e.message?.includes?.('Receiving end does not exist')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (e.reason?.message?.includes?.('Could not establish connection')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener('error', handleExtensionError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleExtensionError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);



  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const {
    data: infiniteData,
    refetch: refetchFeed,
    isLoading: postsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["posts-infinite", user?.id],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      try {
        let query = supabase
          .from("posts")
          .select(`
            *, 
            profiles:user_id (
              id,
              username,
              avatar_url,
              full_name,
              registration_number,
              movement_status_enabled,
              movement_status,
              mood_status_enabled,
              current_mood,
              current_mood_emoji,
              mood_public
            ), 
            likes (id, user_id), 
            comments (id), 
            post_votes (id, user_id, vote_type),
            post_shares(count)
          `)
          .eq("is_community_approved", true)
          .order("boost_until", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(20);

        if (pageParam) {
          query = query.lt("created_at", pageParam);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(post => ({
          ...post,
          media_urls: Array.isArray(post.media_urls) ? post.media_urls.filter(url => url && typeof url === 'string').map(url => url.trim()) : [],
          share_count: (post.post_shares as any)?.[0]?.count || 0
        }));
      } catch (error) {
        // CORRECAO: devolver [] fazia o React Query tratar a falha como
        // sucesso — sem retry, sem estado de erro, e como a pagina vinha com
        // menos de 20 itens o getNextPageParam devolvia null e a rolagem
        // infinita morria de vez, mostrando "Nenhum post ainda".
        console.error("Erro query posts:", error);
        throw error;
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: any) => {
      if (!lastPage || !Array.isArray(lastPage) || lastPage.length < 20) return null;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const rawPosts = useMemo(() => {
    return infiniteData?.pages ? (infiniteData.pages.flat() as any[]) : [];
  }, [infiniteData]);

  const {
    data: videoFeedData,
    isLoading: videoPostsLoading,
    fetchNextPage: fetchNextVideoPage,
    hasNextPage: hasNextVideoPage,
    isFetchingNextPage: isFetchingNextVideoPage,
  } = useInfiniteQuery({
    queryKey: ["videos-infinite", user?.id],
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      try {
        let query = supabase
          .from("posts")
          .select(`
            *, 
            profiles:user_id (
              id,
              username,
              avatar_url,
              full_name,
              registration_number,
              movement_status_enabled,
              movement_status,
              mood_status_enabled,
              current_mood,
              current_mood_emoji,
              mood_public
            ), 
            likes (id, user_id), 
            comments (id), 
            post_votes (id, user_id, vote_type),
            post_shares(count)
          `)
          .eq("is_community_approved", true)
          .not("media_urls", "is", null)
          .order("created_at", { ascending: false })
          .limit(20);

        if (pageParam) {
          query = query.lt("created_at", pageParam);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(post => ({
          ...post,
          media_urls: Array.isArray(post.media_urls) ? post.media_urls.filter(url => url && typeof url === 'string').map(url => url.trim()) : [],
          share_count: post.post_shares?.[0]?.count ?? 0
        }));
      } catch (error) {
        console.error("Erro query vídeos:", error);
        return [];
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: unknown) => {
      if (!Array.isArray(lastPage) || lastPage.length < 20) return null;
      return lastPage[lastPage.length - 1]?.created_at;
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const videoPosts = useMemo(() => {
    const pages = videoFeedData?.pages ?? [];
    return pages.flat().filter((post) => {
      const mediaUrls = (post as { media_urls?: string[] | null }).media_urls;
      return Array.isArray(mediaUrls) && mediaUrls.some((url) => isVideoUrl(url));
    }) as VideoFeedPost[];
  }, [videoFeedData]);

  const [stuckLoading, setStuckLoading] = useState(false);
  useEffect(() => {
    if (!postsLoading) return;
    const t = setTimeout(() => setStuckLoading(true), 25000);
    return () => clearTimeout(t);
  }, [postsLoading]);

  useEffect(() => {
    const ids = new Set<string>();
    (rawPosts ?? []).forEach((p: any) => { if (p?.id) ids.add(p.id); });
    knownPostIdsRef.current = ids;
  }, [rawPosts]);

  const { data: arenaPosts } = useQuery({
    queryKey: ["arena-my-posts", user?.id],
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
            post_votes (id, user_id, vote_type)
          `)
          .eq("is_community_approved", false)
          .eq("voting_period_active", true) // Só buscar posts ativos em votação
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (error) { console.error("Erro query arena posts:", error); return []; }
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });



  // Mantém o Feed sempre atualizado (sem precisar dar refresh manual)
  useEffect(() => {
    if (!user?.id) return;

    let debounce: any = null;

    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["posts-infinite", user.id] });
        queryClient.invalidateQueries({ queryKey: ["arena-my-posts", user.id] });
        queryClient.invalidateQueries({ queryKey: ["videos-infinite", user.id] });
      }, 300);
    };

    const onChange = () => trigger();

    const channel = supabase
      .channel(`worldflow-realtime-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_votes" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_shares" }, onChange)
      .subscribe();

    // Remove old non-infinite query cache
    queryClient.removeQueries({ queryKey: ["posts", user.id] });

    const onVis = () => {
      if (document.visibilityState === "visible") trigger();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const feedStructure = useMemo(() => {
    if (!rawPosts) return [];
    const standardPosts = rawPosts.filter(p => p.post_type === 'standard');
    const clipPosts = rawPosts.filter(p => p.post_type === 'viral_clips');
    const structure: any[] = [];
    const initialBatch = standardPosts.slice(0, 3);
    initialBatch.forEach(post => structure.push({ type: 'standard', data: post }));
    if (clipPosts.length > 0) {
      structure.push({ type: 'clip_container', items: clipPosts });
    }
    const remainingBatch = standardPosts.slice(3);
    remainingBatch.forEach(post => structure.push({ type: 'standard', data: post }));

    if (isFetchingNextPage) {
      structure.push({ type: 'loader' });
    }

    return structure;
  }, [rawPosts, isFetchingNextPage]);

  // CORREÇÃO: Lógica unificada de "Scroll to ID" para Mobile e Desktop
  useEffect(() => {
    const postIdFromUrl = searchParams.get('post');
    if (postIdFromUrl && rawPosts && !postsLoading && feedStructure.length > 0) {

      if (isMobile) {
        // Lógica Mobile (Feed estilo TikTok - Navegação por Índice)
        const index = feedStructure.findIndex(item => {
          if (item.type === 'standard' && item.data.id === postIdFromUrl) return true;
          if (item.type === 'clip_container') {
            return item.items.some((c: any) => c.id === postIdFromUrl);
          }
          return false;
        });

        if (index !== -1) {
          setVerticalIndex(index);
          // Se o post estiver dentro de um container de Clips (World Flash), ajusta o índice horizontal
          if (feedStructure[index].type === 'clip_container') {
            const clipIdx = feedStructure[index].items.findIndex((c: any) => c.id === postIdFromUrl);
            if (clipIdx !== -1) setHorizontalClipIndex(clipIdx);
          }
        }
      } else {
        // Lógica Desktop (Scroll Suave até o Elemento HTML)
        setTimeout(() => {
          const element = document.getElementById(`post-${postIdFromUrl}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Adiciona destaque visual temporário
            element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'transition-all');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
            }, 2000);
          }
        }, 500); // Timeout para garantir renderização do DOM
      }
    }
  }, [searchParams, rawPosts, postsLoading, feedStructure, isMobile]);

  const currentFeedItem = feedStructure[verticalIndex];

  const standardPosts = useMemo(() => {
    return rawPosts?.filter(p => p.post_type === 'standard') || [];
  }, [rawPosts]);

  const clipPosts = useMemo(() => {
    return rawPosts?.filter(p => p.post_type === 'viral_clips') || [];
  }, [rawPosts]);

  const handleVote = async (postId: string, voteType: "heart" | "bomb") => {
    try {
      const existingVote = rawPosts?.find((p) => p.id === postId)?.post_votes?.find((v: any) => v.user_id === user?.id);
      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          const { error } = await supabase.from("post_votes").delete().match({ post_id: postId, user_id: user?.id });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("post_votes").update({ vote_type: voteType }).match({ post_id: postId, user_id: user?.id });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("post_votes").insert({ post_id: postId, user_id: user?.id, vote_type: voteType });
        if (error) throw error;
      }
      refetchFeed();
    } catch (error) {
      const voteErr = error as any;
      if (voteErr?.code === "23505") {
        const { error: updErr } = await supabase
          .from("post_votes")
          .update({ vote_type: voteType })
          .match({ post_id: postId, user_id: user?.id });
        if (updErr) {
          console.error("Erro ao votar (update):", updErr);
          toast({ variant: "destructive", title: "Erro ao votar", description: "Não foi possível registrar seu voto. Tente novamente." });
          return;
        }
        refetchFeed();
        return;
      }
      console.error("Erro ao votar:", error);
      toast({ variant: "destructive", title: "Erro ao votar", description: "Você precisa ser amigo do autor para votar nesta publicação." });
    }
  };

  const getTimeRemaining = (votingEndsAt: string) => {
    const now = new Date();
    const end = new Date(votingEndsAt);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return "Votação encerrada";
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m restantes`;
  };

  const openEdit = (post: any) => {
    setEditingPost(post);
    setEditContent(post.content || "");
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingPost) return;
      const { error } = await supabase.from("posts").update({ content: editContent, updated_at: new Date().toISOString() }).eq("id", editingPost.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingPost(null);
      queryClient.invalidateQueries({ queryKey: ["posts-infinite", user?.id] });
      toast({ title: "Post atualizado!" });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: e?.message ?? "Tente novamente." });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      // Deletar o post dispara o ON DELETE CASCADE nas tabelas filhas (comments, likes, etc.)
      // Isso evita erros de RLS do lado do front-end quando um Admin apaga posts de terceiros
      await supabase.from("posts").delete().eq("id", postId).throwOnError();
    },
    onSuccess: () => {
      toast({ title: "Post excluído." });
      queryClient.invalidateQueries({ queryKey: ["posts-infinite", user?.id] });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Erro ao excluir", description: e?.message ?? "Tente novamente." });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await supabase.from("comments").delete().eq("id", commentId).throwOnError();
    },
    onSuccess: () => {
      toast({ title: "Comentário excluído." });
      queryClient.invalidateQueries({ queryKey: ["post-comments"] });
      refetchFeed();
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Erro ao excluir comentário", description: e?.message ?? "Tente novamente." });
    },
  });

  const handleLike = async (postId: string) => {
    try {
      const post = rawPosts?.find(p => p.id === postId);
      if (!post) return;
      const hasLiked = post.likes?.some((l: any) => l.user_id === user?.id);
      if (hasLiked) {
        const likeId = post.likes.find((l: any) => l.user_id === user?.id)?.id;
        if (likeId) await supabase.from("likes").delete().eq("id", likeId).throwOnError();
      } else {
        await supabase.from("likes").insert({ post_id: postId, user_id: user?.id }).throwOnError();
      }
      refetchFeed();
    } catch (e: any) { 
        console.error(e); 
        toast({ variant: "destructive", title: "Erro ao curtir", description: e.message || "Tente novamente mais tarde." });
    }
  };

  const addComment = useMutation({
    mutationFn: async () => {
      if (openingCommentsFor && newCommentText.trim()) {
        const payload: any = {
          post_id: openingCommentsFor.id,
          user_id: user!.id,
          content: newCommentText.trim()
        };

        if (replyingToComment) {
          payload.parent_id = replyingToComment.id;
        }

        const { data, error } = await supabase
          .from("comments")
          .insert(payload)
          .select().single();

        if (error) throw error;

        try {
          if (data?.id && user?.id) {
            const { saveMentions } = await import("@/utils/mentionsHelper");
            await saveMentions(data.id, "comment", newCommentText.trim(), user.id);
          }
        } catch (e) {
          console.warn('Falha ao salvar menções do comentário', e);
        }

        try {
          if (data?.id) {
            // Nota: o webhook do Supabase (db-webhook.js) envia o push de comentário automaticamente.
          }
        } catch (e) {
          console.warn('Falha ao disparar push de comentário', e);
        }

        return data;
      }
    },
    onSuccess: () => {
      setNewCommentText("");
      setReplyingToComment(null);
      queryClient.invalidateQueries({ queryKey: ["post-comments"] });
      refetchFeed();
    },
    onError: (err) => toast({ variant: "destructive", title: "Erro", description: err.message })
  });

  const { data: rawComments, isLoading: loadingComments } = useQuery({
    queryKey: ["post-comments", openingCommentsFor?.id],
    enabled: !!openingCommentsFor,
    queryFn: async () => {
      if (!openingCommentsFor) return [];
      const { data } = await supabase
        .from("comments")
        .select(`
          *, 
          profiles!comments_user_id_fkey(username, avatar_url),
          comment_likes(user_id)
        `)
        .eq("post_id", openingCommentsFor.id)
        .order("created_at", { ascending: true });
      return data || [];
    }
  });

  // Transforma os comentários raw em uma árvore hierárquica usando parent_id
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

  const getMediaUrl = (post: any) => {
    if (!post?.media_urls?.length) return null;
    return post.media_urls[0].replace(/^(image::|video::|audio::)/, '');
  };

  const handleShare = (post: any) => {
    setShareModalPost(post);
  };

  const handleShareComplete = (platform: string) => {
    toast({
      title: "Compartilhado com sucesso!",
      description: `Post compartilhado no ${platform === 'copy' ? 'área de transferência' : platform}`,
    });
    refetchFeed();
    setShareModalPost(null);
  };

  const renderVideoFeed = () => {
    return (
      <VerticalVideoFeed
        posts={videoPosts}
        user={user}
        activeIndex={videoIndex}
        onActiveIndexChange={(index) => setVideoIndex(index)}
        onVote={handleVote}
        onLike={handleLike}
        onComment={(post) => setOpeningCommentsFor(post)}
        onShare={handleShare}
        onNearEnd={() => {
          if (hasNextVideoPage && !isFetchingNextVideoPage) {
            fetchNextVideoPage();
          }
        }}
        muted={videoMuted}
        onToggleMute={() => setVideoMuted((muted) => !muted)}
        isLoading={videoPostsLoading && videoPosts.length === 0}
        isLoadingMore={isFetchingNextVideoPage}
      />
    );
  };

  const goDown = useCallback(() => {
    if (!isModalOpen && verticalIndex < feedStructure.length - 1) {
      setVerticalIndex(prev => prev + 1);

      // Trigger pagination when reaching near the end (e.g., 5 items left)
      if (hasNextPage && !isFetchingNextPage && verticalIndex > feedStructure.length - 5) {
        fetchNextPage();
      }
    }
  }, [verticalIndex, feedStructure.length, isModalOpen, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const goUp = useCallback(() => {
    if (!isModalOpen && verticalIndex > 0) {
      setVerticalIndex(prev => prev - 1);
    }
  }, [verticalIndex, isModalOpen]);

  const goRight = useCallback(() => {
    if (!isModalOpen) {
      if (currentFeedItem?.type === 'clip_container') {
        if (horizontalClipIndex < currentFeedItem.items.length - 1) {
          setHorizontalClipIndex(prev => prev + 1);
        }
      } else {
        const clipContainerIndex = feedStructure.findIndex(item => item.type === 'clip_container');
        if (clipContainerIndex !== -1) {
          setVerticalIndex(clipContainerIndex);
          setHorizontalClipIndex(0);
        }
      }
    }
  }, [currentFeedItem, horizontalClipIndex, isModalOpen, verticalIndex, feedStructure]);

  const goLeft = useCallback(() => {
    if (!isModalOpen) {
      if (currentFeedItem?.type === 'clip_container') {
        if (horizontalClipIndex > 0) {
          setHorizontalClipIndex(prev => prev - 1);
        } else {
          const prevItemIndex = verticalIndex - 1;
          if (prevItemIndex >= 0) {
            setVerticalIndex(prevItemIndex);
          }
        }
      }
    }
  }, [currentFeedItem, horizontalClipIndex, isModalOpen, verticalIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isModalOpen) return;
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isModalOpen) return;
    setTouchEnd({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = () => {
    if (isModalOpen || !touchStart || !touchEnd) return;
    const xDiff = touchStart.x - touchEnd.x;
    const yDiff = touchStart.y - touchEnd.y;
    const minSwipe = 50;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
      if (Math.abs(xDiff) > minSwipe) {
        if (xDiff > 0) {
          goLeft();
        } else {
          goRight();
        }
      }
    } else {
      if (Math.abs(yDiff) > minSwipe) {
        if (yDiff > 0) goDown(); else goUp();
      }
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  useEffect(() => {
    if (!isMobile) return;

    const wheelAccum = { value: 0 };
    let lastTs = 0;

    const normalizeDelta = (e: WheelEvent) => {
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;
      if (e.deltaMode === 2) d *= window.innerHeight;
      return d;
    };

    const handleWheel = (e: WheelEvent) => {
      if (isModalOpen) return;
      if (feedModeRef.current === "videos") return;
      if ((e.target as HTMLElement).closest('[role="dialog"]')) return;

      e.preventDefault();

      const now = performance.now();
      if (now - lastTs > 220) wheelAccum.value = 0;
      lastTs = now;

      wheelAccum.value += normalizeDelta(e);

      const THRESHOLD = 80;
      if (wheelAccum.value > THRESHOLD) {
        wheelAccum.value = 0;
        goDown();
      } else if (wheelAccum.value < -THRESHOLD) {
        wheelAccum.value = 0;
        goUp();
      }
    };

    const enableWheel = window.matchMedia?.('(pointer: fine)')?.matches ?? true;

    if (enableWheel) {
      window.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (enableWheel) {
        window.removeEventListener('wheel', handleWheel);
      }
    };
  }, [goDown, goUp, isModalOpen, isMobile]);

  // Infinite Scroll Observer
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleVideoPlay = (postId: string) => {
    if (playingVideoId && playingVideoId !== postId) {
    }
    setPlayingVideoId(postId);
  };

  const handleFullscreenVideo = (post: any) => {
    const mediaUrl = getMediaUrl(post);
    if (mediaUrl) {
      setFullscreenVideo({ src: mediaUrl, post });
    }
  };

  const renderMobileContent = () => {
    if (postsLoading && !stuckLoading && (!rawPosts || rawPosts.length === 0)) {
      return (
        <div className="flex flex-col h-full bg-background justify-center items-center p-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Iniciando World Flow...</p>
        </div>
      );
    }

    return (
      <div className="w-full h-full overflow-y-auto bg-background text-foreground pb-24 px-4 space-y-6 pt-4">
        {/* STORIES DE 24H */}
        <StoriesBar />

        {/* World Flash Gallery at the beginning */}
        {clipPosts && clipPosts.length > 0 && (
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 rounded-xl p-4 border border-pink-200 dark:border-pink-900/50 shadow-sm">
            <h2 className="text-lg font-bold text-pink-700 dark:text-pink-400 mb-3 flex items-center gap-2">
              <Film className="h-5 w-5" /> World Flash
            </h2>
            <div className="flex overflow-x-auto gap-3 pb-3 snap-x world-flash-scrollbar">
              {clipPosts.map((clip: any, i: number) => {
                const mediaUrl = getMediaUrl(clip);
                if (!mediaUrl) return null;
                const thumbUrl = mediaUrl.includes('res.cloudinary.com') 
                  ? mediaUrl.replace('.mp4', '.jpg') 
                  : mediaUrl;
                return (
                  <div 
                    key={clip.id} 
                    onClick={() => setShortsViewerIndex(i)} 
                    className="snap-center shrink-0 w-32 h-48 bg-gray-900 rounded-xl overflow-hidden relative cursor-pointer border border-pink-500/25 hover:border-pink-500 transition-all shadow-md group"
                  >
                    <img 
                      src={thumbUrl} 
                      className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500" 
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/128x192?text=Video' }} 
                      alt="thumbnail"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                      <Play className="h-8 w-8 text-white drop-shadow-lg" />
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                       <Avatar className="h-5 w-5 border border-pink-500">
                         <AvatarImage src={clip.profiles?.avatar_url} />
                         <AvatarFallback className="text-[8px]">{clip.profiles?.username?.[0]}</AvatarFallback>
                       </Avatar>
                       <span className="text-[10px] font-bold text-white truncate drop-shadow-md">
                         @{clip.profiles?.username}
                       </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-center text-xs text-pink-600/80 dark:text-pink-400/80 mt-1 font-medium">Clique para expandir o World Flash</p>
          </div>
        )}

        {/* PERGUNTA DO DIA */}
        <DailyQuestionCard />

        {/* Standard Posts Feed */}
        <div className="space-y-6">
          {standardPosts?.map((post) => {
            const isOwnPost = post.user_id === user?.id;
            const isLiked = post.likes?.some((like: any) => like.user_id === user?.id);
            const likesCount = post.likes?.length || 0;
            const commentsCount = post.comments?.length || 0;
            const shareCount = post.share_count || 0;
            const heartVotes = post.post_votes?.filter((v: any) => v.vote_type === "heart").length || 0;
            const bombVotes = post.post_votes?.filter((v: any) => v.vote_type === "bomb").length || 0;
            const userVote = post.post_votes?.find((v: any) => v.user_id === user?.id);
            const isVotingActive = post.voting_period_active && post.voting_ends_at;
            const mediaUrl = getMediaUrl(post);
            const isVideo = mediaUrl && isVideoUrl(mediaUrl);

            return (
              <Card key={post.id} id={`post-${post.id}`} className={cn("border border-border/60 bg-card hover:bg-card/70 transition-colors relative overflow-hidden", post.is_community_approved && "border-primary/50", post.is_blocked && "border-red-500/50")}>
                <CardContent className={cn("pt-6 space-y-4 transition-all duration-500", post.is_blocked && "blur-[40px] opacity-30 pointer-events-none grayscale select-none")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={post.profiles?.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                          {post.profiles?.username?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <UserLink userId={post.user_id} username={post.profiles?.username || ""} className="text-sm font-bold block leading-snug">
                          @{post.profiles?.username}
                        </UserLink>
                        <p className="text-[10px] text-muted-foreground">{new Date(post.created_at).toLocaleDateString("pt-BR")}</p>
                        {isBoosted(post) && (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-violet-500/15 text-violet-500 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold">
                            <Rocket className="h-3 w-3" /> Em destaque
                          </span>
                        )}
                        {(post.profiles?.movement_status_enabled || post.profiles?.mood_status_enabled) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
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

                    {isOwnPost && (
                      <DropdownMenu>                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Opções da postagem">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEdit(post)} className="cursor-pointer text-sm">
                            <Pencil className="h-4 w-4 mr-2" /> Editar postagem
                          </DropdownMenuItem>
                          {!isBoosted(post) && (
                            <DropdownMenuItem onClick={() => boostPost(post)} className="cursor-pointer text-sm">
                              <Rocket className="h-4 w-4 mr-2 text-violet-500" /> Impulsionar
                              <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <CoinsIcon className="h-3 w-3" />15
                                <CrownIcon className="h-3 w-3 text-primary" />
                              </span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(post.id)}
                            className="cursor-pointer text-red-600 focus:text-red-600 text-sm"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir postagem
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <p className={cn("text-foreground leading-relaxed text-sm transition-all whitespace-pre-wrap", post.is_blocked && "blur-md select-none opacity-50")}>
                    <MentionText text={(post.content) ?? ""} />
                  </p>

                  {post.media_urls && post.media_urls.length > 0 && !post.is_blocked && (
                    <PostMediaCarousel
                      urls={post.media_urls}
                      postId={post.id}
                      onImageClick={(url) => setZoomedImage(url)}
                    />
                  )}

                  {isVotingActive && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{getTimeRemaining(post.voting_ends_at)}</span>
                        <div className="flex gap-3 text-xs">
                          <span className="flex items-center gap-1"><Heart className="h-4 w-4 fill-red-500 text-red-500" /> {heartVotes}</span>
                          <span className="flex items-center gap-1"><Bomb className="h-4 w-4 fill-orange-500 text-orange-500" /> {bombVotes}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("flex-1 text-xs py-2", userVote?.vote_type === "heart" && "bg-red-500/10 border-red-500 text-red-500")}
                          onClick={() => handleVote(post.id, "heart")}
                        >
                          <Heart className={cn("h-4 w-4 mr-1.5", userVote?.vote_type === "heart" && "fill-current")} />
                          Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("flex-1 text-xs py-2", userVote?.vote_type === "bomb" && "bg-orange-500/10 border-orange-500 text-orange-500")}
                          onClick={() => handleVote(post.id, "bomb")}
                        >
                          <Bomb className={cn("h-4 w-4 mr-1.5", userVote?.vote_type === "bomb" && "fill-current")} />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-3 border-t border-border/40">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => handleLike(post.id)}
                        className={cn("h-8 px-2 text-xs flex items-center rounded-md hover:bg-accent transition-colors", isLiked ? "text-red-500" : "text-foreground")}
                        title={isLiked ? "Descurtir" : "Curtir"}
                      >
                        <Heart className={cn("h-4 w-4 mr-1.5", isLiked && "fill-current")} />
                        Curtir
                      </button>
                      {likesCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowLikesFor(post)}
                          className="h-8 px-1.5 text-xs font-bold text-muted-foreground hover:text-primary rounded-md transition-colors"
                          title="Ver quem curtiu"
                        >
                          {likesCount}
                        </button>
                      )}
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => setOpeningCommentsFor(post)} className="h-8 px-2 text-xs">
                      <MessageCircle className="h-4 w-4 mr-1.5" />
                      {commentsCount}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShare(post)}
                      className="h-8 px-2 text-xs"
                    >
                      <Share2 className="h-4 w-4 mr-1.5" />
                      {shareCount}
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleBookmark(post.id)}
                      className={cn("h-8 px-2 text-xs flex items-center rounded-md transition-colors ml-auto",
                        isBookmarked(post.id) ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                      title={isBookmarked(post.id) ? "Remover dos salvos" : "Salvar post"}
                    >
                      <Bookmark className={cn("h-4 w-4", isBookmarked(post.id) && "fill-current")} />
                    </button>

                    {user?.id !== post.user_id && (
                      <ReportButton postId={post.id} reporterId={user?.id} variant="icon" className="h-8 w-8" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {standardPosts?.length === 0 && (
            <div className="text-center py-10 opacity-70">
              <p className="text-muted-foreground text-sm">Nenhum post ainda. Seja o primeiro a publicar!</p>
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          <div ref={loadMoreRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDesktopContent = () => {
    if (feedMode === "videos") {
      return (
        <div className="w-full h-full bg-black">
          {renderVideoFeed()}
        </div>
      );
    }

    return (
      <div className="w-full h-full overflow-y-auto bg-background text-foreground overscroll-contain">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-3 items-center mb-8">
            <div></div>
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="flex items-center justify-center gap-4">
                <h1 className="text-3xl font-black tracking-tighter">
                  World <span className="text-primary">Flow</span>
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-lg py-1 px-3">
                  Em Tempo Real
                </Badge>
              </div>
              <FeedModeToggle
                mode={feedMode}
                onChange={(mode) => {
                  setFeedMode(mode);
                  setVideoIndex(0);
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/explore")}
                className="gap-2 text-lg py-3 px-4"
                aria-label="Explorar"
              >
                <Search className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-primary text-primary-foreground gap-2 text-lg py-3 px-6"
              >
                <Plus className="h-5 w-5" />
                Criar Post
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-8">
            <div className="col-span-4 max-w-3xl mx-auto space-y-8 w-full">

              {/* STORIES DE 24H */}
              <StoriesBar />

              {/* PERGUNTA DO DIA */}
              <DailyQuestionCard />

              {clipPosts && clipPosts.length > 0 && (
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 rounded-xl p-6 border border-pink-200 dark:border-pink-900/50 shadow-sm">
                  <h2 className="text-xl font-bold text-pink-700 dark:text-pink-400 mb-4 flex items-center gap-2">
                    <Film className="h-6 w-6" /> World Flash
                  </h2>
                  <div className="flex overflow-x-auto gap-4 pb-4 px-2 world-flash-scrollbar snap-x">
                    {clipPosts.map((clip: any, i: number) => {
                      const mediaUrl = getMediaUrl(clip);
                      if (!mediaUrl) return null;
                      const thumbUrl = mediaUrl.includes('res.cloudinary.com') 
                        ? mediaUrl.replace('.mp4', '.jpg') 
                        : mediaUrl;
                      return (
                        <div 
                          key={clip.id} 
                          onClick={() => setShortsViewerIndex(i)} 
                          className="snap-center shrink-0 w-40 h-64 bg-gray-900 rounded-xl overflow-hidden relative cursor-pointer border-2 border-transparent hover:border-pink-500 transition-all shadow-md group border-pink-500/30"
                        >
                          <img 
                            src={thumbUrl} 
                            className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500" 
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/160x256?text=Video' }} 
                            alt="thumbnail"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                          <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                            <Play className="h-12 w-12 text-white drop-shadow-lg" />
                          </div>
                          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                             <Avatar className="h-6 w-6 border-2 border-pink-500">
                               <AvatarImage src={clip.profiles?.avatar_url} />
                               <AvatarFallback className="text-[10px]">{clip.profiles?.username?.[0]}</AvatarFallback>
                             </Avatar>
                             <span className="text-xs font-bold text-white truncate drop-shadow-md">
                               @{clip.profiles?.username}
                             </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-center text-sm text-pink-600/80 dark:text-pink-400/80 mt-2 font-medium">Clique para expandir o World Flash</p>
                </div>
              )}

              {standardPosts?.map((post) => {
                const isOwnPost = post.user_id === user?.id;
                const hasLiked = post.likes?.some((like: any) => like.user_id === user?.id);
                const likesCount = post.likes?.length || 0;
                const commentsCount = post.comments?.length || 0;
                const shareCount = post.share_count || 0;
                const heartVotes = post.post_votes?.filter((v: any) => v.vote_type === "heart").length || 0;
                const bombVotes = post.post_votes?.filter((v: any) => v.vote_type === "bomb").length || 0;
                const userVote = post.post_votes?.find((v: any) => v.user_id === user?.id);
                const isVotingActive = post.voting_period_active && post.voting_ends_at;
                const mediaUrl = getMediaUrl(post);
                const isVideo = mediaUrl && isVideoUrl(mediaUrl);

                return (
                  // CORREÇÃO: Adicionado ID para rolagem automática via URL
                  <Card key={post.id} id={`post-${post.id}`} className={cn("border border-border/60 bg-card hover:border-border/80 transition-colors relative overflow-hidden scroll-mt-24", post.is_community_approved && "border-primary/50", post.is_blocked && "border-red-500/50")}>
                    <CardContent className={cn("pt-8 space-y-6 transition-all duration-500", post.is_blocked && "blur-[40px] opacity-30 pointer-events-none grayscale select-none")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={post.profiles?.avatar_url} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                              {post.profiles?.username?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <UserLink userId={post.user_id} username={post.profiles?.username || ""} className="text-xl font-bold">
                              {post.profiles?.username}
                            </UserLink>
                            {post.profiles?.registration_number ? (
                              <GoldSeal registrationNumber={post.profiles.registration_number} className="ml-1.5" />
                            ) : null}
                            <p className="text-sm text-muted-foreground">{new Date(post.created_at).toLocaleDateString("pt-BR")}</p>
                            {(post.profiles?.movement_status_enabled || post.profiles?.mood_status_enabled) && (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
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

                        {isOwnPost && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Opções da postagem">
                                <MoreVertical className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEdit(post)} className="cursor-pointer text-lg">
                                <Pencil className="h-5 w-5 mr-2" /> Editar postagem
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => deleteMutation.mutate(post.id)}
                                className="cursor-pointer text-red-600 focus:text-red-600 text-lg"
                              >
                                <Trash2 className="h-5 w-5 mr-2" /> Excluir postagem
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>


                      <p className={cn("text-foreground leading-relaxed text-xl transition-all", post.is_blocked && "blur-md select-none opacity-50")}>
                        <MentionText text={(post.content) ?? ""} />
                      </p>

                      {post.media_urls && post.media_urls.length > 0 && !post.is_blocked && (
                        <PostMediaCarousel
                          urls={post.media_urls}
                          postId={post.id}
                          onImageClick={(url) => setZoomedImage(url)}
                        />
                      )}

                      {post.is_blocked && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center bg-background/20 backdrop-blur-[2px]">
                          <div className="bg-red-500/10 p-5 rounded-full mb-4 border border-red-500/30 backdrop-blur-md">
                            <ShieldAlert className="h-12 w-12 text-red-500" />
                          </div>
                          <h3 className="text-2xl font-black text-foreground mb-3 uppercase tracking-tighter">Conteúdo Bloqueado</h3>
                          <p className="text-muted-foreground text-sm max-w-sm leading-relaxed mb-6 font-bold">
                            Este post foi bloqueado pela Plataforma por violar nossas diretrizes.
                          </p>
                        </div>
                      )}

                      {isVotingActive && (
                        <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between text-lg">
                            <span className="text-muted-foreground">{getTimeRemaining(post.voting_ends_at)}</span>
                            <div className="flex gap-4 text-base">
                              <span className="flex items-center gap-2"><Heart className="h-5 w-5 fill-red-500 text-red-500" /> {heartVotes}</span>
                              <span className="flex items-center gap-2"><Bomb className="h-5 w-5 fill-orange-500 text-orange-500" /> {bombVotes}</span>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              size="lg"
                              className={cn("flex-1 text-lg py-3", userVote?.vote_type === "heart" && "bg-red-500/10 border-red-500 text-red-500")}
                              onClick={() => handleVote(post.id, "heart")}
                            >
                              <Heart className={cn("h-5 w-5 mr-3", userVote?.vote_type === "heart" && "fill-current")} />
                              Aprovar
                            </Button>
                            <Button
                              variant="outline"
                              size="lg"
                              className={cn("flex-1 text-lg py-3", userVote?.vote_type === "bomb" && "bg-orange-500/10 border-orange-500 text-orange-500")}
                              onClick={() => handleVote(post.id, "bomb")}
                            >
                              <Bomb className={cn("h-5 w-5 mr-3", userVote?.vote_type === "bomb" && "fill-current")} />
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-6 pt-4 border-t">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleLike(post.id)}
                            className={cn("text-lg flex items-center rounded-md px-2 py-1 hover:bg-accent transition-colors", hasLiked ? "text-red-500" : "text-foreground")}
                            title={hasLiked ? "Descurtir" : "Curtir"}
                          >
                            <Heart className={cn("h-6 w-6 mr-3", hasLiked && "fill-current")} />
                            Curtir
                          </button>
                          {likesCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowLikesFor(post)}
                              className="text-sm font-bold text-muted-foreground hover:text-primary rounded-md px-2 py-1 transition-colors"
                              title="Ver quem curtiu"
                            >
                              {likesCount}
                            </button>
                          )}
                        </div>

                        <Button variant="ghost" size="lg" onClick={() => setOpeningCommentsFor(post)} className="text-lg">
                          <MessageCircle className="h-6 w-6 mr-3" />
                          {commentsCount}
                        </Button>

                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => handleShare(post)}
                          className="text-lg"
                        >
                          <Share2 className="h-6 w-6 mr-3" />
                          {shareCount}
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleBookmark(post.id)}
                          className={cn("h-10 w-10 flex items-center justify-center rounded-full transition-colors ml-auto",
                            isBookmarked(post.id) ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent")}
                          title={isBookmarked(post.id) ? "Remover dos salvos" : "Salvar post"}
                        >
                          <Bookmark className={cn("h-5 w-5", isBookmarked(post.id) && "fill-current")} />
                        </button>

                        {/* Botão de Denúncia - só aparece se não é o próprio post */}
                        {user?.id !== post.user_id && (
                          <ReportButton postId={post.id} reporterId={user?.id} variant="icon" className="h-10 w-10 sm:h-auto sm:w-auto" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {standardPosts?.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-xl">Nenhum post ainda. Seja o primeiro a publicar!</p>
                </div>
              )}

              {/* Infinite Scroll Trigger for Desktop */}
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isFetchingNextPage && (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div >
    );
  };

  useEffect(() => {
    const isAnyModalOpen =
      showCreateModal ||
      !!openingCommentsFor ||
      !!editingPost ||
      !!zoomedImage ||
      !!fullscreenVideo ||
      !!shareModalPost ||
      shortsViewerIndex !== null;
      
    setIsModalOpen(isAnyModalOpen);

    // Esconde o menu global do AppLayout quando World Flash / Fullscreen estão abertos
    const appMenuBtn = document.getElementById('app-layout-floating-menu');
    if (appMenuBtn) {
      if (shortsViewerIndex !== null || fullscreenVideo !== null) {
        appMenuBtn.style.display = 'none';
      } else {
        appMenuBtn.style.display = '';
      }
    }
    
    return () => {
      if (appMenuBtn) appMenuBtn.style.display = '';
    };
  }, [showCreateModal, openingCommentsFor, editingPost, zoomedImage, fullscreenVideo, shareModalPost, shortsViewerIndex]);

    if (postsLoading && !stuckLoading && (!rawPosts || rawPosts.length === 0)) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,transparent_70%)] animate-pulse" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-8">
            <Globe className="h-20 w-20 text-blue-500 animate-spin-slow" />
            <div className="absolute inset-0 h-20 w-20 border-t-2 border-blue-400 rounded-full animate-spin" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase mb-2">
            World <span className="text-blue-500">Flow</span>
          </h1>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400/60" />
            <p className="text-blue-400/60 text-[10px] uppercase font-bold tracking-[0.3em]">
              Sincronizando 20 postagens...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="relative w-full h-full bg-background font-sans flex flex-col">

        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40 bg-background/60 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-2 min-w-0">
            {shortsViewerIndex !== null && (
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-accent rounded-full h-9 w-9 text-foreground"
                onClick={() => setShortsViewerIndex(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <h1 className="text-xl font-black tracking-tighter text-foreground">
              World <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">Flow</span>
            </h1>
          </div>

          <div className="flex-1 flex justify-center min-w-0">
            <FeedModeToggle
              mode={feedMode}
              onChange={(mode) => {
                setFeedMode(mode);
                setVideoIndex(0);
              }}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/explore")}
              className="rounded-full h-9 w-9 text-foreground hover:bg-accent"
              aria-label="Explorar"
            >
              <Search className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              size="icon"
              className="rounded-full h-9 w-9 bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg"
            >
              <Plus className="h-4 w-4 text-white" />
            </Button>
          </div>
        </header>

        <div className="flex-1 min-h-0 relative">
          {feedMode === "videos" ? renderVideoFeed() : renderMobileContent()}
        </div>

        {pendingNewCount > 0 && (
          <Button
            onClick={() => {
              const el = document.querySelector(".overflow-y-auto");
              if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="fixed bottom-20 right-4 z-50 rounded-full shadow-xl bg-blue-600 hover:bg-blue-500 text-white"
          >
            <ArrowUp className="h-4 w-4 mr-2" />
            {pendingNewCount} nova{pendingNewCount > 1 ? "s" : ""} postagem{pendingNewCount > 1 ? "ens" : ""}
          </Button>
        )}

        <CreatePostModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          user={user}
          onSuccess={() => refetchFeed()}
        />

        {shareModalPost && (
          <ShareModal
            open={!!shareModalPost}
            onOpenChange={(open) => !open && setShareModalPost(null)}
            post={shareModalPost}
            user={user}
            onShareComplete={handleShareComplete}
          />
        )}

        <Dialog open={!!openingCommentsFor} onOpenChange={(open) => !open && setOpeningCommentsFor(null)}>
          <DialogContent className="bg-background border border-border text-foreground w-[95vw] sm:max-w-md h-[80vh] max-h-[80vh] flex flex-col p-0 z-[9999] rounded-2xl" aria-describedby={undefined}>
            <div className="sticky top-0 z-10 bg-background border-b border-border/50 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <DialogTitle className="font-bold text-sm sm:text-base text-foreground">Comentários</DialogTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground hover:bg-gray-800" onClick={() => setOpeningCommentsFor(null)}>
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 p-3 sm:p-4 overflow-y-auto overscroll-contain scrollbar-themed">
              {loadingComments ? (
                <div className="flex justify-center py-6 sm:py-8"><Loader2 className="animate-spin text-blue-500 h-5 w-5 sm:h-6 sm:w-6" /></div>
              ) : comments?.length ? (
                comments.map((c: any) => (
                  <CommentItem key={c.id} comment={c} currentUserId={user?.id} onReply={(id, username) => setReplyingToComment({ id, username })} onDelete={(id) => deleteCommentMutation.mutate(id)} />
                ))
              ) : (
                <div className="text-center py-6 sm:py-10 text-gray-500">
                  <MessageCircle className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 text-gray-700" />
                  <p className="text-xs sm:text-sm text-gray-400">Nenhum comentário ainda.</p>
                </div>
              )}
            </div>

            <div className="p-2 sm:p-3 bg-background border-t border-border/50 flex flex-col gap-2">
              {replyingToComment && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-2.5 py-1.5 bg-muted/50 rounded-lg border border-border">
                  <span>Respondendo a <strong className="text-blue-400">@{replyingToComment.username}</strong></span>
                  <button onClick={() => setReplyingToComment(null)} className="text-gray-500 hover:text-white"><X className="h-3 w-3" /></button>
                </div>
              )}
              <div className="flex gap-2">
                <NewMentionTextarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Escreva um comentário… (use @ para mencionar)" rows={1}
                  className="bg-muted/50 border-border text-foreground placeholder:text-gray-500 rounded-3xl text-sm min-h-[40px] h-auto max-h-[120px] py-2 px-4 resize-none" />
                <Button size="icon" onClick={() => addComment.mutate()} disabled={addComment.isPending || !newCommentText.trim()} className="rounded-full bg-blue-600 hover:bg-blue-500 h-10 w-10 shrink-0 self-end">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {zoomedImage && (
          <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full h-10 w-10"
              onClick={() => setZoomedImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={zoomedImage}
                alt="Imagem ampliada"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        )}

        {fullscreenVideo && (
          <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full h-10 w-10"
              onClick={() => setFullscreenVideo(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <video
                src={fullscreenVideo.src}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
              />
              <div className="absolute bottom-8 left-0 right-0 text-center text-white p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={fullscreenVideo.post.profiles?.avatar_url} />
                    <AvatarFallback>{fullscreenVideo.post.profiles?.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <UserLink
                    userId={fullscreenVideo.post.user_id}
                    username={fullscreenVideo.post.profiles?.username || ""}
                    className="font-bold text-white"
                  >
                    @{fullscreenVideo.post.profiles?.username}
                  </UserLink>
                </div>
                <p className="text-sm text-white/80">{fullscreenVideo.post.content}</p>
              </div>
            </div>
          </div>
        )}

        {shortsViewerIndex !== null && clipPosts && clipPosts[shortsViewerIndex] && (
          <div className="fixed inset-0 z-[10000] bg-black touch-none flex flex-col items-center justify-center">
            {/* This layer uses ArrowLeft as well, just in case the main header is covered */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-6 left-6 z-[10001] text-white hover:bg-white/20 rounded-full h-12 w-12 bg-black/50 backdrop-blur-md"
              onClick={() => setShortsViewerIndex(null)}
            >
              <ArrowLeft className="h-8 w-8" />
            </Button>
            
            <div className="relative w-full h-full max-w-md mx-auto sm:h-[90vh] sm:max-h-[850px] sm:rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl flex items-center justify-center">
              <UdgVideoPlayer
                key={clipPosts[shortsViewerIndex].id}
                src={getMediaUrl(clipPosts[shortsViewerIndex])!}
                post={clipPosts[shortsViewerIndex]}
                user={user}
                onLike={() => handleLike(clipPosts[shortsViewerIndex].id)}
                onComment={() => {
                  setOpeningCommentsFor(clipPosts[shortsViewerIndex]);
                }}
                onShare={() => handleShare(clipPosts[shortsViewerIndex])}
                onVote={(postId, voteType) => handleVote(postId, voteType)}
                hasPrevClip={shortsViewerIndex > 0}
                hasNextClip={shortsViewerIndex < clipPosts.length - 1}
                onNextClip={() => setShortsViewerIndex(prev => Math.min(clipPosts.length - 1, (prev ?? 0) + 1))}
                onPreviousClip={() => setShortsViewerIndex(prev => prev! - 1)}
                onEnded={() => {
                   if (shortsViewerIndex < clipPosts.length - 1) {
                     setShortsViewerIndex(prev => Math.min(clipPosts.length - 1, (prev ?? 0) + 1));
                   }
                }}
              />
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <>
      {postsLoading && <LoadingOverlay message="Preparando seu World Flow..." />}
      {renderDesktopContent()}

      <CreatePostModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        user={user}
        onSuccess={() => refetchFeed()}
      />

      {shareModalPost && (
        <ShareModal
          open={!!shareModalPost}
          onOpenChange={(open) => !open && setShareModalPost(null)}
          post={shareModalPost}
          user={user}
          onShareComplete={handleShareComplete}
        />
      )}

      <Dialog open={!!openingCommentsFor} onOpenChange={(open) => !open && setOpeningCommentsFor(null)}>
        <DialogContent className="max-w-xl bg-background border border-border text-foreground rounded-2xl z-[9999]" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-foreground">Comentários</DialogTitle></DialogHeader>
          <div className="max-h-[50vh] overflow-auto space-y-4 pr-1 scrollbar-themed">
            {loadingComments ? (
              <p className="text-sm text-gray-400 p-4">Carregando comentários...</p>
            ) : (comments?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 p-4 text-center border border-gray-800 rounded-lg bg-gray-900/60">Seja o primeiro a comentar!</p>
            ) : (
              <div className="space-y-4">
                {comments!.map((c: any) => (
                  <CommentItem key={c.id} comment={c} currentUserId={user?.id} onReply={(id, username) => setReplyingToComment({ id, username })} onDelete={(id) => deleteCommentMutation.mutate(id)} />
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {replyingToComment && (
              <div className="flex items-center justify-between text-xs text-gray-300 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                <span>Respondendo a <strong className="text-blue-400">@{replyingToComment.username}</strong></span>
                <button onClick={() => setReplyingToComment(null)} className="hover:text-white"><X className="h-4 w-4" /></button>
              </div>
            )}
            <NewMentionTextarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder="Escreva um comentário… (use @ para mencionar)" rows={3}
              className="bg-muted/30 border-border text-foreground placeholder:text-gray-500 rounded-xl" />
            <div className="flex justify-end">
              <Button onClick={() => addComment.mutate()} disabled={addComment.isPending || !newCommentText.trim() || !openingCommentsFor} className="py-2.5 px-6 min-w-[120px] rounded-full">
                Comentar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPost} onOpenChange={(o) => !o && setEditingPost(null)}>
        <DialogContent className="max-w-2xl bg-background border border-border text-foreground rounded-2xl z-[9999]" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-xl text-white">Editar postagem</DialogTitle></DialogHeader>
          <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={10}
            placeholder="Edite o conteúdo da postagem" className="text-base bg-muted/30 border-border text-foreground placeholder:text-gray-500 rounded-xl" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPost(null)} className="text-base py-2.5 px-5 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">Cancelar</Button>
            <Button onClick={() => editMutation.mutate()} className="text-base py-2.5 px-5">Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: lista de quem curtiu */}
      <Dialog open={!!showLikesFor} onOpenChange={(o) => !o && setShowLikesFor(null)}>
        <DialogContent className="max-w-sm rounded-2xl bg-background border border-border text-foreground z-[9999]" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Heart className="h-5 w-5 text-red-500 fill-red-500" />
              Curtido por
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-1 pr-2">
              {(showLikesFor?.likes || []).length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Nenhuma curtida ainda.</p>
              ) : (
                (showLikesFor?.likes || []).map((like: any) => (
                  <button
                    key={like.id || like.user_id}
                    type="button"
                    onClick={() => { setShowLikesFor(null); navigate(`/profile/${like.user_id}`); }}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-800 transition-colors text-left"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={like.profiles?.avatar_url} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {(like.profiles?.username || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-white">@{like.profiles?.username || "usuário"}</p>
                      {like.profiles?.full_name && <p className="text-xs text-gray-500 truncate">{like.profiles.full_name}</p>}
                    </div>
                    <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500 flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {zoomedImage && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-8">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-8 right-8 z-50 text-white hover:bg-white/20 rounded-full h-12 w-12"
            onClick={() => setZoomedImage(null)}
          >
            <X className="h-8 w-8" />
          </Button>
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={zoomedImage}
              alt="Imagem ampliada"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {fullscreenVideo && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-8">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-8 right-8 z-50 text-white hover:bg-white/20 rounded-full h-12 w-12"
            onClick={() => setFullscreenVideo(null)}
          >
            <X className="h-8 w-8" />
          </Button>
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              src={fullscreenVideo.src}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            <div className="absolute bottom-8 left-0 right-0 text-center text-white p-6 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={fullscreenVideo.post.profiles?.avatar_url} />
                  <AvatarFallback>{fullscreenVideo.post.profiles?.username?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <UserLink
                    userId={fullscreenVideo.post.user_id}
                    username={fullscreenVideo.post.profiles?.username || ""}
                    className="font-bold text-xl text-white"
                  >
                    @{fullscreenVideo.post.profiles?.username}
                  </UserLink>
                  <Badge variant="outline" className="ml-2 bg-pink-500/20 text-pink-300 border-pink-500/30">
                    World Flash
                  </Badge>
                </div>
              </div>
              <p className="text-lg text-white/90 max-w-2xl mx-auto">{fullscreenVideo.post.content}</p>
            </div>
          </div>
        </div>
      )}

      {shortsViewerIndex !== null && clipPosts && clipPosts[shortsViewerIndex] && (
        <div className="fixed inset-0 z-[10000] bg-black touch-none flex flex-col items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 left-6 z-[10001] text-white hover:bg-white/20 rounded-full h-12 w-12 bg-black/50 backdrop-blur-md"
            onClick={() => setShortsViewerIndex(null)}
          >
            <ArrowLeft className="h-8 w-8" />
          </Button>
          
          <div className="relative w-full h-full max-w-md mx-auto sm:h-[90vh] sm:max-h-[850px] sm:rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl flex items-center justify-center">
            <UdgVideoPlayer
              key={clipPosts[shortsViewerIndex].id}
              src={getMediaUrl(clipPosts[shortsViewerIndex])!}
              post={clipPosts[shortsViewerIndex]}
              user={user}
              onLike={() => handleLike(clipPosts[shortsViewerIndex].id)}
              onComment={() => {
                setOpeningCommentsFor(clipPosts[shortsViewerIndex]);
                // We keep shortsViewerIndex open so they overlap properly
              }}
              onShare={() => handleShare(clipPosts[shortsViewerIndex])}
              onVote={(postId, voteType) => handleVote(postId, voteType)}
              hasPrevClip={shortsViewerIndex > 0}
              hasNextClip={shortsViewerIndex < clipPosts.length - 1}
              onNextClip={() => setShortsViewerIndex(prev => prev! + 1)}
              onPreviousClip={() => setShortsViewerIndex(prev => prev! - 1)}
               onEnded={() => {
                  if (shortsViewerIndex < clipPosts.length - 1) {
                    setShortsViewerIndex(prev => prev! + 1);
                  }
               }}
             />
          </div>
        </div>
      )}
    </>
  );
}