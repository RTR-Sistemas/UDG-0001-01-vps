import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface AppIntroVideoProps {
  onComplete: () => void;
}

export function AppIntroVideo({ onComplete }: AppIntroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const playedRef = useRef(false);
  const doneRef = useRef(false);
  // Versão vertical (9:16, tela completa) para mobile; widescreen para desktop
  const [videoSrc] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px), (orientation: portrait)").matches
      ? "/abertura_mobile.mp4"
      : "/abertura_final.mp4"
  );

  const handleVideoEnd = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setIsFadingOut(true);
    setTimeout(onComplete, 500); // Aguarda o fade out terminar
  };

  // Fallback de segurança: se o vídeo não começar a tocar em 8s (stall/loading
  // no mobile, autoplay bloqueado ou codec não suportado), pula o intro para
  // nunca prender a tela em um fundo preto.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!playedRef.current) handleVideoEnd();
    }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isFadingOut) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-500 opacity-0 pointer-events-none" />
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden transition-opacity duration-500 opacity-100">
      <button
        type="button"
        aria-label="Pular introdução"
        onClick={handleVideoEnd}
        className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      <video
        ref={videoRef}
        src="/abertura_final.mp4"
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        muted={false}
        onEnded={handleVideoEnd}
        onError={handleVideoEnd} // Se der erro de carregamento, pula direto
        onPlaying={() => {
          playedRef.current = true;
        }}
      />
    </div>
  );
}
