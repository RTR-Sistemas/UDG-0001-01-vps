import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BlockedUser {
  id: string;
  blocked_user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  reason: string | null;
  hide_my_posts?: boolean;
  created_at: string;
}

export function useBlockedUsers() {
  return useQuery({
    queryKey: ["blocked-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_blocked_users");
      if (error) throw error;
      return ((data as any)?.blocks as BlockedUser[]) || [];
    },
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { blocked_id: string; reason?: string; hide_my_posts?: boolean }) => {
      // Tenta RPC nova com hide_my_posts, fallback para inserção direta se RPC ainda não atualizada
      const rpcParams: any = { p_blocked_id: params.blocked_id, p_reason: params.reason || null, p_hide_my_posts: !!params.hide_my_posts };
      let { data, error } = await (supabase as any).rpc("block_user", rpcParams);
      if (error && String(error.message).includes("hide_my_posts")) {
        const fallback: any = { p_blocked_id: params.blocked_id, p_reason: params.reason || null };
        const r2 = await (supabase as any).rpc("block_user", fallback);
        data = r2.data; error = r2.error;
        if (!error && data?.success) {
          const uid = (await supabase.auth.getUser()).data.user?.id;
          if (uid) await (supabase as any).from("user_blocks").update({ hide_my_posts: !!params.hide_my_posts }).eq("blocker_id", uid).eq("blocked_id", params.blocked_id);
        }
      }
      if (error) {
        // Fallback direto na tabela se RPC falhar
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (!uid) throw error;
        const { error: insErr } = await (supabase as any).from("user_blocks").upsert({ blocker_id: uid, blocked_id: params.blocked_id, reason: params.reason || null, hide_my_posts: !!params.hide_my_posts }, { onConflict: "blocker_id,blocked_id" });
        if (insErr) throw insErr;
        return { success: true };
      }
      if (!data?.success) throw new Error(data?.error || "Erro ao bloquear");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Usuário bloqueado", description: "O usuário não poderá mais te contatar." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao bloquear", description: err.message, variant: "destructive" });
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (blocked_id: string) => {
      const { data, error } = await (supabase as any).rpc("unblock_user", { p_blocked_id: blocked_id });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Erro ao desbloquear");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-users"] });
      toast({ title: "Usuário desbloqueado" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desbloquear", description: err.message, variant: "destructive" });
    },
  });
}

export function useIsBlocked(userId: string | null) {
  return useQuery({
    queryKey: ["is-blocked", userId],
    queryFn: async () => {
      if (!userId) return { blockedByMe: false, blockedMe: false };
      const { data, error } = await (supabase as any)
        .from("user_blocks")
        .select("blocker_id, blocked_id")
        .or(`and(blocker_id.eq.${(await supabase.auth.getUser()).data.user?.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${(await supabase.auth.getUser()).data.user?.id})`);
      if (error) throw error;
      const me = (await supabase.auth.getUser()).data.user?.id;
      return {
        blockedByMe: (data as any)?.some((b: any) => b.blocker_id === me && b.blocked_id === userId) || false,
        blockedMe: (data as any)?.some((b: any) => b.blocker_id === userId && b.blocked_id === me) || false,
      };
    },
    enabled: !!userId,
  });
}