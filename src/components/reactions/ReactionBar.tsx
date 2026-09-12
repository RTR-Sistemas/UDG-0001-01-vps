import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  username?: string | null;
  avatar_url?: string | null;
}

interface ReactionBarProps {
  reactions: ReactionRow[];
  currentUserId?: string;
  onToggle?: (emoji: string) => void;
  className?: string;
}

export function ReactionBar({ reactions, currentUserId, onToggle, className }: ReactionBarProps) {
  if (!reactions || reactions.length === 0) return null;

  const grouped = new Map<string, ReactionRow[]>();
  reactions.forEach((r) => {
    const list = grouped.get(r.emoji) || [];
    list.push(r);
    grouped.set(r.emoji, list);
  });

  const items = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-wrap items-center gap-1", className)}>
        {items.map(([emoji, rows]) => {
          const iReacted = !!currentUserId && rows.some((r) => r.user_id === currentUserId);
          const names = rows
            .map((r) => r.username || "Alguém")
            .join(", ");
          return (
            <Tooltip key={emoji}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={!onToggle}
                  onClick={() => onToggle?.(emoji)}
                  className={cn(
                    "h-6 px-1.5 rounded-full border text-[11px] font-medium flex items-center gap-1 transition-colors select-none",
                    iReacted
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/70 border-border/40 text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span className="leading-none">{emoji}</span>
                  <span className="tabular-nums">{rows.length}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-[220px] text-[11px]">
                {names}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}