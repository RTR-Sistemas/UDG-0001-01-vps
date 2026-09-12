import { useState, useRef, useEffect, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Zap, Sparkles, Smile, Heart, Star, Search, Grid, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_EMOJI_PACKS, EmojiPack, EMOJI_CATEGORIES } from "@/hooks/useEmojiPacks";
import { useToast } from "@/hooks/use-toast";
import { useDeleteEntireConversation } from "@/hooks/useMessageDeletion";

interface EmojiPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEmoji: (emoji: string, packId?: string, isAnimated?: boolean) => void;
  onSelectSticker?: (url: string) => void;
  currentPackId?: string;
  className?: string;
}

const RECENT_EMOJIS_KEY = "udg_recent_emojis";
const MAX_RECENT = 30;

export function EmojiPicker({
  open,
  onOpenChange,
  onSelectEmoji,
  onSelectSticker,
  currentPackId = "reactions",
  className,
}: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("reactions");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_EMOJIS_KEY) || "[]");
    } catch { return []; }
  });
  const [showPackManager, setShowPackManager] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load packs
  const packs = useMemo(() => {
    const all = [...DEFAULT_EMOJI_PACKS];
    // Add custom unlocked packs from localStorage
    try {
      const custom = JSON.parse(localStorage.getItem("udg_custom_packs") || "[]");
      all.push(...custom);
    } catch {}
    return all;
  }, []);

  const currentPack = packs.find(p => p.id === activeCategory) || DEFAULT_EMOJI_PACKS[0];

  const addToRecent = (emoji: string) => {
    setRecentEmojis(prev => {
      const filtered = prev.filter(e => e !== emoji);
      const next = [emoji, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const filteredEmojis = useMemo(() => {
    if (!searchQuery) return currentPack.items;
    return currentPack.items.filter(item => 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.emoji.includes(searchQuery)
    );
  }, [currentPack.items, searchQuery]);

  useEffect(() => {
    searchRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className={cn("fixed bottom-20 left-1/2 -translate-x-1/2 z-[150] w-full max-w-lg animate-in slide-in-from-bottom-4 duration-200", className)}>
      <div className="bg-card border border-border shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/30 sticky top-0 bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-lg">{currentPack.icon_emoji}</span>
              <span className="font-semibold text-sm">{currentPack.name}</span>
              {currentPack.is_animated && <Zap className="h-3 w-3 text-yellow-500 animate-pulse" />}
              {currentPack.is_premium && <Star className="h-3 w-3 text-yellow-500" />}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowPackManager(true)}
              title="Gerenciar packs"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { onSelectEmoji(""); onOpenChange(false); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar emoji..."
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto scrollbar-hide">
          {EMOJI_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <span className="text-base">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Emoji Grid */}
        <ScrollArea className="p-3 max-h-[350px]">
          {recentEmojis.length > 0 && activeCategory === "reactions" && !searchQuery && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-medium text-muted-foreground">Recentes</span>
                <button
                  onClick={() => {
                    localStorage.removeItem(RECENT_EMOJIS_KEY);
                    setRecentEmojis([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {recentEmojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => { onSelectEmoji(emoji); addToRecent(emoji); }}
                    className="h-10 w-10 rounded-xl bg-background border border-border hover:bg-accent hover:border-primary/50 flex items-center justify-center text-xl transition-all active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-8 gap-1">
            {filteredEmojis.map((item, idx) => (
              <button
                key={`${item.emoji}-${idx}`}
                onClick={() => { 
                  onSelectEmoji(item.emoji, currentPack.id, currentPack.is_animated);
                  addToRecent(item.emoji);
                }}
                className={cn(
                  "h-10 w-10 rounded-xl bg-background border border-border flex items-center justify-center transition-all active:scale-95",
                  currentPack.is_animated && "relative overflow-hidden"
                )}
                title={item.name}
              >
                {item.animation_url ? (
                  <>
                    <span className="text-xl relative z-10">{item.emoji}</span>
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-pink-400/20 animate-pulse" />
                  </>
                ) : (
                  <span className="text-xl">{item.emoji}</span>
                )}
              </button>
            ))}
          </div>

          {filteredEmojis.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30 mb-2" />
              <p>Nenhum emoji encontrado</p>
            </div>
          )}
        </ScrollArea>

        {/* Pack Manager Modal */}
        {showPackManager && (
          <div className="border-t p-3 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">Meus Packs</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPackManager(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {packs.map(pack => (
                <button
                  key={pack.id}
                  onClick={() => { setActiveCategory(pack.id); setShowPackManager(false); setSearchQuery(""); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                    activeCategory === pack.id
                      ? "bg-primary/10 border-primary/50"
                      : "border-border hover:bg-accent/50"
                  )}
                >
                  <span className="text-2xl">{pack.icon_emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{pack.name}</p>
                    <p className="text-xs text-muted-foreground">{pack.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {pack.is_animated && <Zap className="h-3 w-3 text-yellow-500" />}
                    {pack.is_premium && <Star className="h-3 w-3 text-yellow-500" />}
                    {pack.unlocked ? (
                      <span className="text-xs text-green-600 dark:text-green-400">Desbloqueado</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Bloqueado</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DeleteAllMessagesButton({
  conversationId,
  onDeleted,
  disabled = false,
}: {
  conversationId: string;
  onDeleted: () => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const { toast } = useToast();
  const { mutate: deleteConversation, isPending } = useDeleteEntireConversation();

  const handleClick = () => {
    if (!confirming) setConfirming(true);
    else if (!confirmAll) setConfirmAll(true);
    else {
      deleteConversation({ conversationId, scope: "me" }, {
        onSuccess: () => { toast({ title: "Conversa apagada" }); onDeleted(); setConfirming(false); setConfirmAll(false); },
        onError: () => { setConfirming(false); setConfirmAll(false); }
      });
    }
  };

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10"
        onClick={handleClick}
        disabled={disabled || isPending}
        title="Apagar todas as mensagens"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="absolute bottom-full right-0 mb-2 p-2 bg-popover border border-border rounded-xl shadow-lg animate-in zoom-in-95 duration-150 w-64">
      <p className="text-sm font-medium mb-3">Apagar TODAS as mensagens?</p>
      {!confirmAll ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={() => setConfirmAll(true)}>Confirmar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-destructive font-medium">Tem certeza absoluta?</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmAll(false)}>Voltar</Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={handleClick} disabled={isPending}>
              {isPending ? "Apagando..." : "APAGAR TUDO"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}