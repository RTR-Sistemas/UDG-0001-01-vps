import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Bookmarks ──────────────────────────────────────────────────────────────
export function useBookmarkedPostIds() {
  return useQuery({
    queryKey: ["bookmarked-ids"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("post_bookmarks").select("post_id");
      if (error) throw error;
      return new Set((data || []).map((d) => d.post_id));
    },
  });
}

export function useBookmarkedPosts() {
  return useQuery({
    queryKey: ["bookmarked-posts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_bookmarked_posts");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await (supabase as any).rpc("toggle_bookmark", { p_post_id: postId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["bookmarked-ids"] });
      qc.invalidateQueries({ queryKey: ["bookmarked-posts"] });
    },
  });
}

// ─── Post Reactions (multiple types) ────────────────────────────────────────
export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: "like", emoji: "👍", label: "Curtir", color: "text-blue-500" },
  { type: "love", emoji: "❤️", label: "Amei", color: "text-red-500" },
  { type: "haha", emoji: "😂", label: "Haha", color: "text-yellow-500" },
  { type: "wow", emoji: "😮", label: "Uau", color: "text-purple-500" },
  { type: "sad", emoji: "😢", label: "Triste", color: "text-blue-400" },
  { type: "angry", emoji: "😡", label: "Raiva", color: "text-orange-600" },
];

export function usePostReactions(postId: string) {
  return useQuery({
    queryKey: ["post-reactions", postId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_reactions")
        .select("reaction_type, user_id, profiles:user_id(username, avatar_url)")
        .eq("post_id", postId);
      if (error) throw error;
      return (data || []) as Array<{
        reaction_type: ReactionType;
        user_id: string;
        profiles: { username: string; avatar_url: string | null };
      }>;
    },
  });
}

export function useTogglePostReaction(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (type: ReactionType) => {
      const { data, error } = await (supabase as any).rpc("toggle_post_reaction", {
        p_post_id: postId,
        p_type: type,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["post-reactions", postId] });
    },
  });
}

// ─── Post Views ─────────────────────────────────────────────────────────────
export function useIncrementView() {
  return useMutation({
    mutationFn: async (postId: string) => {
      await (supabase as any).rpc("increment_post_view", { p_post_id: postId });
    },
  });
}

// ─── Pin Post ───────────────────────────────────────────────────────────────
export function useTogglePin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await (supabase as any).rpc("toggle_pin_post", { p_post_id: postId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["posts-infinite"] });
      qc.invalidateQueries({ queryKey: ["profile-posts"] });
      toast({ title: data?.pinned ? "Post fixado no perfil 📌" : "Post desafixado" });
    },
  });
}
