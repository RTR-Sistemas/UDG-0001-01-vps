import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function normalizePost(p: any) {
  return {
    ...p,
    media_urls: Array.isArray(p?.media_urls)
      ? p.media_urls
          .filter((url: any) => url && typeof url === "string")
          .map((url: string) => url.trim())
      : [],
    share_count: p?.post_shares?.[0]?.count || 0,
  };
}

async function fetchInitialFeed(userId: string) {
  if (userId.startsWith("demo-") || import.meta.env.VITE_SUPABASE_URL?.includes("dummy")) return [];
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
        *, 
        profiles:user_id (id, username, avatar_url, full_name), 
        likes (id, user_id), 
        comments (id),
        post_votes (id, user_id, vote_type),
        post_shares(count)
      `
    )
    .eq("is_community_approved", true)
    .order("created_at", { ascending: false })
    .range(0, 19);

  if (error) throw error;
  return (data || []).map(normalizePost);
}

export function PostLoginBootstrap({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function run() {
      try {
        await queryClient.prefetchQuery({
          queryKey: ["posts", userId],
          queryFn: () => fetchInitialFeed(userId),
        });
      } catch (e) {
        console.error("Erro no bootstrap pos-login:", e);
      } finally {
        if (!canceled) setReady(true);
      }
    }

    if (userId) run();

    return () => {
      canceled = true;
    };
  }, [queryClient, userId]);

  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="text-sm text-muted-foreground text-center">Carregando seu feed...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
