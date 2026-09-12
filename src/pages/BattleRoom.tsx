/**
 * =============================================================================
 * File: src/pages/BattleRoom.tsx
 * Purpose: Sala de Batalha AO VIVO estilo TikTok PK — vídeo em tempo real
 *          (Agora), plateia assistindo, corações, presentes flutuando,
 *          chat ao vivo, placar dinâmico e resultado com confete.
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  acceptBattle,
  approveBattleExtension,
  cancelBattle,
  declineBattle,
  endBattle,
  extendBattle,
  fetchBattle,
  fetchBattleChat,
  fetchBattleLeaderboard,
  fetchGiftCatalog,
  fetchRecentGifts,
  joinBattleAsViewer,
  leaveBattleAsViewer,
  sendBattleChatMessage,
  sendBattleHearts,
  subscribeBattle,
  subscribeBattleChat,
  subscribeBattleHearts,
  subscribeBattleViewers,
  surrenderBattle,
  touchBattleViewer,
  battleErrorMessage,
  battleSurrenderErrorMessage,
  type Battle,
  type BattleExtension,
  type BattleParticipant,
  type BattleSide,
  type GiftCatalogItem,
  type GiftTransaction,
} from "@/services/battleService";
import { useBattle } from "@/contexts/BattleContext";
import { useWallet } from "@/contexts/WalletContext";
import { useBattleLive, userIdToSmallUid } from "@/hooks/useBattleLive";
import { GiftTray } from "@/components/battle/GiftTray";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Swords, X, Clock, Trophy, Timer, Check, Crown, Users, Eye, Mic, MicOff,
  Video, VideoOff, ChevronLeft, Send, Gift, Flag, Heart, Zap,
} from "lucide-react";
import { animateGift, formatCoins, playBattleSound, showBigGift, spawnHearts, launchConfetti } from "@/lib/battleUtils";
import { cn } from "@/lib/utils";

interface ProfileLite {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name: string | null;
}

interface GiftFeedItem {
  key: string;
  username: string;
  emoji: string;
  giftName: string;
  side: BattleSide;
}

interface RoomChatMessage {
  id: string;
  battle_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: { id: string; username: string | null; avatar_url: string | null } | null;
}

const BIG_GIFT_MIN_COST = 100;

export default function BattleRoom() {
  const { id } = useParams<{ id: string }>();
  const battleId = id ?? "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { openBattle } = useBattle();
  const { balances } = useWallet();

  const [battle, setBattle] = useState<Battle | null>(null);
  const [hostProf, setHostProf] = useState<ProfileLite | null>(null);
  const [guestProf, setGuestProf] = useState<ProfileLite | null>(null);
  const [extensions, setExtensions] = useState<BattleExtension[]>([]);
  const [leaderboard, setLeaderboard] = useState<BattleParticipant[]>([]);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [chat, setChat] = useState<RoomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [giftFeed, setGiftFeed] = useState<GiftFeedItem[]>([]);
  const [hearts, setHearts] = useState<{ host: number; guest: number }>({ host: 0, guest: 0 });
  const [sideSel, setSideSel] = useState<BattleSide>("host");
  const [trayOpen, setTrayOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [liveCountdown, setLiveCountdown] = useState<number | null>(null);
  const [winnerPrize, setWinnerPrize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [surrenderArmed, setSurrenderArmed] = useState(false);

  const endedNotifiedRef = useRef(false);
  const autoEndedRef = useRef(false);
  const confettiRef = useRef(false);
  const wasLiveRef = useRef(false);
  const heartTimerRef = useRef<number | null>(null);
  const heartPendingRef = useRef<{ side: BattleSide; count: number }>({ side: "host", count: 0 });
  const profileNameCacheRef = useRef<Map<string, string>>(new Map());
  const feedKeyRef = useRef(0);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const isParticipant = useMemo(
    () => battle && user && (battle.host_id === user.id || battle.guest_id === user.id),
    [battle, user]
  );
  const otherParticipantId = useMemo(
    () =>
      battle && user
        ? battle.host_id === user.id
          ? battle.guest_id
          : battle.host_id
        : null,
    [battle, user]
  );
  const isHost = useMemo(() => battle && user && battle.host_id === user.id, [battle, user]);
  const isGuest = useMemo(() => battle && user && battle.guest_id === user.id, [battle, user]);
  const isViewer = !isParticipant;

  const hostUid = useMemo(() => (battle ? userIdToSmallUid(battle.host_id) : 0), [battle]);
  const guestUid = useMemo(() => (battle ? userIdToSmallUid(battle.guest_id) : 0), [battle]);

  const loadProfiles = useCallback(async (b: Battle) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const ids = [b.host_id, b.guest_id];
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, full_name")
      .in("id", ids);
    const rows = (data ?? []) as ProfileLite[];
    rows.forEach((p) => profileNameCacheRef.current.set(p.id, p.username ?? p.full_name ?? "anônimo"));
    setHostProf(rows.find((p) => p.id === b.host_id) ?? null);
    setGuestProf(rows.find((p) => p.id === b.guest_id) ?? null);
  }, []);

  const guessName = useCallback(async (uid: string): Promise<string> => {
    const cached = profileNameCacheRef.current.get(uid);
    if (cached) return cached;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("profiles")
        .select("username, full_name")
        .eq("id", uid)
        .maybeSingle();
      const name = (data as { username?: string | null; full_name?: string | null } | null)?.username
        ?? (data as { username?: string | null; full_name?: string | null } | null)?.full_name
        ?? "alguém";
      profileNameCacheRef.current.set(uid, name);
      return name;
    } catch {
      return "alguém";
    }
  }, []);

  const loadRanking = useCallback(async (bid: string) => {
    try {
      setLeaderboard(await fetchBattleLeaderboard(bid));
    } catch { /* mantém ranking */ }
  }, []);

  // Carga inicial
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [b, cat] = await Promise.all([fetchBattle(battleId), fetchGiftCatalog()]);
        if (!active) return;
        setBattle(b);
        setCatalog(cat);
        if (b) {
          loadProfiles(b);
          loadRanking(battleId);
          void fetchBattleChat(battleId).then((rows) => active && setChat(rows)).catch(() => undefined);
          void fetchRecentGifts(battleId, 15).then((rows) => {
            if (!active) return;
            const feed: GiftFeedItem[] = rows.map((g) => ({
              key: `init-${g.id}`,
              username: g.sender_id.startsWith("init") ? "" : "",
              emoji: cat.find((c) => c.id === g.gift_id)?.emoji ?? "🎁",
              giftName: cat.find((c) => c.id === g.gift_id)?.name ?? "presente",
              side: g.receiver_id === b.host_id ? "host" : "guest",
            }));
            setGiftFeed(feed);
          }).catch(() => undefined);
        }
      } catch {
        if (active) toast({ title: "Erro ao carregar batalha", variant: "destructive" });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [battleId, toast, loadProfiles, loadRanking]);

  // Realtime: batalha + presentes + chat + espectadores + corações
  useEffect(() => {
    if (!battleId || !battle) return;
    const giftById = new Map(catalog.map((c) => [c.id, c]));
    const unsubscribe = subscribeBattle(battleId, {
      onBattle: (b) => {
        setBattle((prev) => {
          const merged = prev ? { ...prev, ...b } : b;
          if (merged.status === "live" && !wasLiveRef.current) {
            wasLiveRef.current = true;
            setLiveCountdown(3);
            playBattleSound("countdown");
          }
          if (merged.status === "ended" && !endedNotifiedRef.current) {
            endedNotifiedRef.current = true;
            playBattleSound(merged.winner_id === user?.id ? "victory" : "defeat");
            toast({
              title: merged.winner_id
                ? merged.winner_id === user?.id
                  ? "🏆 Você venceu a batalha!"
                  : "Batalha encerrada"
                : "🤝 Batalha empatada!",
            });
          }
          return merged;
        });
      },
      onGift: (gift) => {
        const item = giftById.get(gift.gift_id);
        const emoji = item?.emoji ?? "🎁";
        const giftName = item?.name ?? "presente";
        const side: BattleSide = gift.receiver_id === battle.host_id ? "host" : "guest";
        void guessName(gift.sender_id).then((name) => {
          const entry: GiftFeedItem = {
            key: `g${++feedKeyRef.current}`,
            username: name,
            emoji,
            giftName,
            side,
          };
          setGiftFeed((prev) => [entry, ...prev].slice(0, 8));
          if ((item?.is_animated && item?.coin_cost >= BIG_GIFT_MIN_COST) || (item?.coin_cost ?? 0) >= 500) {
            showBigGift(emoji, giftName, name);
            playBattleSound("victory");
          } else {
            animateGift(emoji, giftName);
            playBattleSound("gift");
          }
        });
      },
      onExtension: (ext) => {
        setExtensions((prev) => {
          const exists = prev.some((e) => e.id === ext.id);
          return exists ? prev.map((e) => (e.id === ext.id ? ext : e)) : [ext, ...prev];
        });
        if (ext.status === "approved") {
          playBattleSound("extension");
          toast({ title: "⏱️ Batalha estendida!", description: `+${ext.extra_seconds}s adicionados` });
        } else if (ext.status === "requested" && ext.requested_by !== user?.id) {
          playBattleSound("extension");
          toast({ title: "⏱️ Extensão solicitada!", description: "O adversário quer mais tempo." });
        } else if (ext.status === "rejected") {
          toast({ title: "Extensão recusada pelo adversário." });
        }
      },
      onParticipant: () => loadRanking(battleId),
    });

    const chatUnsub = subscribeBattleChat(battleId, (msg) => {
      setChat((prev) => [...prev, msg].slice(-200));
    });

    const viewersUnsub = subscribeBattleViewers(battleId, (viewer: { user_id: string }) => {
      if (viewer.user_id === user?.id) return;
      void guessName(viewer.user_id).then((name) => {
        setChat((prev) => [...prev, {
          id: `enter-${viewer.user_id}-${Date.now()}`,
          battle_id: battleId,
          user_id: viewer.user_id,
          message: "",
          created_at: new Date().toISOString(),
          profiles: { id: viewer.user_id, username: name, avatar_url: null },
        } as RoomChatMessage]);
      });
    });

    const heartsUnsub = subscribeBattleHearts(battleId, (payload) => {
      setHearts((prev) => ({
        ...prev,
        [payload.side]: prev[payload.side] + payload.count,
      }));
    });

    const heartbeat = window.setInterval(() => {
      if (isViewer) void touchBattleViewer(battleId).catch(() => undefined);
    }, 45000);

    return () => {
      unsubscribe();
      chatUnsub();
      viewersUnsub();
      heartsUnsub();
      window.clearInterval(heartbeat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleId, battle?.status, user?.id, loadRanking, guessName, catalog]);

  // Entra como espectador quando a batalha está ao vivo
  useEffect(() => {
    if (!battleId || !battle || !isViewer || battle.status !== "live") return;
    let cancelled = false;
    void joinBattleAsViewer(battleId).catch(() => undefined);
    return () => {
      cancelled = true;
      void leaveBattleAsViewer(battleId).catch(() => undefined);
    };
  }, [battleId, battle, isViewer]);

  // Contagem regressiva 3-2-1 ao iniciar
  useEffect(() => {
    if (liveCountdown === null) return;
    if (liveCountdown <= 0) {
      setLiveCountdown(null);
      return;
    }
    const t = window.setTimeout(() => {
      setLiveCountdown((c) => (c === null ? null : c - 1));
      playBattleSound("countdown");
    }, 900);
    return () => window.clearTimeout(t);
  }, [liveCountdown]);

  // Auto-roll chat
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  // Auto-encerra quando o cronômetro expira
  const handleAutoEnd = useCallback(async () => {
    if (!battle || battle.status !== "live" || !isParticipant || !battle.actual_start) return;
    const endTime = new Date(battle.actual_start).getTime() + battle.duration_seconds * 1000;
    if (Date.now() < endTime || autoEndedRef.current) return;
    autoEndedRef.current = true;
    try { await endBattle(battle.id); } catch { /* já encerrada */ }
  }, [battle, isParticipant]);

  useEffect(() => {
    if (!battle || battle.status !== "live") return;
    const timer = window.setInterval(handleAutoEnd, 2000);
    return () => window.clearInterval(timer);
  }, [battle, handleAutoEnd]);

  // Prêmio do vencedor ao encerrar
  useEffect(() => {
    if (!battle || battle.status !== "ended" || !battle.winner_id) return;
    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("gift_transactions")
        .select("platform_fee")
        .eq("battle_id", battle.id);
      const { data: shareData } = await supabase.rpc("get_platform_config", {
        p_key: "battle_prize_fee_share",
      });
      const share = parseFloat(shareData ?? "") || 0.35;
      const feeTotal = (data ?? []).reduce((sum, t) => sum + t.platform_fee, 0);
      const prize = Math.floor(feeTotal * share);
      setWinnerPrize(prize > 0 ? prize : null);
    })();
  }, [battle?.status, battle?.winner_id, battle?.id]);

  // Confete ao encerrar (todos veem)
  useEffect(() => {
    if (battle?.status === "ended" && battle.winner_id && !confettiRef.current) {
      confettiRef.current = true;
      launchConfetti(3000);
    }
  }, [battle?.status, battle?.winner_id]);

  // Agora — vídeo ao vivo
  const live = useBattleLive({
    battleId,
    isHost: !!isHost,
    isGuest: !!isGuest,
    hostUid,
    guestUid,
    enabled: !!battle && battle.status === "live",
  });

  // Corações por toque (throttle + broadcast)
  const flushHearts = useCallback(() => {
    if (heartTimerRef.current) {
      window.clearTimeout(heartTimerRef.current);
      heartTimerRef.current = null;
    }
    const { side, count } = heartPendingRef.current;
    if (count <= 0) return;
    heartPendingRef.current = { side, count: 0 };
    void sendBattleHearts(battleId, side, count);
  }, [battleId]);

  const tapSide = useCallback((side: BattleSide, container: HTMLElement) => {
    spawnHearts(container, 2);
    const pending = heartPendingRef.current;
    heartPendingRef.current = { side, count: pending.count + 4 };
    if (!heartTimerRef.current) {
      heartTimerRef.current = window.setTimeout(flushHearts, 180);
    }
  }, [flushHearts]);

  // Chat
  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !battle || battle.status !== "live") return;
    setChatInput("");
    try {
      await sendBattleChatMessage(battleId, text);
      setChat((prev) => [...prev, {
        id: `opti-${Date.now()}`,
        battle_id: battleId,
        user_id: user?.id ?? "",
        message: text,
        created_at: new Date().toISOString(),
        profiles: { id: user?.id ?? "", username: user?.user_metadata?.username ?? "você", avatar_url: null },
      } as RoomChatMessage]);
    } catch {
      setChatInput(text);
      toast({ title: "Não foi possível enviar", variant: "destructive" });
    }
  };

  // Actions de batalha
  const handleAccept = async () => {
    if (!battle) return;
    setProcessing(true);
    try {
      await acceptBattle(battle.id);
      const fresh = await fetchBattle(battle.id);
      if (fresh) {
        setBattle(fresh);
        loadProfiles(fresh);
        endedNotifiedRef.current = false;
      }
    } catch (err) {
      toast({ title: "Falha ao aceitar", description: battleErrorMessage(err), variant: "destructive" });
    } finally { setProcessing(false); }
  };

  const handleDecline = async () => {
    if (!battle) return;
    setProcessing(true);
    try { await declineBattle(battle.id); navigate("/battles"); }
    catch (err) { toast({ title: "Falha ao recusar", description: battleErrorMessage(err), variant: "destructive" }); }
    finally { setProcessing(false); }
  };

  const handleCancel = async () => {
    if (!battle) return;
    setProcessing(true);
    try { await cancelBattle(battle.id); navigate("/battles"); }
    catch (err) { toast({ title: "Falha ao cancelar", description: battleErrorMessage(err), variant: "destructive" }); }
    finally { setProcessing(false); }
  };

  const handleEnd = async () => {
    if (!battle) return;
    setProcessing(true);
    try {
      await endBattle(battle.id);
      const fresh = await fetchBattle(battle.id);
      if (fresh) setBattle(fresh);
    } catch (err) {
      toast({ title: "Falha ao encerrar", description: battleErrorMessage(err), variant: "destructive" });
    } finally { setProcessing(false); }
  };

  const handleSurrender = async () => {
    if (!battle) return;
    if (!surrenderArmed) {
      setSurrenderArmed(true);
      window.setTimeout(() => setSurrenderArmed(false), 3500);
      return;
    }
    setSurrenderArmed(false);
    setProcessing(true);
    try {
      await surrenderBattle(battle.id);
      const fresh = await fetchBattle(battle.id);
      if (fresh) setBattle(fresh);
      toast({ title: "🏳️ Você se rendeu!", description: "Respeito pela atitude. 💪" });
    } catch (err) {
      toast({ title: "Falha ao render-se", description: battleSurrenderErrorMessage(err), variant: "destructive" });
    } finally { setProcessing(false); }
  };

  const handleExtend = async () => {
    if (!battle) return;
    setProcessing(true);
    try {
      await extendBattle(battle.id);
      toast({ title: "⏱️ Extensão solicitada!", description: "Aguardando aprovação do adversário." });
      const fresh = await fetchBattle(battle.id);
      if (fresh) setBattle(fresh);
    } catch (err) {
      toast({ title: "Falha na extensão", description: battleErrorMessage(err), variant: "destructive" });
    } finally { setProcessing(false); }
  };

  const handleExtensionVote = async (extId: string, approve: boolean) => {
    setProcessing(true);
    try { await approveBattleExtension(extId, approve); }
    catch (err) { toast({ title: "Falha ao responder", description: battleErrorMessage(err), variant: "destructive" }); }
    finally { setProcessing(false); }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center gap-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="animate-pulse text-zinc-500">Preparando arena...</p>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3 text-white">
          <Swords className="h-10 w-10 text-zinc-600 mx-auto" />
          <p className="font-bold">Batalha não encontrada</p>
          <Button variant="outline" onClick={() => navigate("/battles")}>Voltar para Batalhas</Button>
        </div>
      </div>
    );
  }

  const isInviteForMe = battle.status === "scheduled" && !!isGuest;
  const isMyPendingInvite = battle.status === "scheduled" && !!isHost;
  const totalCoins = battle.host_score + battle.guest_score || 1;
  const hostPct = Math.min(100, Math.round((battle.host_score / totalCoins) * 100));
  const guestPct = 100 - hostPct;
  const hWinning = battle.host_score > battle.guest_score;
  const gWinning = battle.guest_score > battle.host_score;

  const hostName = hostProf?.username ?? "host";
  const guestName = guestProf?.username ?? "guest";

  // CORRECAO: o seletor de lado so aparece para espectadores, e `sideSel`
  // comeca em "host". Para o HOST isso fazia o presente ir para ele mesmo —
  // as moedas saiam da carteira dele e o placar do lado errado subia,
  // contradizendo o rotulo "Presente p/ @adversario" logo acima.
  // Participante sempre presenteia o adversario; espectador escolhe o lado.
  const sideReceiverId = isParticipant
    ? (otherParticipantId as string)
    : (sideSel === "host" ? battle.host_id : battle.guest_id);

  const openedAt = battle.actual_start ? new Date(battle.actual_start).getTime() : 0;
  const endAt = openedAt + battle.duration_seconds * 1000;

  return (
    <div className="h-[100dvh] bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-950/95 border-b border-white/5 z-50">
        <button
          onClick={() => navigate("/battles")}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Batalha
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest rounded-full bg-red-500 px-2.5 py-1 text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            {battle.status === "live" ? "AO VIVO" : battle.status === "scheduled" ? "CONVITE" : "FIM"}
          </span>
          <span className="flex items-center gap-1 text-xs text-zinc-400 font-semibold">
            <Eye className="h-3.5 w-3.5" />
{(battle as unknown as { live_viewers?: number }).live_viewers ?? 0}
          </span>
        </div>

        <button
          onClick={() => setChatOpen((v) => !v)}
          className={cn(
            "md:hidden flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors",
            chatOpen ? "bg-white/15 text-white" : "bg-white/8 text-zinc-300"
          )}
        >
          <Zap className="h-3.5 w-3.5" /> Chat
        </button>
      </header>

      {/* ── Arena (vídeo + placar) ─────────────────────────────────────── */}
      {battle.status === "scheduled" ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {isInviteForMe && (
            <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 space-y-4 text-center mt-8">
              <div className="text-6xl">⚔️</div>
              <p className="text-xl font-black">@{hostName} te desafiou!</p>
              <p className="text-sm text-zinc-400">
                {Math.round(battle.duration_seconds / 60)} minutos de disputa ao vivo em vídeo.
              </p>
              <div className="flex gap-3 justify-center max-w-xs mx-auto">
                <Button onClick={handleAccept} disabled={processing} className="flex-1 gap-2">
                  <Check className="h-4 w-4" /> Aceitar
                </Button>
                <Button onClick={handleDecline} disabled={processing} variant="outline" className="flex-1 gap-2">
                  <X className="h-4 w-4" /> Recusar
                </Button>
              </div>
            </div>
          )}
          {isMyPendingInvite && (
            <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 space-y-4 text-center mt-8">
              <div className="text-6xl animate-pulse">⏳</div>
              <p className="text-xl font-black">Aguardando @{guestName}...</p>
              <p className="text-sm text-zinc-400">Quando aceitar, as câmeras ligam e a plateia pode entrar.</p>
              <Button onClick={handleCancel} disabled={processing} variant="outline">
                Cancelar convite
              </Button>
            </div>
          )}
          {isViewer && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center mt-8 space-y-3">
              <div className="text-5xl">🎥</div>
              <p className="font-bold">A batalha ainda não começou</p>
              <p className="text-sm text-zinc-400">Fique ligado — quando ficar ao vivo, você entra na arena automaticamente.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row relative">
          {/* Painéis de vídeo */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row relative bg-black">
            {/* HOST */}
            <div
              className={cn(
                "relative flex-1 min-h-0 md:min-w-0 overflow-hidden bg-zinc-900 cursor-pointer",
                hWinning && battle.status === "live" && "ring-2 ring-inset ring-amber-400/60",
                battle.winner_id === battle.host_id && "ring-4 ring-inset ring-amber-400 animate-[udgPulseWinner_1.8s_ease-in-out_infinite]"
              )}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                tapSide("host", e.currentTarget);
              }}
            >
              <div ref={live.hostVideoRef} className="absolute inset-0" />
              {!live.joined && battle.status === "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <Avatar className="h-14 w-14 border-2 border-white/10">
                    <AvatarImage src={hostProf?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xl font-black">
                      {hostName[0]?.toUpperCase() ?? "H"}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs animate-pulse">Aguardando vídeo...</p>
                </div>
              )}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="text-emerald-400">●</span> Host
                </span>
                {battle.winner_id === battle.host_id && (
                  <span className="bg-amber-400 text-black rounded-full px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> venceu
                  </span>
                )}
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <span className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                  <Heart className="h-3 w-3 text-rose-400 fill-rose-400" /> {hearts.host}
                </span>
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2 pointer-events-none">
                <div className="bg-black/65 backdrop-blur-md rounded-2xl px-3 py-1.5">
                  <p className="text-sm font-bold leading-tight">@{hostName}{isHost ? " (você)" : ""}</p>
                  <p className="text-[10px] text-zinc-300 font-semibold flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-400" /> {formatCoins(battle.host_score)}
                  </p>
                </div>
              </div>
            </div>

            {/* BARRA CENTRAL (placar) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 md:static md:translate-x-0 md:translate-y-0 md:w-[220px] md:shrink-0 md:flex md:items-center md:justify-center bg-black">
              <div className="bg-zinc-950/85 backdrop-blur-xl border border-white/10 rounded-3xl px-4 py-3 text-center shadow-2xl">
                <div className="text-[11px] font-black tracking-widest text-zinc-500 mb-1">BATALHA</div>
                <div className={cn(
                  "font-mono text-2xl font-black tabular-nums",
                  battle.status === "ended" ? "text-zinc-400" : "text-amber-400"
                )}>
                  <LiveClock endAt={endAt} ended={battle.status !== "live"} />
                </div>
                <div className="mt-2">
                  <div className="relative h-2.5 rounded-full overflow-hidden flex bg-zinc-800">
                    <div
                      className={cn("h-full transition-all duration-500", hWinning || battle.status === "ended" ? "bg-gradient-to-r from-emerald-500 to-lime-400" : "bg-emerald-600/50")}
                      style={{ width: `${hostPct}%` }}
                    />
                    <div
                      className={cn("h-full transition-all duration-500", gWinning || battle.status === "ended" ? "bg-gradient-to-r from-rose-500 to-orange-400" : "bg-rose-600/50")}
                      style={{ width: `${guestPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] font-black">
                    <span className={cn("text-emerald-400", hWinning && "text-lime-300")}>{formatCoins(battle.host_score)}</span>
                    <span className="text-zinc-600 text-[9px] tracking-widest">{hWinning ? "LÍDER" : gWinning ? "LÍDER" : "EMPATE"}</span>
                    <span className={cn("text-rose-400", gWinning && "text-orange-300")}>{formatCoins(battle.guest_score)}</span>
                  </div>
                </div>
                <div className="text-[9px] text-zinc-500 mt-1.5 flex items-center justify-center gap-1">
                  <Users className="h-3 w-3" /> {(battle as unknown as { live_viewers?: number }).live_viewers ?? 0} assistindo
                </div>
              </div>
            </div>

            {/* GUEST */}
            <div
              className={cn(
                "relative flex-1 min-h-0 md:min-w-0 overflow-hidden bg-zinc-900 cursor-pointer",
                gWinning && battle.status === "live" && "ring-2 ring-inset ring-amber-400/60",
                battle.winner_id === battle.guest_id && "ring-4 ring-inset ring-amber-400 animate-[udgPulseWinner_1.8s_ease-in-out_infinite]"
              )}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                tapSide("guest", e.currentTarget);
              }}
            >
              <div ref={live.guestVideoRef} className="absolute inset-0" />
              {!live.joined && battle.status === "live" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <Avatar className="h-14 w-14 border-2 border-white/10">
                    <AvatarImage src={guestProf?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xl font-black">
                      {guestName[0]?.toUpperCase() ?? "G"}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs animate-pulse">Aguardando vídeo...</p>
                </div>
              )}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="text-rose-400">●</span> Guest
                </span>
                {battle.winner_id === battle.guest_id && (
                  <span className="bg-amber-400 text-black rounded-full px-2 py-0.5 text-[10px] font-black flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> venceu
                  </span>
                )}
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <span className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                  <Heart className="h-3 w-3 text-rose-400 fill-rose-400" /> {hearts.guest}
                </span>
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2 pointer-events-none">
                <div className="bg-black/65 backdrop-blur-md rounded-2xl px-3 py-1.5">
                  <p className="text-sm font-bold leading-tight">@{guestName}{isGuest ? " (você)" : ""}</p>
                  <p className="text-[10px] text-zinc-300 font-semibold flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-400" /> {formatCoins(battle.guest_score)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Feed de presentes flutuante */}
          <div className="absolute left-3 bottom-3 z-40 space-y-1.5 pointer-events-none max-w-[62%] md:max-w-xs">
            {giftFeed.slice(0, 4).map((g) => (
              <div
                key={g.key}
                className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-1.5 flex items-center gap-2 animate-[udgGiftFeedIn_5s_ease_forwards]"
              >
                <span className="text-2xl leading-none">{g.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">
                    <span className="text-white/90">{g.username}</span>
                    <span className="text-zinc-400"> · para {g.side === "host" ? "@" + hostName : "@" + guestName}</span>
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">{g.giftName}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Countdown 3-2-1 */}
          {liveCountdown !== null && liveCountdown > 0 && (
            <div className="absolute inset-0 z-[60] bg-black/70 flex items-center justify-center pointer-events-none">
              <div className="text-9xl font-black text-white animate-[udgVsZoom_0.9s_ease-out] text-amber-400">
                {liveCountdown}
              </div>
            </div>
          )}

          {/* Controles participantes */}
          {isParticipant && battle.status === "live" && (
            <div className="absolute bottom-3 right-3 z-40 flex gap-2">
              <button
                onClick={() => live.setMicOn(!live.micOn)}
                className={cn(
                  "p-3 rounded-full backdrop-blur-md border transition-all",
                  live.micOn ? "bg-white/10 border-white/15 text-white" : "bg-red-500/80 border-red-400 text-white"
                )}
                title={live.micOn ? "Mutar microfone" : "Ativar microfone"}
              >
                {live.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                onClick={() => live.setVideoOn(!live.videoOn)}
                className={cn(
                  "p-3 rounded-full backdrop-blur-md border transition-all",
                  live.videoOn ? "bg-white/10 border-white/15 text-white" : "bg-red-500/80 border-red-400 text-white"
                )}
                title={live.videoOn ? "Desligar câmera" : "Ligar câmera"}
              >
                {live.videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Rodapé: controles + chat + presentes ───────────────────────── */}
      <footer className="bg-zinc-950 border-t border-white/5 z-50">
        {battle.status === "live" && isParticipant && (
          <div className="flex items-center justify-around px-3 py-1.5 border-b border-white/5 gap-2 overflow-x-auto">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleExtend}
              disabled={processing || battle.extension_count >= 3}
              className="text-amber-400 gap-1.5 shrink-0 h-8"
            >
              <Timer className="h-3.5 w-3.5" /> +60s ({battle.extension_count}/3)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSurrender}
              disabled={processing}
              className={cn("gap-1.5 shrink-0 h-8", surrenderArmed ? "bg-red-500/20 text-red-400" : "text-zinc-400")}
            >
              <Flag className="h-3.5 w-3.5" /> {surrenderArmed ? "Confirmar rendição?" : "Render-se"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleEnd}
              disabled={processing}
              className="text-zinc-400 gap-1.5 shrink-0 h-8"
            >
              <Trophy className="h-3.5 w-3.5" /> Encerrar
            </Button>
          </div>
        )}

        {extensions.filter((e) => e.status === "requested" && e.requested_by !== user?.id && isParticipant).length > 0 && (
          <div className="px-3 py-2 border-b border-amber-500/20 bg-amber-500/10">
            {extensions
              .filter((e) => e.status === "requested" && e.requested_by !== user?.id && isParticipant)
              .map((ext) => (
                <div key={ext.id} className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-400" /> Adversário quer +{ext.extra_seconds}s
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7" onClick={() => handleExtensionVote(ext.id, true)} disabled={processing}>
                      <Check className="h-3 w-3" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => handleExtensionVote(ext.id, false)} disabled={processing}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {battle.status === "live" && (
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Seletor de lado (espectadores escolhem para quem presentear) */}
            {isViewer ? (
              <div className="flex rounded-full bg-white/8 p-0.5 shrink-0">
                <button
                  onClick={() => setSideSel("host")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] font-black transition-all",
                    sideSel === "host" ? "bg-emerald-500 text-white" : "text-zinc-400"
                  )}
                >
                  @{hostName.slice(0, 12)}
                </button>
                <button
                  onClick={() => setSideSel("guest")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] font-black transition-all",
                    sideSel === "guest" ? "bg-rose-500 text-white" : "text-zinc-400"
                  )}
                >
                  @{guestName.slice(0, 12)}
                </button>
              </div>
            ) : (
              <div className="rounded-full bg-white/8 px-3.5 py-1.5 text-[11px] font-bold text-zinc-300 shrink-0">
                Presente p/ @{isHost ? guestName.slice(0, 12) : hostName.slice(0, 12)}
              </div>
            )}

            <button
              onClick={() => setTrayOpen(!trayOpen)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition-all",
                trayOpen ? "bg-amber-500 text-black" : "bg-gradient-to-r from-amber-500 to-orange-500 text-black"
              )}
            >
              <Gift className="h-4 w-4" />
              {formatCoins(balances.coins)} moedas
            </button>

            <button
              onClick={() => setChatOpen((v) => !v)}
              className="hidden md:flex items-center gap-2 rounded-2xl bg-white/8 py-2.5 px-4 text-sm font-bold"
            >
              <Zap className="h-4 w-4" /> Chat
            </button>
          </div>
        )}

        {/* Bandeja de presentes */}
        {trayOpen && battle.status === "live" && otherParticipantId && (
          <div className="px-3 pb-2">
            <GiftTray receiverId={sideReceiverId} battleId={battleId} />
          </div>
        )}
      </footer>

      {/* ── Chat (painel) ──────────────────────────────────────────────────── */}
      {chatOpen && (
        <div className="absolute inset-0 z-[70] flex flex-col-reverse md:flex-row md:justify-end bg-zinc-950/40">
          <div
            className={cn(
              "flex flex-col bg-zinc-950/97 backdrop-blur-2xl border-white/10 border-t md:border-t-0 md:border-l",
              "h-[62%] md:h-full md:w-80 md:max-w-[30vw]"
            )}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
              <p className="text-sm font-black flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" /> Chat ao vivo
              </p>
              <button onClick={() => setChatOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              <p className="text-center text-[10px] text-zinc-600 py-1">
                Toque nos vídeos para mandar corações 💜 e ajude seu lado com presentes.
              </p>
              {chat.map((m) => {
                const isSystem = m.message === "" && !m.id.startsWith("opti");
                const mine = m.user_id === user?.id;
                return (
                  <div key={m.id} className={cn("flex gap-2", isSystem && "justify-center", mine && "flex-row-reverse")}>
                    {isSystem ? (
                      <span className="text-[10px] text-zinc-500 font-semibold bg-white/4 rounded-full px-3 py-1">
                        <Users className="h-3 w-3 inline mr-1" />{m.profiles?.username ?? "Alguém"} entrou para assistir
                      </span>
                    ) : (
                      <>
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-300">
                            {m.profiles?.username?.[0]?.toUpperCase() ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("rounded-2xl px-3 py-1.5 max-w-[80%]", mine ? "bg-amber-500/15 text-white" : "bg-white/6")}>
                          <p className={cn("text-[10px] font-bold leading-none mb-0.5", mine ? "text-amber-400" : "text-zinc-500")}>
                            @{m.profiles?.username ?? "usuário"}
                          </p>
                          <p className="text-xs break-words">{m.message}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/5">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                placeholder={battle.status === "live" ? "Escreva uma mensagem..." : "Chat disponível durante a batalha"}
                disabled={battle.status !== "live"}
                maxLength={300}
                className="flex-1 bg-white/6 rounded-full px-4 py-2 text-sm outline-none placeholder:text-zinc-600 disabled:opacity-40"
              />
              <button
                onClick={handleSendChat}
                disabled={battle.status !== "live" || !chatInput.trim()}
                className="p-2.5 rounded-full bg-amber-500 text-black disabled:opacity-30 transition-all active:scale-90"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay de resultado ────────────────────────────────────────────── */}
      {(battle.status === "ended" || battle.status === "canceled") && (
        <div className="absolute inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-zinc-950 border border-white/10 p-7 text-center space-y-5 shadow-2xl">
            <div className="text-6xl">
              {battle.status === "canceled" ? "🚫"
                : battle.winner_id === battle.host_id ? "🏆"
                : battle.winner_id === battle.guest_id ? "🏆" : "🤝"}
            </div>
            <div>
              <p className="text-2xl font-black">
                {battle.status === "canceled"
                  ? "Batalha cancelada"
                  : battle.winner_id
                    ? battle.winner_id === battle.host_id
                      ? `@${hostName} venceu!`
                      : `@${guestName} venceu!`
                    : "Empate!"}
              </p>
              <p className="text-sm text-zinc-400 mt-1">
                {battle.host_score} × {battle.guest_score} · {battle.total_gifts_sent ?? 0} presentes ·{" "}
                {formatCoins(battle.total_coins_spent ?? 0)} moedas
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Avatar className="h-12 w-12 border-2 border-amber-400/60">
                  <AvatarImage src={(battle.winner_id === battle.host_id ? hostProf : guestProf)?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-amber-400/10 text-amber-400 font-black">
                    {(battle.winner_id === battle.host_id ? hostName : guestName)[0]?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                {battle.status === "ended" && (
                  <div className="text-left">
                    {winnerPrize !== null && winnerPrize > 0 ? (
                      <p className="text-sm font-black text-amber-400 flex items-center gap-1">
                        <Crown className="h-4 w-4" /> {winnerPrize}💎 de prêmio
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">Prêmio proporcional às taxas da batalha</p>
                    )}
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> Seus diamantes: {formatCoins(balances.diamonds)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  await live.leave().catch(() => undefined);
                  navigate("/battles");
                }}
                className="flex-1 gap-2"
              >
                Ir para Batalhas
              </Button>
              {isParticipant && (
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="flex-1"
                >
                  Revanche
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Erro de vídeo */}
      {live.error && battle.status === "live" && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[75] bg-red-500/90 text-white text-xs font-bold rounded-full px-4 py-2">
          Vídeo offline: {live.error}
        </div>
      )}
    </div>
  );
}

function LiveClock({ endAt, ended }: { endAt: number; ended: boolean }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => force((v) => v + 1), 500);
    return () => window.clearInterval(t);
  }, []);
  if (ended) return <span>FIM</span>;
  const remaining = Math.max(0, endAt - Date.now());
  const totalSec = Math.ceil(remaining / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return <span>{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>;
}