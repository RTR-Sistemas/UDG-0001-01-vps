import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PostMediaCarouselProps {
  urls: string[];
  postId: string;
  className?: string;
  onImageClick?: (url: string) => void;
  isVideoPlaying?: (id: string) => boolean;
  onVideoPlay?: (id: string) => void;
  playingVideoId?: string | null;
}

export function PostMediaCarousel({
  urls,
  postId,
  className,
  onImageClick,
}: PostMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cleanUrls = urls
    .map((u) => u.replace(/^(image::|video::|audio::)/, ""))
    .filter(Boolean);
  const isVideoArr = urls.map((u) => u.startsWith("video::") || /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u));

  if (cleanUrls.length === 0) return null;

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, cleanUrls.length - 1));
    setActiveIndex(clamped);
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: clamped * scrollRef.current.offsetWidth, behavior: "smooth" });
    }
  };

  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, cleanUrls.length]);
  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, cleanUrls.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 50) {
      if (delta < 0 && activeIndex < cleanUrls.length - 1) next();
      else if (delta > 0 && activeIndex > 0) prev();
    }
    setTouchStartX(null);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  // Single media — full width, no carousel
  if (cleanUrls.length === 1) {
    const url = cleanUrls[0];
    const isVideo = isVideoArr[0];
    if (isVideo) {
      return (
        <div className={cn("rounded-xl overflow-hidden mt-3 bg-black", className)}>
          <video src={url} controls playsInline className="w-full max-h-[500px] object-contain" />
        </div>
      );
    }
    return (
      <div className={cn("rounded-xl overflow-hidden mt-3", className)}>
        <img
          src={url}
          alt=""
          className="w-full max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => onImageClick?.(url)}
          loading="lazy"
        />
      </div>
    );
  }

  // Multiple media — swipeable carousel
  return (
    <div className={cn("relative rounded-xl overflow-hidden mt-3 group/carousel select-none", className)}>
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onScroll={handleScroll}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {cleanUrls.map((url, idx) => (
          <div key={idx} className="w-full flex-shrink-0 snap-center relative aspect-[4/5] sm:aspect-[4/3] bg-black">
            {isVideoArr[idx] ? (
              <video src={url} controls playsInline className="w-full h-full object-contain" />
            ) : (
              <img
                src={url}
                alt={`${idx + 1} de ${cleanUrls.length}`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => onImageClick?.(url)}
                loading={idx === 0 ? "eager" : "lazy"}
                draggable={false}
              />
            )}
          </div>
        ))}
      </div>

      {/* Counter badge (top-right) */}
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-full pointer-events-none z-10">
        {activeIndex + 1}/{cleanUrls.length}
      </div>

      {/* Arrow navigation (desktop) */}
      {activeIndex > 0 && (
        <button
          type="button"
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {activeIndex < cleanUrls.length - 1 && (
        <button
          type="button"
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10"
          aria-label="Próximo"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Dot indicators (bottom center) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {cleanUrls.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => goTo(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              idx === activeIndex
                ? "w-5 bg-white"
                : "w-1.5 bg-white/50 hover:bg-white/70"
            )}
            aria-label={`Ir para foto ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
