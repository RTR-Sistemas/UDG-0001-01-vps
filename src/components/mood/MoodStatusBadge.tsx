import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Smile, Frown, Angry, Meh, Laugh, Heart, Zap, Sparkles, AlertCircle, 
  HelpCircle, Eye, Shield, Compass, Brain, Flame, Activity, Sun, Coffee
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MoodType =
  | "ecstatic" | "very_happy" | "happy" | "content" | "grateful" | "joyful"
  | "devastated" | "very_sad" | "sad" | "melancholic" | "nostalgic" | "heartbroken"
  | "furious" | "angry" | "irritated" | "frustrated" | "indignant" | "disgusted"
  | "terrified" | "anxious" | "worried" | "nervous" | "panicked"
  | "shocked" | "amazed" | "surprised" | "curious"
  | "energetic" | "motivated" | "focused" | "creative" | "inspired"
  | "peaceful" | "relaxed" | "neutral" | "sleepy" | "serene"
  | "in_love" | "romantic" | "caring" | "passionate"
  | "sociable" | "lonely" | "shy" | "confident"
  | "unknown"
  | null;

interface MoodStatusBadgeProps {
  userId: string | undefined;
  viewerId?: string | null;
  snapshotMood?: MoodType;
  snapshotEmoji?: string | null;
  snapshotEnabled?: boolean | null;
  snapshotPublic?: boolean | null;
  className?: string;
}

export const MOOD_DETAILS: Record<
  NonNullable<MoodType>,
  { label: string; emoji: string; category: string; icon: any; style: string }
> = {
  ecstatic: { label: "Êxtase", emoji: "🤩", category: "felicidade", icon: Sparkles, style: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse" },
  very_happy: { label: "Muito Feliz", emoji: "😄", category: "felicidade", icon: Laugh, style: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  happy: { label: "Feliz", emoji: "😊", category: "felicidade", icon: Smile, style: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  content: { label: "Contente", emoji: "😌", category: "felicidade", icon: Smile, style: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20" },
  grateful: { label: "Grato", emoji: "🙏", category: "felicidade", icon: Sun, style: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  joyful: { label: "Radiante", emoji: "🥰", category: "felicidade", icon: Laugh, style: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  
  devastated: { label: "Devastado", emoji: "💔", category: "tristeza", icon: Frown, style: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.3)]" },
  very_sad: { label: "Muito Triste", emoji: "😭", category: "tristeza", icon: Frown, style: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30" },
  sad: { label: "Triste", emoji: "😢", category: "tristeza", icon: Frown, style: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30" },
  melancholic: { label: "Melancólico", emoji: "😞", category: "tristeza", icon: Frown, style: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20" },
  nostalgic: { label: "Nostálgico", emoji: "🥀", category: "tristeza", icon: Compass, style: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30" },
  heartbroken: { label: "Coração Partido", emoji: "🥺", category: "tristeza", icon: Frown, style: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30" },
  
  furious: { label: "Furioso", emoji: "🤬", category: "raiva", icon: Angry, style: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.3)]" },
  angry: { label: "Irritado", emoji: "😠", category: "raiva", icon: Angry, style: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
  irritated: { label: "Impaciente", emoji: "😤", category: "raiva", icon: Angry, style: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
  frustrated: { label: "Frustrado", emoji: "😖", category: "raiva", icon: AlertCircle, style: "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/20" },
  indignant: { label: "Indignado", emoji: "😡", category: "raiva", icon: Angry, style: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
  disgusted: { label: "Nojo", emoji: "🤢", category: "nojo", icon: AlertCircle, style: "bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/30" },
  
  terrified: { label: "Aterrorizado", emoji: "😱", category: "medo", icon: AlertCircle, style: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30" },
  anxious: { label: "Ansioso", emoji: "😨", category: "medo", icon: AlertCircle, style: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30" },
  worried: { label: "Preocupado", emoji: "😟", category: "medo", icon: AlertCircle, style: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20" },
  nervous: { label: "Nervoso", emoji: "😰", category: "medo", icon: AlertCircle, style: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30" },
  panicked: { label: "Pânico", emoji: "🫨", category: "medo", icon: AlertCircle, style: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30" },
  
  shocked: { label: "Chocado", emoji: "🤯", category: "surpresa", icon: Zap, style: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30 shadow-[0_0_12px_rgba(217,70,239,0.3)] animate-bounce" },
  amazed: { label: "Maravilhado", emoji: "😲", category: "surpresa", icon: Sparkles, style: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30" },
  surprised: { label: "Surpreso", emoji: "😮", category: "surpresa", icon: Zap, style: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/30" },
  curious: { label: "Curioso", emoji: "🧐", category: "surpresa", icon: Compass, style: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 border-fuchsia-500/20" },
  
  energetic: { label: "Energético", emoji: "⚡", category: "energia", icon: Zap, style: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]" },
  motivated: { label: "Motivado", emoji: "💪", category: "energia", icon: Activity, style: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30" },
  focused: { label: "Focado", emoji: "🎯", category: "energia", icon: Brain, style: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30" },
  creative: { label: "Criativo", emoji: "🎨", category: "energia", icon: Brain, style: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border-cyan-500/20" },
  inspired: { label: "Inspirado", emoji: "💡", category: "energia", icon: Sparkles, style: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30" },
  
  peaceful: { label: "Em Paz", emoji: "☮️", category: "calma", icon: Shield, style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  relaxed: { label: "Relaxado", emoji: "😌", category: "calma", icon: Coffee, style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  neutral: { label: "Neutro", emoji: "😐", category: "calma", icon: Meh, style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20" },
  sleepy: { label: "Sonolento", emoji: "😴", category: "calma", icon: Coffee, style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  serene: { label: "Sereno", emoji: "🧘", category: "calma", icon: Shield, style: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  
  in_love: { label: "Apaixonado", emoji: "😍", category: "amor", icon: Heart, style: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse" },
  romantic: { label: "Romântico", emoji: "🥰", category: "amor", icon: Heart, style: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  caring: { label: "Carinhoso", emoji: "💕", category: "amor", icon: Heart, style: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  passionate: { label: "Apixonado", emoji: "❤️‍🔥", category: "amor", icon: Flame, style: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 animate-pulse" },
  
  sociable: { label: "Sociável", emoji: "🤗", category: "social", icon: Smile, style: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30" },
  lonely: { label: "Solitário", emoji: "😔", category: "social", icon: Frown, style: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20" },
  shy: { label: "Tímido", emoji: "🫣", category: "social", icon: Eye, style: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30" },
  confident: { label: "Autoconfiante", emoji: "💅", category: "social", icon: Sparkles, style: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.25)]" },

  unknown: { label: "Humor", emoji: "❓", category: "calma", icon: HelpCircle, style: "bg-muted/40 text-muted-foreground border-border/40" }
};

export const MoodStatusBadge: React.FC<MoodStatusBadgeProps> = ({
  userId,
  viewerId,
  snapshotMood,
  snapshotEmoji,
  snapshotEnabled,
  snapshotPublic,
  className,
}) => {
  const queryClient = useQueryClient();

  const hasSnapshot =
    snapshotEnabled !== null && snapshotEnabled !== undefined
      ? true
      : snapshotMood !== undefined || snapshotEmoji !== undefined || snapshotPublic !== undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["mood-status", userId],
    enabled: !!userId && !hasSnapshot,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("mood_status_enabled, current_mood, current_mood_emoji, mood_public")
        .eq("id", userId)
        .single();

      if (error) throw error;

      return data as {
        mood_status_enabled: boolean;
        current_mood: MoodType;
        current_mood_emoji: string | null;
        mood_public: boolean;
      };
    },
  });

  useEffect(() => {
    if (!userId || hasSnapshot) return;

    const channel = supabase
      .channel(`mood-status-listen-${userId}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "profiles",
          event: "UPDATE",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any;
          queryClient.setQueryData(["mood-status", userId], (old: any) => ({
            ...(old ?? {}),
            mood_status_enabled: !!row.mood_status_enabled,
            current_mood: (row.current_mood ?? null) as MoodType,
            current_mood_emoji: (row.current_mood_emoji ?? null) as string | null,
            mood_public: row.mood_public ?? true,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, hasSnapshot]);

  if (!userId) return null;

  const enabled = hasSnapshot ? !!snapshotEnabled : !!data?.mood_status_enabled;
  const mood: MoodType = hasSnapshot ? (snapshotMood ?? null) : (data?.current_mood ?? null);
  const emoji = hasSnapshot ? snapshotEmoji ?? null : data?.current_mood_emoji ?? null;
  const isPublic = hasSnapshot ? (snapshotPublic ?? true) : (data?.mood_public ?? true);

  if (isLoading && !hasSnapshot) return null;
  if (!enabled || !mood) return null;

  // Privacy: show if public or if viewer is self
  const isSelf = !!viewerId && viewerId === userId;
  if (!isPublic && !isSelf) return null;

  const moodDetails = MOOD_DETAILS[mood] || MOOD_DETAILS.unknown;
  const IconComp = moodDetails.icon;
  const label = moodDetails.label;
  const shownEmoji = emoji || moodDetails.emoji;
  const colorStyle = moodDetails.style;

  const isBouncy = moodDetails.category === "felicidade" || mood === "shocked" || mood === "in_love";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase",
        "backdrop-blur-md border transition-all duration-300 hover:scale-105 cursor-default hover:brightness-110",
        colorStyle,
        className
      )}
    >
      <span aria-hidden className={cn(isBouncy && "animate-bounce")}>
        {shownEmoji}
      </span>
      <IconComp className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
};
