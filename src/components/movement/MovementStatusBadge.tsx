/**
 * Badge de Status de Movimento.
 *
 * - Por padrão, consulta/escuta o status atual do usuário em `profiles`.
 * - Quando usado em posts (Feed/Arena), pode receber um *snapshot* do momento da postagem
 *   para não “mudar” retroativamente.
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Footprints, Car } from "lucide-react";
import { cn } from "@/lib/utils";

type MovementStatusType = "stopped" | "moving" | "traveling" | null;

interface MovementStatusBadgeProps {
  userId: string | undefined;
  /** Snapshot (ex.: do post) */
  snapshotEnabled?: boolean | null;
  snapshotStatus?: MovementStatusType;
  className?: string;
}

function labelFor(status: MovementStatusType) {
  if (status === "moving") return { label: "Em movimento", Icon: Footprints };
  if (status === "traveling") return { label: "Viajando", Icon: Car };
  return { label: "Parado", Icon: User };
}

function styleFor(status: MovementStatusType) {
  if (status === "moving") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]";
  if (status === "traveling") return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.25)]";
  return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20 shadow-[0_0_12px_rgba(100,116,139,0.15)]";
}

export const MovementStatusBadge: React.FC<MovementStatusBadgeProps> = ({
  userId,
  snapshotEnabled,
  snapshotStatus,
  className,
}) => {
  const queryClient = useQueryClient();

  const hasSnapshot =
    snapshotEnabled !== undefined && snapshotEnabled !== null
      ? true
      : snapshotStatus !== undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["movement-status", userId],
    enabled: !!userId && !hasSnapshot,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("movement_status, movement_status_enabled")
        .eq("id", userId)
        .single();

      if (error) throw error;

      return data as {
        movement_status: MovementStatusType;
        movement_status_enabled: boolean;
      };
    },
  });

  useEffect(() => {
    if (!userId || hasSnapshot) return;

    const channel = supabase
      .channel(`movement-status-listen-${userId}`)
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
          queryClient.setQueryData(["movement-status", userId], (old: any) => ({
            ...(old ?? {}),
            movement_status: (row.movement_status ?? null) as MovementStatusType,
            movement_status_enabled: !!row.movement_status_enabled,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, hasSnapshot]);

  if (!userId) return null;

  const enabled = hasSnapshot ? !!snapshotEnabled : !!data?.movement_status_enabled;
  const status = hasSnapshot ? (snapshotStatus ?? null) : (data?.movement_status ?? null);

  if (isLoading && !hasSnapshot) return null;
  if (!enabled || !status) return null;

  const { label, Icon } = labelFor(status);
  const colorStyle = styleFor(status);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase",
        "backdrop-blur-md border transition-all duration-300 hover:scale-105 cursor-default hover:brightness-110",
        colorStyle,
        className
      )}
    >
      <Icon className={cn("h-3 w-3", status !== "stopped" && "animate-pulse duration-2000")} />
      <span>{label}</span>
    </div>
  );
};
