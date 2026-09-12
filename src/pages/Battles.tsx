/**
 * =============================================================================
 * File: src/pages/Battles.tsx
 * Purpose: Lobby de Batalhas — batalhas ao vivo, convites, criação de novos
 *          desafios e histórico.
 * =============================================================================
 */

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  acceptBattle,
  declineBattle,
  battleErrorMessage,
  fetchLiveBattles,
  fetchMyBattleHistory,
  subscribeNewBattles,
  type Battle,
} from "@/services/battleService";
import { cn } from "@/lib/utils";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Swords, Trophy, Flame, Clock, Check, X, Search, Users } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { formatCoins } from "@/lib/battleUtils";

interface ChallengerOption {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export default function Battles() {
  const { user } = useAuth();
  const { balances } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [liveBattles, setLiveBattles] = useState<Battle[]>([]);
  const [history, setHistory] = useState<Battle[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ChallengerOption>>({});
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ChallengerOption[]>([]);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [live, hist] = await Promise.all([
      fetchLiveBattles(),
      fetchMyBattleHistory(user.id, 10).catch(() => []),
    ]);
    setLiveBattles(live);
    setHistory(hist);
    setLoading(false);
    const ids = Array.from(
      new Set(live.flatMap((b) => [b.host_id, b.guest_id]))
    );
    if (ids.length > 0) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", ids);
        const map: Record<string, ChallengerOption> = {};
        ((data ?? []) as ChallengerOption[]).forEach((p) => { map[p.id] = p; });
        setProfilesMap(map);
      } catch { /* segue sem avatares */ }
    }
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const unsubscribe = subscribeNewBattles(user.id, {
      onInvite: () => refresh(),
      onBattleChanged: () => refresh(),
    });
    const timer = window.setInterval(refresh, 15000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [user, refresh]);

  const myInvites = liveBattles.filter(
    (b) => b.status === "scheduled" && b.guest_id === user?.id
  );
  const myLive = liveBattles.filter(
    (b) => b.status === "live" && (b.host_id === user?.id || b.guest_id === user?.id)
  );
  const othersLive = liveBattles.filter((b) => b.status === "live" && !myLive.includes(b));
  const otherInvites = liveBattles.filter(
    (b) => b.status === "scheduled" && b.guest_id !== user?.id
  );

  const handleAccept = async (battleId: string) => {
    try {
      await acceptBattle(battleId);
      navigate(`/battle/${battleId}`);
    } catch (err) {
      toast({ title: "Não foi possível aceitar", description: battleErrorMessage(err), variant: "destructive" });
    }
  };

  const handleDecline = async (battleId: string) => {
    try {
      await declineBattle(battleId);
      refresh();
    } catch (err) {
      toast({ title: "Erro", description: battleErrorMessage(err), variant: "destructive" });
    }
  };

  // Busca adversário por username
  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${query.trim()}%`)
        .limit(8);
      setResults(
        ((data ?? []) as ChallengerOption[]).filter((p) => p.id !== user?.id)
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleChallenge = async (targetId: string) => {
    setSearchOpen(false);
    setSearch("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: guest } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", targetId)
        .maybeSingle();
      const { startBattle } = await import("@/services/battleService");
      const battleId = await startBattle(targetId);
      toast({
        title: "⚔️ Desafio enviado!",
        description: `Batalha contra @${(guest as { username?: string } | null)?.username ?? "adversário"} aguardando aceite.`,
      });
      navigate(`/battle/${battleId}`);
    } catch (err) {
      toast({ title: "Falha ao desafiar", description: battleErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground overflow-y-auto pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Swords className="h-6 w-6 text-primary" />
              Batalhas
            </h1>
          </div>
        </header>

        {/* Minha batalha ativa */}
        {myLive.length > 0 && (
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-bold flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                Sua batalha está ao vivo!
              </p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button
              className="w-full"
              onClick={() => navigate(`/battle/${myLive[0].id}`)}
              data-testid="enter-my-battle"
            >
              Entrar na batalha
            </Button>
          </section>
        )}

        {/* Convites para mim */}
        {myInvites.length > 0 && (
          <section className="space-y-2" data-testid="my-invites">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Convites recebidos
            </h2>
            {myInvites.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/70 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">
                    Convite de batalha ({Math.round(b.duration_seconds / 60)} min)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    O host desafia você para uma batalha ao vivo!
                  </p>
                </div>
                <Button size="sm" onClick={() => handleAccept(b.id)} className="gap-1">
                  <Check className="h-3.5 w-3.5" /> Aceitar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDecline(b.id)} className="gap-1">
                  <X className="h-3.5 w-3.5" /> Recusar
                </Button>
              </div>
            ))}
          </section>
        )}

        {/* Outros convites */}
        {otherInvites.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Convites abertos
            </h2>
            {otherInvites.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-2xl border border-border/40 bg-card/40 p-4"
              >
                <p className="text-sm font-semibold">Desafio pendente…</p>
                <span className="text-xs text-muted-foreground">
                  esperando @guest aceitar
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Batalhas ao vivo de outros */}
        {othersLive.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-500 opacity-75" />
                <span className="relative rounded-full h-2 w-2 bg-red-500" />
              </span>
              Ao vivo agora
            </h2>
            {othersLive.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate(`/battle/${b.id}`)}
                className="w-full overflow-hidden rounded-2xl border border-border/40 bg-card/70 text-left transition-colors hover:bg-card group"
              >
                <div className="flex items-center justify-between px-4 pt-3">
                  <span className="text-[10px] font-black tracking-widest text-red-500 bg-red-500/10 rounded-full px-2.5 py-1">
                    ● AO VIVO
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {(b as unknown as { live_viewers?: number }).live_viewers ?? 0} assistindo
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-3">
                  <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    <span className="h-11 w-11 rounded-full bg-emerald-500/15 text-emerald-500 font-black flex items-center justify-center border-2 border-emerald-500/50 text-sm overflow-hidden">
                      {profilesMap[b.host_id]?.avatar_url ? (
                        <img src={profilesMap[b.host_id].avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        `@${(profilesMap[b.host_id]?.username?.[0] ?? "?").toUpperCase()}`
                      )}
                    </span>
                    <span className="text-xs font-bold truncate max-w-full">
                      @{profilesMap[b.host_id]?.username ?? "host"}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-black tabular-nums">
                      {formatCoins(b.host_score)}
                    </span>
                  </div>
                  <div className="text-center shrink-0">
                    <span className="text-lg font-black text-muted-foreground rotate-90 inline-block">VS</span>
                    <div className="mt-1 h-1.5 w-24 rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
                        style={{ width: `${((b.host_score / (b.host_score + b.guest_score || 1)) * 100).toFixed(1)}%` }}
                      />
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-orange-400"
                        style={{ width: `${((b.guest_score / (b.host_score + b.guest_score || 1)) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    <span className="h-11 w-11 rounded-full bg-rose-500/15 text-rose-500 font-black flex items-center justify-center border-2 border-rose-500/50 text-sm overflow-hidden">
                      {profilesMap[b.guest_id]?.avatar_url ? (
                        <img src={profilesMap[b.guest_id].avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        `@${(profilesMap[b.guest_id]?.username?.[0] ?? "?").toUpperCase()}`
                      )}
                    </span>
                    <span className="text-xs font-bold truncate max-w-full">
                      @{profilesMap[b.guest_id]?.username ?? "guest"}
                    </span>
                    <span className="text-[10px] text-rose-500 font-black tabular-nums">
                      {formatCoins(b.guest_score)}
                    </span>
                  </div>
                </div>
                <div className="px-4 pb-3">
                  <span className="block w-full text-center rounded-xl bg-primary/10 text-primary text-xs font-black py-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    👁️ ASSISTIR AGORA
                  </span>
                </div>
              </button>
            ))}
          </section>
        )}

        {/* Iniciar nova batalha */}
        <section className="rounded-2xl border-2 border-dashed border-border/60 p-5 flex flex-col items-center gap-3 text-center">
          <Trophy className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-bold">Crie uma nova batalha</p>
            <p className="text-sm text-muted-foreground">
              Desafie um amigo para uma disputa ao vivo de presentes e faça o placar bombar!
            </p>
          </div>
          <Button onClick={() => setSearchOpen(true)} data-testid="new-battle-button">
            <Swords className="h-4 w-4" /> Desafiar alguém
          </Button>
        </section>

        {/* Histórico */}
        {!loading && history.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Batalhas anteriores
            </h2>
            {history.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "flex items-center justify-between rounded-2xl border border-border/30 bg-card/40 p-3",
                  b.winner_id === user?.id && "ring-1 ring-amber-400/40"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {b.winner_id
                      ? b.winner_id === user?.id
                        ? "🏆 Você venceu!"
                        : "Você perdeu"
                      : "🤝 Empate"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCoins(b.host_score)} vs {formatCoins(b.guest_score)} pts ·{" "}
                    {b.total_gifts_sent ?? 0} presentes
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/battle/${b.id}`)}
                >
                  Ver
                </Button>
              </div>
            ))}
          </section>
        )}

        {/* Modal de busca de adversário */}
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className="max-w-sm sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                Desafiar alguém
              </DialogTitle>
              <DialogDescription>
                Busque pelo nome de usuário (@username) para enviar um convite de batalha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar usuário..."
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {searching && (
                  <p className="text-xs text-muted-foreground text-center py-3 animate-pulse">
                    Buscando...
                  </p>
                )}
                {!searching && results.length === 0 && search.trim().length >= 2 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhum usuário encontrado.
                  </p>
                )}
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleChallenge(p.id)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3 text-left transition-colors hover:bg-card"
                  >
                    <span className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                      @{p.username?.[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="font-semibold text-sm">@{p.username}</span>
                    <span className="ml-auto text-xs font-bold text-primary">
                      <Swords className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}