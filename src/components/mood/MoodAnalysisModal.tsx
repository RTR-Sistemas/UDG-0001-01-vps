import { useState, useEffect, useRef } from "react";
import { 
  Camera, X, RefreshCw, AlertCircle, Loader2, Sparkles, Check, 
  Smile, Heart, Brain, Flame, Coffee, Compass, Zap, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MOOD_DETAILS, MoodType } from "./MoodStatusBadge";
import { cn } from "@/lib/utils";

interface MoodAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: (mood: MoodType, emoji: string) => void;
}

export default function MoodAnalysisModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: MoodAnalysisModalProps) {
  const [step, setStep] = useState<"init" | "scanning" | "result" | "manual">("init");
  const [loadingModels, setLoadingModels] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scanStepText, setScanStepText] = useState("Iniciando câmera...");
  const [scanProgress, setScanProgress] = useState(0);

  const [detectedExpressions, setDetectedExpressions] = useState<Record<string, number> | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodType>(null);
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [adviceText, setAdviceText] = useState("");
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  const { toast } = useToast();

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      setStep("init");
      setErrorMsg(null);
      setScanProgress(0);
      setDetectedExpressions(null);
      setSelectedMood(null);
    }
    return () => {
      stopCamera();
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [isOpen]);

  const loadFaceApiAndModels = async () => {
    setLoadingModels(true);
    setErrorMsg(null);
    try {
      // Load FaceAPI script from CDN
      if (!(window as any).faceapi) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Falha ao carregar FaceAPI.js de CDN"));
          document.head.appendChild(s);
        });
      }

      const faceapi = (window as any).faceapi;

      // Load models
      const tryLoad = async (base: string) => {
        await faceapi.nets.tinyFaceDetector.loadFromUri(base);
        await faceapi.nets.faceExpressionNet.loadFromUri(base);
      };

      try {
        await tryLoad("/models");
      } catch (e) {
        console.warn("TinyFaceDetector failed locally, using CDN fallback...");
        await tryLoad("https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Falha ao inicializar modelos de IA faciais.");
    } finally {
      setLoadingModels(false);
    }
  };

  const startScanning = async () => {
    setStep("scanning");
    setScanProgress(5);
    setScanStepText("Ligando a câmera...");
    setErrorMsg(null);

    await loadFaceApiAndModels();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScanProgress(30);
      setScanStepText("Aguardando estabilização...");

      // Scanning simulation step animations
      let currentProgress = 30;
      scanIntervalRef.current = setInterval(async () => {
        currentProgress += 10;
        if (currentProgress < 90) {
          setScanProgress(currentProgress);
          if (currentProgress === 50) setScanStepText("Detectando pontos da face...");
          if (currentProgress === 70) setScanStepText("Analisando microexpressões...");
        } else {
          clearInterval(scanIntervalRef.current);
          runFaceDetection();
        }
      }, 800);

    } catch (err: any) {
      console.error(err);
      stopCamera();
      setErrorMsg(
        err.name === "NotAllowedError"
          ? "Permissão da câmera negada."
          : "Nenhuma câmera frontal ativa encontrada."
      );
      setStep("init");
    }
  };

  const runFaceDetection = async () => {
    try {
      const faceapi = (window as any).faceapi;
      if (!faceapi) throw new Error("FaceAPI não carregado.");
      const video = videoRef.current;
      if (!video) throw new Error("Câmera desativada.");

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (!detection || !detection.expressions) {
        throw new Error("Rosto não detectado. Centralize-se e aumente a iluminação ambiente.");
      }

      const expressions = detection.expressions as Record<string, number>;
      setDetectedExpressions(expressions);
      setScanProgress(100);
      setScanStepText("Humor decodificado!");

      determineCombinationsAndSet(expressions);
      stopCamera();
      setStep("result");
    } catch (err: any) {
      stopCamera();
      setErrorMsg(err.message || "Erro durante o escaneamento facial.");
      setStep("init");
    }
  };

  // Dynamic emotional combinatorics algorithm to match 44 custom states
  const determineCombinationsAndSet = (exp: Record<string, number>) => {
    const happy = exp.happy || 0;
    const sad = exp.sad || 0;
    const angry = exp.angry || 0;
    const surprised = exp.surprised || 0;
    const fearful = exp.fearful || 0;
    const disgusted = exp.disgusted || 0;
    const neutral = exp.neutral || 0;

    let mood: MoodType = "neutral";
    let emoji = "😐";

    // 1. Check dominance first
    if (happy > 0.85) { mood = "ecstatic"; emoji = "🤩"; }
    else if (happy > 0.5) { mood = "very_happy"; emoji = "😄"; }
    else if (happy > 0.2) { mood = "happy"; emoji = "😊"; }
    else if (sad > 0.6) { mood = "devastated"; emoji = "💔"; }
    else if (sad > 0.4) { mood = "very_sad"; emoji = "😭"; }
    else if (sad > 0.2) { mood = "sad"; emoji = "😢"; }
    else if (angry > 0.7) { mood = "furious"; emoji = "🤬"; }
    else if (angry > 0.4) { mood = "angry"; emoji = "😠"; }
    else if (angry > 0.2) { mood = "irritated"; emoji = "😤"; }
    else if (surprised > 0.8) { mood = "shocked"; emoji = "🤯"; }
    else if (surprised > 0.5) { mood = "amazed"; emoji = "😲"; }
    else if (surprised > 0.2) { mood = "surprised"; emoji = "😮"; }
    else if (fearful > 0.6) { mood = "terrified"; emoji = "😱"; }
    else if (fearful > 0.3) { mood = "anxious"; emoji = "😨"; }
    else if (disgusted > 0.3) { mood = "disgusted"; emoji = "🤢"; }
    
    // 2. Complex combinatorics override
    if (fearful > 0.15 && sad > 0.15) { mood = "anxious"; emoji = "😨"; }
    else if (angry > 0.15 && sad > 0.15) { mood = "frustrated"; emoji = "😖"; }
    else if (happy > 0.2 && surprised > 0.15) { mood = "joyful"; emoji = "🥰"; }
    else if (sad > 0.1 && neutral > 0.4) { mood = "melancholic"; emoji = "😞"; }
    else if (happy > 0.1 && sad > 0.1) { mood = "nostalgic"; emoji = "🥀"; }
    else if (neutral > 0.7) { mood = "peaceful"; emoji = "☮️"; }

    setSelectedMood(mood);
    setSelectedEmoji(emoji);
    generateCustomAdvice(mood);
  };

  const generateCustomAdvice = (mood: MoodType) => {
    const hours = new Date().getHours();
    let timeGreeting = "nesta noite";
    if (hours >= 6 && hours < 12) timeGreeting = "nesta manhã";
    else if (hours >= 12 && hours < 18) timeGreeting = "nesta tarde";

    const baseAdvice = MOOD_DETAILS[mood || "unknown"]?.label || "equilibrado";
    
    // Customized response strings depending on general groups
    let advice = `Percebemos um estado de ${baseAdvice} ${timeGreeting}.`;

    if (mood === "ecstatic" || mood === "very_happy" || mood === "happy" || mood === "joyful") {
      advice += " Aproveite esta maravilhosa vibração emocional! É um ótimo momento para compartilhar alegria com amigos ou iniciar atividades criativas.";
    } else if (mood === "sad" || mood === "very_sad" || mood === "devastated" || mood === "melancholic" || mood === "heartbroken") {
      advice += " Lembramos que todas as tempestades passam. Seja gentil consigo mesmo agora. Que tal ouvir uma música relaxante ou tomar um chá quente?";
    } else if (mood === "angry" || mood === "furious" || mood === "irritated" || mood === "frustrated") {
      advice += " Sentir frustração é humano. Tente respirar fundo por 4 segundos, segurar por 4 e expirar lentamente. Isso acalma o sistema nervoso.";
    } else if (mood === "anxious" || mood === "worried" || mood === "terrified" || mood === "panicked" || mood === "nervous") {
      advice += " A ansiedade tenta antecipar o futuro. Traga sua mente para o presente focando em 3 coisas que você pode ver e tocar ao seu redor.";
    } else if (mood === "peaceful" || mood === "relaxed" || mood === "serene" || mood === "neutral") {
      advice += " Seu semblante está calmo e estável. Aproveite esta clareza mental para se concentrar e desfrutar do silêncio.";
    } else {
      advice += " Mantenha o equilíbrio interno e ouça suas emoções com autocompaixão.";
    }

    setAdviceText(advice);
  };

  const handleSaveMood = async () => {
    if (!selectedMood) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("record_mood", {
        p_mood: selectedMood,
        p_emoji: selectedEmoji || MOOD_DETAILS[selectedMood]?.emoji || "😐",
        p_details: { source: "modal", expressions: detectedExpressions },
      });

      if (error) throw error;

      toast({
        title: "Humor atualizado!",
        description: `Status alterado para: ${MOOD_DETAILS[selectedMood]?.label || selectedMood}`,
      });

      onSuccess(selectedMood, selectedEmoji || MOOD_DETAILS[selectedMood]?.emoji || "😐");
      onClose();
    } catch (err: any) {
      toast({
        title: "Erro ao gravar",
        description: err.message || "Erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Group manual moods into categories
  const categories: Record<string, { title: string; color: string; list: MoodType[] }> = {
    felicidade: { title: "Felicidade", color: "from-amber-400 to-yellow-500", list: ["ecstatic", "very_happy", "happy", "content", "grateful", "joyful"] },
    tristeza: { title: "Tristeza", color: "from-blue-500 to-indigo-600", list: ["devastated", "very_sad", "sad", "melancholic", "nostalgic", "heartbroken"] },
    raiva: { title: "Raiva", color: "from-red-500 to-orange-600", list: ["furious", "angry", "irritated", "frustrated", "indignant"] },
    medo: { title: "Medo / Ansiedade", color: "from-zinc-500 to-slate-700", list: ["terrified", "anxious", "worried", "nervous", "panicked"] },
    surpresa: { title: "Surpresa", color: "from-fuchsia-500 to-purple-600", list: ["shocked", "amazed", "surprised", "curious"] },
    energia: { title: "Energia / Foco", color: "from-cyan-500 to-teal-500", list: ["energetic", "motivated", "focused", "creative", "inspired"] },
    calma: { title: "Calma", color: "from-emerald-500 to-green-600", list: ["peaceful", "relaxed", "neutral", "sleepy", "serene"] },
    amor: { title: "Amor", color: "from-rose-400 to-pink-500", list: ["in_love", "romantic", "caring", "passionate"] },
    social: { title: "Social", color: "from-purple-500 to-indigo-500", list: ["sociable", "lonely", "shy", "confident"] },
  };

  const handleManualSelect = (mood: MoodType) => {
    if (!mood) return;
    setSelectedMood(mood);
    const details = MOOD_DETAILS[mood];
    setSelectedEmoji(details?.emoji || "😐");
    generateCustomAdvice(mood);
    setStep("result");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-card border border-border/40 shadow-2xl rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-border/20 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="font-bold text-foreground">Como você está hoje?</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scan / Steps view */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-start gap-2.5 text-xs">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Falha no escaneamento</span>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {step === "init" && (
            <div className="text-center py-6 space-y-6">
              <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/20">
                <Camera className="h-10 w-10 text-primary animate-pulse" />
              </div>
              <div className="space-y-2 max-w-xs mx-auto">
                <h4 className="font-bold text-sm text-foreground">Análise Facial Inteligente</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Escaneie seu rosto com a câmera para decodificar suas microexpressões e registrar seu humor real instantaneamente.
                </p>
              </div>
              <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
                <Button onClick={startScanning} className="bg-primary hover:bg-primary/95 text-xs w-full py-5 rounded-xl gap-2 shadow-lg">
                  <Camera className="h-4 w-4" />
                  Escanear Rosto com Câmera
                </Button>
                <Button onClick={() => setStep("manual")} variant="outline" className="text-xs w-full py-5 rounded-xl">
                  Selecionar Humor Manualmente
                </Button>
              </div>
            </div>
          )}

          {step === "scanning" && (
            <div className="flex flex-col items-center justify-center space-y-5 py-4">
              {/* Circular Scan HUD */}
              <div className="relative w-48 h-48 rounded-full border-4 border-primary/25 overflow-hidden flex items-center justify-center bg-black/60 shadow-[0_0_24px_rgba(139,92,246,0.15)]">
                
                {/* Horizontal scanner beam line */}
                <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-[scan_2s_infinite_ease-in-out] z-10 shadow-[0_0_8px_#8b5cf6]" />
                
                {/* Live video */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>

              {/* Guide/Progress status */}
              <div className="text-center space-y-2 w-full max-w-xs">
                <span className="text-xs font-bold text-primary uppercase tracking-wide flex items-center justify-center gap-1.5 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {scanStepText}
                </span>
                
                {/* Visual Progress Bar */}
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border/20">
                  <div 
                    className="bg-gradient-to-r from-primary to-secondary h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>

              <Button onClick={() => { stopCamera(); setStep("init"); }} variant="ghost" className="text-xs">
                Cancelar
              </Button>
            </div>
          )}

          {step === "manual" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2 border-border/10">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Selecione como se sente:</span>
                <Button variant="ghost" onClick={() => setStep("init")} className="h-7 text-[11px] px-2 text-primary hover:bg-primary/5">
                  Voltar
                </Button>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {Object.entries(categories).map(([catKey, cat]) => (
                  <div key={catKey} className="space-y-1.5">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{cat.title}</h5>
                    <div className="grid grid-cols-3 gap-1.5">
                      {cat.list.map((m) => {
                        const details = MOOD_DETAILS[m || "unknown"];
                        if (!details) return null;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleManualSelect(m)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl border border-border/20 bg-card/50 hover:bg-accent/10 hover:border-primary/30 transition-all text-center gap-1 cursor-pointer"
                          >
                            <span className="text-xl select-none">{details.emoji}</span>
                            <span className="text-[9px] font-medium text-foreground truncate w-full">{details.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "result" && selectedMood && (
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-md">
                  <span className="text-4xl select-none">{selectedEmoji || MOOD_DETAILS[selectedMood]?.emoji}</span>
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-base text-foreground">
                    Você parece estar: <span className="text-primary">{MOOD_DETAILS[selectedMood]?.label}</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">Decodificado por Inteligência Artificial</p>
                </div>
              </div>

              {/* Dynamic advice */}
              <div className="p-3.5 bg-muted/40 border border-border/30 rounded-2xl space-y-1.5 text-xs text-muted-foreground leading-relaxed animate-in fade-in duration-200">
                <span className="font-semibold text-foreground block">Conselho para o seu Momento:</span>
                <p>{adviceText}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button 
                  onClick={startScanning} 
                  variant="outline" 
                  className="flex-1 text-xs py-5 rounded-xl gap-1.5"
                  disabled={saving}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reanalisar
                </Button>
                <Button 
                  onClick={handleSaveMood} 
                  className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-95 text-xs py-5 rounded-xl gap-1.5 text-white shadow-md"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Salvar Humor
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Styles injection for scanning line scan animation */}
        <style>{`
          @keyframes scan {
            0%, 100% { top: 0%; }
            50% { top: 100%; }
          }
        `}</style>
      </div>
    </div>
  );
}
