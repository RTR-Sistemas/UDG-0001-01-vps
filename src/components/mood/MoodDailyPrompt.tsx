import { useState, useEffect } from "react";
import { Sparkles, X, ChevronRight, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MoodDailyPromptProps {
  userId: string;
  onOpenAnalysis: () => void;
}

export function MoodDailyPrompt({ userId, onOpenAnalysis }: MoodDailyPromptProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const todayStr = new Date().toLocaleDateString("pt-BR");
    const lastPromptDate = localStorage.getItem(`mood_prompt_date_${userId}`);

    if (lastPromptDate !== todayStr) {
      // Trigger prompt after a short delay (e.g., 5 seconds)
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [userId]);

  const handleOpen = () => {
    onOpenAnalysis();
    setIsVisible(false);
    const todayStr = new Date().toLocaleDateString("pt-BR");
    localStorage.setItem(`mood_prompt_date_${userId}`, todayStr);
  };

  const handleClose = () => {
    setIsVisible(false);
    const todayStr = new Date().toLocaleDateString("pt-BR");
    localStorage.setItem(`mood_prompt_date_${userId}`, todayStr);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99] max-w-sm w-full bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl p-4 flex gap-3 animate-in slide-in-from-bottom-5 slide-in-from-right-5 duration-300">
      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary flex-shrink-0">
        <Sparkles className="h-5 w-5 animate-pulse" />
      </div>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Análise Diária</h4>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted"
            title="Ignorar por hoje"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs font-semibold text-foreground">Como você está se sentindo hoje? </p>
        <p className="text-[11px] text-muted-foreground leading-normal">
          Escaneie seu semblante ou registre seu estado para ver seus gráficos de tendência emocional.
        </p>
        <div className="pt-2 flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpen}
            className="text-[11px] bg-primary hover:bg-primary/95 text-white h-7 px-3 rounded-lg gap-1 shadow-sm"
          >
            Escanear Rosto
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="text-[11px] text-muted-foreground hover:text-foreground h-7 px-2.5"
          >
            Depois
          </Button>
        </div>
      </div>
    </div>
  );
}
