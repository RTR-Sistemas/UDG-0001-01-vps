import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Clock, BarChart3, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PollVoteRow {
  id: string;
  option_id: string;
  user_id: string;
  username?: string | null;
}

export interface PollOptionRow {
  id: string;
  text: string;
  votes: PollVoteRow[];
}

export interface PollRow {
  id: string;
  message_id: string;
  question: string;
  is_anonymous: boolean;
  expires_at: string | null;
  created_at: string;
}

interface PollCardProps {
  poll: PollRow;
  options: PollOptionRow[];
  myVoteOptionId?: string | null;
  onVote: (optionId: string) => void;
  isVoting?: boolean;
  className?: string;
}

const formatRemaining = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

export function PollCard({ poll, options, myVoteOptionId, onVote, isVoting, className }: PollCardProps) {
  const [now, setNow] = useState(Date.now());

  const closesAtMs = poll.expires_at ? new Date(poll.expires_at).getTime() : null;
  const isClosed = closesAtMs !== null && now >= closesAtMs;

  useEffect(() => {
    if (closesAtMs === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [closesAtMs]);

  const totalVotes = useMemo(
    () => options.reduce((acc, o) => acc + (o.votes ? o.votes.length : 0), 0),
    [options]
  );

  const showResults = totalVotes > 0 || poll.is_anonymous === false || isClosed;

  return (
    <div className={cn("w-full max-w-[320px] rounded-2xl border bg-card shadow-sm p-3 space-y-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <BarChart3 className="h-3 w-3 text-primary" />
          <span>Enquete</span>
        </div>
        <div className="flex items-center gap-1">
          {poll.is_anonymous && (
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground bg-muted/60 border border-border/40 rounded-full px-1.5 py-0.5"
              title="Votos anônimos — ninguém vê quem votou"
            >
              <Lock className="h-2.5 w-2.5" />
              Anônima
            </span>
          )}
          {isClosed && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-destructive bg-destructive/10 border border-destructive/25 rounded-full px-1.5 py-0.5">
              Encerrada
            </span>
          )}
        </div>
      </div>

      <p className="text-sm font-semibold break-words">{poll.question}</p>

      <div className="space-y-1.5">
        {options.map((opt) => {
          const count = opt.votes ? opt.votes.length : 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const voted = myVoteOptionId === opt.id;
          const voters = (opt.votes || [])
            .map((v) => v.username || "Alguém")
            .join(", ");

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isVoting || isClosed}
              onClick={() => onVote(opt.id)}
              className={cn(
                "w-full relative overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors text-xs",
                voted
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/50 bg-background/40 hover:bg-accent/50"
              )}
              title={!poll.is_anonymous && voters ? voters : undefined}
            >
              <div className="relative z-10 flex items-center justify-between gap-2">
                <span className={cn("font-medium break-words", voted && "text-primary")}>
                  {opt.text}
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  {voted && <CheckCheck className="h-3.5 w-3.5 text-primary" />}
                  {showResults && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
                  )}
                </span>
              </div>
              {showResults && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
        <span className="tabular-nums">
          {totalVotes === 0 ? "Nenhum voto ainda" : `${totalVotes} voto${totalVotes === 1 ? "" : "s"}`}
        </span>
        {closesAtMs !== null && !isClosed && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{formatRemaining(closesAtMs - now)}</span>
          </span>
        )}
      </div>
    </div>
  );
}