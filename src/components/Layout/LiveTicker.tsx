import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

interface TickerEvent {
    kind: "battle" | "arena";
    title: string;
    subtitle?: string;
    path: string;
}

/**
 * Notificação discreta no topo: avisa quando há uma Batalha ao vivo
 * e quando há novas postagens na Arena. Fica visível por alguns
 * segundos e pode ser dispensada.
 */
export function LiveTicker() {
    const navigate = useNavigate();
    const [event, setEvent] = useState<TickerEvent | null>(null);

    useEffect(() => {
        let hideTimer: any = null;

        const show = (e: TickerEvent) => {
            setEvent(e);
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setEvent(null), 20000);
        };

        // Estado inicial: alguma batalha já ao vivo?
        supabase
            .from("battles")
            .select("id, host_id, guest_id, host:host_id(username), guest:guest_id(username)")
            .eq("status", "live")
            .limit(1)
            .then(({ data }) => {
                if (data?.[0]) {
                    show({
                        kind: "battle",
                        title: `Batalha ao vivo: ${data[0].host?.username} vs ${data[0].guest?.username}`,
                        path: `/battle/${data[0].id}`,
                    });
                }
            });

        // Realtime: novas batalhas ao vivo
        const channel = supabase
            .channel("ticker_events")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "battles", filter: "status=eq.live" },
                (payload) => {
                    const d = payload.new as any;
                    show({ kind: "battle", title: "Batalha ao vivo começou!", subtitle: "Clique para assistir", path: `/battle/${d.id}` });
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "battles", filter: "status=eq.live" },
                (payload) => {
                    const d = payload.new as any;
                    if (d.status === "live") {
                        show({ kind: "battle", title: "Batalha ao vivo!", subtitle: "Clique para assistir", path: `/battle/${d.id}` });
                    }
                }
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "posts", filter: "voting_period_active=eq.true" },
                (payload) => {
                    const p = payload.new as any;
                    const isArena = p.is_community_approved === false && p.post_type !== "photo_audio";
                    show({
                        kind: "arena",
                        title: isArena ? "Nova postagem na Arena!" : "Nova publicação no feed!",
                        subtitle: "Clique para ver",
                        path: isArena ? "/arena" : "/feed",
                    });
                }
            )
            .subscribe();

        return () => {
            if (hideTimer) clearTimeout(hideTimer);
            supabase.removeChannel(channel);
        };
    }, []);

    if (!event) return null;

    return (
        <button
            onClick={() => { setEvent(null); navigate(event.path); }}
            className={cnTicker(event.kind)}
            title={event.title}
        >
            <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className={cnPing(event.kind)} />
                <span className={cnDot(event.kind)} />
            </span>
            <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[11px] font-bold leading-tight">{event.title}</span>
                {event.subtitle && <span className="block truncate text-[9px] opacity-80">{event.subtitle}</span>}
            </span>
            <span
                role="button"
                tabIndex={0}
                className="flex-shrink-0 rounded-full p-1 opacity-70 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setEvent(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setEvent(null); } }}
            >
                <X className="w-3 h-3" />
            </span>
        </button>
    );
}

function cnTicker(kind: "battle" | "arena") {
    const base = "sticky top-0 z-[60] mx-auto mt-1.5 flex w-[96%] max-w-3xl items-center gap-2.5 rounded-full border px-3.5 py-2 backdrop-blur-xl shadow-lg transition-all animate-in slide-in-from-top-2 duration-300 text-left";
    return kind === "battle"
        ? `${base} border-red-500/40 bg-red-950/80 text-red-100 hover:bg-red-900/80`
        : `${base} border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15`;
}

function cnPing(kind: "battle" | "arena") {
    return `absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${kind === "battle" ? "bg-red-500" : "bg-primary"}`;
}

function cnDot(kind: "battle" | "arena") {
    return `relative inline-flex h-2 w-2 rounded-full ${kind === "battle" ? "bg-red-500" : "bg-primary"}`;
}
