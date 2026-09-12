import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmojiPack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_emoji: string | null;
  is_animated: boolean;
  is_premium: boolean;
  unlocked: boolean;
  items: EmojiPackItem[];
}

export interface EmojiPackItem {
  emoji: string;
  name: string | null;
  animation_url: string | null;
}

export function useEmojiPacks() {
  return useQuery({
    queryKey: ["emoji-packs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_user_emoji_packs");
      if (error) throw error;
      return ((data as any)?.packs as EmojiPack[]) || [];
    },
  });
}

export function useUnlockEmojiPack() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (pack_id: string) => {
      const { data, error } = await (supabase as any).rpc("unlock_emoji_pack", { p_pack_id: pack_id });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Erro ao desbloquear");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emoji-packs"] });
      toast({ title: "Pack desbloqueado! 🎉" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });
}

// Packs estáticos para fallback (quando RPC não disponível)
export const DEFAULT_EMOJI_PACKS: EmojiPack[] = [
  {
    id: "classic",
    name: "Clássicos",
    slug: "classic",
    description: "Emojis padrão do sistema",
    icon_emoji: "😊",
    is_animated: false,
    is_premium: false,
    unlocked: true,
    items: [
      { emoji: "😊", name: "Sorrindo", animation_url: undefined }, { emoji: "😂", name: "Rindo muito", animation_url: undefined },
      { emoji: "🥰", name: "Apaixonado", animation_url: undefined }, { emoji: "😍", name: "Olhos de coração", animation_url: undefined },
      { emoji: "🤔", name: "Pensando", animation_url: undefined }, { emoji: "😭", name: "Chorando", animation_url: undefined },
      { emoji: "😡", name: "Bravo", animation_url: undefined }, { emoji: "👍", name: "Curtir", animation_url: undefined },
      { emoji: "👎", name: "Não curti", animation_url: undefined }, { emoji: "🎉", name: "Festa", animation_url: undefined },
      { emoji: "🔥", name: "Fogo", animation_url: undefined }, { emoji: "💯", name: "Cem por cento", animation_url: undefined },
      { emoji: "🤝", name: "Aperto de mão", animation_url: undefined }, { emoji: "🙏", name: "Obrigado", animation_url: undefined },
      { emoji: "✨", name: "Brilho", animation_url: undefined },
    ],
  },
  {
    id: "reactions",
    name: "Reações",
    slug: "reactions",
    description: "Para reagir rápido nas mensagens",
    icon_emoji: "👍",
    is_animated: false,
    is_premium: false,
    unlocked: true,
    items: [
      { emoji: "👍", name: "Like", animation_url: undefined }, { emoji: "❤️", name: "Love", animation_url: undefined },
      { emoji: "😂", name: "Haha", animation_url: undefined }, { emoji: "😮", name: "Uau", animation_url: undefined },
      { emoji: "😢", name: "Triste", animation_url: undefined }, { emoji: "😡", name: "Raiva", animation_url: undefined },
      { emoji: "🤯", name: "Mind blown", animation_url: undefined }, { emoji: "🙌", name: "Aleluia", animation_url: undefined },
    ],
  },
  {
    id: "animated",
    name: "Animados",
    slug: "animated",
    description: "Emojis animados divertidos",
    icon_emoji: "✨",
    is_animated: true,
    is_premium: false,
    unlocked: true,
    items: [
      { emoji: "😂", name: "Rindo animado", animation_url: "https://cdn.udg.app/animations/laugh.json" },
      { emoji: "😍", name: "Coração batendo", animation_url: "https://cdn.udg.app/animations/heart.json" },
      { emoji: "🎉", name: "Confete", animation_url: "https://cdn.udg.app/animations/confetti.json" },
      { emoji: "🔥", name: "Fogo animado", animation_url: "https://cdn.udg.app/animations/fire.json" },
      { emoji: "✨", name: "Brilho mágico", animation_url: "https://cdn.udg.app/animations/sparkle.json" },
      { emoji: "💯", name: "100 pulsando", animation_url: "https://cdn.udg.app/animations/100.json" },
      { emoji: "😭", name: "Choro dramático", animation_url: "https://cdn.udg.app/animations/cry.json" },
      { emoji: "🤩", name: "Estrelas nos olhos", animation_url: "https://cdn.udg.app/animations/stars.json" },
    ],
  },
];

// Categorias para o picker
export const EMOJI_CATEGORIES = [
  { id: "reactions", label: "Reações", icon: "👍" },
  { id: "classic", label: "Clássicos", icon: "😊" },
  { id: "animated", label: "Animados", icon: "✨" },
  { id: "animals", label: "Animais", icon: "🐱" },
  { id: "food", label: "Comida", icon: "🍕" },
  { id: "sports", label: "Esportes", icon: "⚽" },
  { id: "travel", label: "Viagens", icon: "✈️" },
];