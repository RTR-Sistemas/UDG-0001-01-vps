import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
  myEmojis?: string[];
  className?: string;
  trigger?: ReactNode;
}

export function ReactionPicker({ onReact, myEmojis = [], className, trigger }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);

  const handlePick = (emoji: string) => {
    setOpen(false);
    onReact(emoji);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            className={cn(
              "h-6 w-6 rounded-full bg-muted/70 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors select-none",
              className
            )}
            title="Reagir"
            aria-label="Reagir"
          >
            <span className="text-xs leading-none">🙂</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-auto p-1.5 z-[120]">
        <div className="flex items-center gap-0.5">
          {QUICK_EMOJIS.map((emoji) => {
            const active = myEmojis.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => handlePick(emoji)}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center text-xl hover:bg-accent transition-all select-none",
                  active && "bg-primary/10 ring-1 ring-primary/40"
                )}
                title={active ? "Remover reação" : "Reagir"}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}