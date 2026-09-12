import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOOD_DETAILS, MoodType } from "./MoodStatusBadge";
import { TrendingUp, Calendar, AlertCircle } from "lucide-react";

// Valence mapping for sparkline (0 = extremely negative, 100 = extremely positive/energetic)
const MOOD_VALENCE: Record<string, number> = {
  ecstatic: 100, very_happy: 90, happy: 80, joyful: 85, in_love: 90, passionate: 95, romantic: 85,
  content: 75, grateful: 75, confident: 80, motivated: 85, energetic: 90, creative: 80, inspired: 85,
  focused: 75, caring: 80, sociable: 75, serene: 75, relaxed: 70, peaceful: 70, neutral: 50,
  curious: 60, surprised: 65, amazed: 75,
  sleepy: 45, shy: 45, lonely: 30, sad: 25, melancholic: 30, nostalgic: 40, disappointed: 20,
  very_sad: 15, devastated: 5, heartbroken: 5,
  irritated: 30, frustrated: 25, angry: 20, indignant: 20, furious: 5,
  worried: 30, nervous: 25, anxious: 20, terrified: 5, panicked: 5,
  disgusted: 20, unknown: 50
};

export function MoodHistory({ userId }: { userId: string | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mood-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mood_history")
        .select("id, mood, emoji, created_at, intensity, secondary_mood, analysis_source")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return data as Array<{
        id: string;
        mood: string;
        emoji: string | null;
        created_at: string;
        intensity: number | null;
        secondary_mood: string | null;
        analysis_source: string | null;
      }>;
    },
  });

  if (!userId) return null;
  if (isLoading) return null;

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card/40 border border-border/40 backdrop-blur-md">
        <CardContent className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
          <p>Nenhum histórico de humor registrado ainda.</p>
          <p className="text-xs">Registre seu humor hoje a partir das configurações ou perfil!</p>
        </CardContent>
      </Card>
    );
  }

  // Generate sparkline coordinates for the last 7 items (chronological order)
  const sparklineData = [...data]
    .slice(0, 7)
    .reverse()
    .map((d) => MOOD_VALENCE[d.mood] ?? 50);

  const renderSparkline = () => {
    if (sparklineData.length < 2) return null;
    const width = 280;
    const height = 40;
    const padding = 5;
    const pointsCount = sparklineData.length;
    const stepX = (width - padding * 2) / (pointsCount - 1);
    
    const points = sparklineData.map((val, index) => {
      const x = padding + index * stepX;
      // Invert Y because SVG coordinates start from top left
      const y = height - padding - (val / 100) * (height - padding * 2);
      return { x, y };
    });

    // Generate SVG path string (curved line)
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + stepX / 2;
      const cpY1 = p0.y;
      const cpX2 = p1.x - stepX / 2;
      const cpY2 = p1.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    return (
      <div className="flex flex-col gap-1 bg-muted/20 border border-border/30 rounded-xl p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            Tendência Emocional (Últimos 7 registros)
          </span>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Sparkline</span>
        </div>
        <div className="relative w-full h-[40px] flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 280 40">
            {/* Sparkline curve */}
            <path
              d={pathD}
              fill="none"
              stroke="url(#sparkline-gradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Dots */}
            {points.map((p, idx) => (
              <circle
                key={idx}
                cx={p.x}
                cy={p.y}
                r="3"
                className="fill-primary stroke-background stroke-2 hover:r-4 transition-all cursor-pointer"
              />
            ))}
            <defs>
              <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card/45 border border-border/40 backdrop-blur-md shadow-lg rounded-2xl">
      <CardHeader className="p-4 pb-2 border-b border-border/20 bg-muted/10">
        <CardTitle className="text-xs font-bold tracking-wider uppercase text-foreground/80 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Histórico e Análise de Humor
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Trend chart */}
        {renderSparkline()}

        {/* Timeline list */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {data.map((row) => {
            const moodKey = row.mood as MoodType;
            const moodDetails = MOOD_DETAILS[moodKey || "unknown"] || MOOD_DETAILS.unknown;
            const isHappy = moodDetails.category === "felicidade";
            
            return (
              <div 
                key={row.id} 
                className="flex items-start justify-between gap-3 text-xs p-2.5 rounded-xl border border-border/20 bg-card/60 hover:bg-accent/10 transition-colors shadow-sm"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="text-lg leading-none mt-0.5 select-none">
                    {row.emoji || moodDetails.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                      <span>{moodDetails.label}</span>
                      {row.intensity !== null && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Intensidade: {Math.round(row.intensity * 100)}%
                        </span>
                      )}
                    </div>
                    {row.secondary_mood && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Secundário: <span className="font-medium">{MOOD_DETAILS[row.secondary_mood as MoodType]?.label || row.secondary_mood}</span>
                      </p>
                    )}
                    <span className="text-[9px] text-muted-foreground/80 mt-1 inline-block uppercase font-medium">
                      Origem: {row.analysis_source === "camera" ? "Câmera (Scan)" : "Manual"}
                    </span>
                  </div>
                </div>
                
                <span className="text-[10px] text-muted-foreground/85 tabular-nums flex-shrink-0 text-right whitespace-nowrap mt-0.5">
                  {new Date(row.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
