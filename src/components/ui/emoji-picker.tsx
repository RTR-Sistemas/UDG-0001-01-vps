/**
 * =============================================================================
 * File: src/components/ui/emoji-picker.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { Smile, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type EmojiCategoryKey =
  | "recent"
  | "smileys"
  | "animals"
  | "food"
  | "activities"
  | "travel"
  | "objects"
  | "symbols"
  | "flags";

const RECENTS_KEY = "udg_recent_emojis_v1";
const MAX_RECENTS = 36;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
  } catch { }
  return [];
}

function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch { }
}

function pushRecent(emoji: string) {
  const current = loadRecents();
  const next = [emoji, ...current.filter((e) => e !== emoji)].slice(0, MAX_RECENTS);
  saveRecents(next);
}

// "WhatsApp-like" categories (broad + practical set).
// Note: not literally the entire Unicode emoji set (huge), but covers the categories
// and a very complete day-to-day selection users expect.
const EMOJI_CATEGORIES: Array<{
  key: Exclude<EmojiCategoryKey, "recent">;
  label: string;
  tab: string;
  emojis: string[];
}> = [
    {
      key: "smileys",
      label: "Carinhas & Pessoas",
      tab: "😀",
      emojis: [
        "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "☺️", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫠", "🤭", "🫢", "🫣", "🤫", "🤥", "😶", "😶‍🌫️", "😐", "😑", "😬", "🫨", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠",
        "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👋", "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "🫶", "🙏", "🤝", "💪", "🦾", "🧠", "🫀", "🫁",
      ],
    },
    {
      key: "animals",
      label: "Animais & Natureza",
      tab: "🐻",
      emojis: [
        "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪲", "🐞", "🦋", "🐌", "🐛", "🕷️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🦭", "🐊", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐈‍⬛", "🐓", "🦃", "🦚", "🦜", "🦢", "🪿",
        "🌵", "🌲", "🌳", "🌴", "🪵", "🌱", "🌿", "☘️", "🍀", "🎍", "🪴", "🌷", "🌹", "🥀", "🌺", "🌸", "🌼", "🌻", "🍁", "🍂", "🍃", "🌊", "🫧", "🌈", "⭐", "🌟", "✨", "⚡", "🔥", "💧", "❄️", "☃️", "⛄", "🌙", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "💨", "🌪️",
      ],
    },
    {
      key: "food",
      label: "Comidas & Bebidas",
      tab: "🍔",
      emojis: [
        "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "🌯", "🥗", "🥘", "🫕", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪",
        "☕", "🍵", "🧋", "🥤", "🧃", "🧉", "🥛", "🍼", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧊", "🍾",
      ],
    },
    {
      key: "activities",
      label: "Atividades",
      tab: "⚽",
      emojis: [
        "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "⛳", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🏋️", "🤼", "🤸", "⛹️", "🤺", "🏌️", "🏄", "🏊", "🚣", "🧗", "🚴", "🚵", "🏇",
        "🎮", "🕹️", "🎲", "♟️", "🧩", "🎯", "🎳", "🎰",
        "🎨", "🖌️", "🖍️", "🎭", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🪕", "🎻", "🪘", "🪇",
        "🎆", "🎇", "✨", "🎉", "🎊", "🎈", "🎁", "🎀", "🎗️", "🏆", "🥇", "🥈", "🥉",
      ],
    },
    {
      key: "travel",
      label: "Viagens & Lugares",
      tab: "🚗",
      emojis: [
        "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🛵", "🏍️", "🛺", "🚲", "🛴", "🚨", "⛽", "🛞", "🚧",
        "🚈", "🚝", "🚞", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇", "🚊", "🚉", "✈️", "🛫", "🛬", "🛩️", "💺", "🚁", "🚀", "🛸", "🚢", "⛴️", "🛥️", "🚤", "🛳️", "⚓", "🛟",
        "🌍", "🌎", "🌏", "🗺️", "🧭", "🏔️", "⛰️", "🌋", "🗻", "🏕️", "🏖️", "🏝️", "🏜️", "🏞️", "🏟️", "🏛️", "🏗️", "🧱", "🪨", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🕍", "⛩️", "🛕", "🌉", "🌁",
        "🌅", "🌄", "🌇", "🌆", "🌃", "🌌", "🌠", "🎇", "🎆",
      ],
    },
    {
      key: "objects",
      label: "Objetos",
      tab: "💡",
      emojis: [
        "📱", "📲", "💻", "🖥️", "🖨️", "⌨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀", "🧮",
        "🎥", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "🏮", "🪔",
        "📚", "📖", "📝", "✏️", "🖊️", "🖋️", "🖍️", "📌", "📍", "📎", "🗂️", "📁", "📂", "🗃️", "🗄️", "🗑️",
        "🔒", "🔓", "🔑", "🗝️", "🛡️", "⚔️", "🧰", "🪛", "🔧", "🔨", "🪓", "⛏️", "⚙️", "🧲",
        "⏰", "⏱️", "⏳", "⌛", "📡", "🔋", "🪫", "🔌", "🧯", "🧴", "🧼", "🧹", "🧺", "🧻", "🪣",
        "💰", "💳", "🪙", "💎",
        // Custom-ish icons for your app vibe
        "🌐", "🌀", "🚀", "🗳️", "📣", "📨", "📩", "🧠", "🧩", "🛡️", "🪄", "🧿", "📢", "📡",
      ],
    },
    {
      key: "symbols",
      label: "Símbolos",
      tab: "🔣",
      emojis: [
        "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "💖", "💘", "💝", "💞", "💕", "💓", "💗", "💟",
        "💣", "💥", "💫", "✨", "🔥", "⚡", "🌟", "⭐", "✅", "☑️", "✔️", "❌", "❎", "⚠️", "🚫", "⛔", "🛑",
        "🔺", "🔻", "🔸", "🔹", "🔶", "🔷", "🔳", "🔲", "◼️", "◻️", "◾", "◽", "⬛", "⬜", "🟦", "🟩", "🟨", "🟧", "🟥", "🟪",
        "➕", "➖", "✖️", "➗", "♾️", "💯", "🔞", "♻️", "🔱", "⚜️", "〽️", "💤", "🆗", "🆘", "🆙", "🆒", "🆕", "🆓", "🔠", "🔡", "🔢", "🔣",
      ],
    },
    {
      key: "flags",
      label: "Bandeiras",
      tab: "🏁",
      emojis: [
        "🏁", "🚩", "🏴", "🏳️", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️",
        "🇧🇷", "🇺🇸", "🇨🇦", "🇲🇽", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪", "🇪🇨", "🇧🇴", "🇵🇾", "🇺🇾", "🇻🇪",
        "🇵🇹", "🇪🇸", "🇫🇷", "🇮🇹", "🇩🇪", "🇬🇧", "🇮🇪", "🇳🇱", "🇧🇪", "🇸🇪", "🇳🇴", "🇩🇰", "🇨🇭",
        "🇯🇵", "🇰🇷", "🇨🇳", "🇹🇼", "🇭🇰", "🇮🇳", "🇦🇺", "🇳🇿",
      ],
    },
  ];

export type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
};

export function EmojiPicker({
  onSelect,
  disabled,
  className,
  triggerClassName,
  align = "end",
}: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState<EmojiCategoryKey>("recent");
  const [recents, setRecents] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setRecents(loadRecents());
  }, [open]);

  const handlePick = (emoji: string) => {
    // Keep the picker OPEN after selecting (requested)
    pushRecent(emoji);
    setRecents(loadRecents());
    onSelect(emoji);
  };

  const list =
    active === "recent"
      ? recents
      : EMOJI_CATEGORIES.find((c) => c.key === active)?.emojis ?? [];

  const activeLabel =
    active === "recent"
      ? "Recentes"
      : EMOJI_CATEGORIES.find((c) => c.key === active)?.label ?? "Emojis";

  const PickerBody = (
    <>
      {/* Header (title + close) */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10">
        <div className="text-sm font-semibold truncate">{activeLabel}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-white/10"
          onClick={() => setOpen(false)}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10 overflow-x-auto">
        <Tab
          active={active === "recent"}
          onClick={() => setActive("recent")}
          label="🕘"
          title="Recentes"
        />
        {EMOJI_CATEGORIES.map((cat) => (
          <Tab
            key={cat.key}
            active={active === cat.key}
            onClick={() => setActive(cat.key)}
            label={cat.tab}
            title={cat.label}
          />
        ))}
      </div>

      {/* Grid */}
      <div className={cn("p-2", "max-h-[320px]", "overflow-y-auto")}
      >
        {active === "recent" && list.length === 0 ? (
          <div className="text-xs text-gray-400 p-2">Nenhum emoji recente ainda.</div>
        ) : (
          <div className="grid grid-cols-9 gap-1">
            {list.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="h-9 w-9 rounded hover:bg-white/10 active:scale-95 flex items-center justify-center text-[20px]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );



  // Popover anchored to the button for both mobile and desktop
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-9 w-9 rounded-full hover:bg-white/10 active:scale-95 transition",
            triggerClassName
          )}
          aria-label="Inserir emoji"
        >
          <Smile className="h-5 w-5 text-yellow-400 drop-shadow-sm" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side="top"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "w-[min(92vw,360px)] p-0 bg-gray-900 border-gray-700 text-white shadow-2xl z-[9999]",
          className
        )}
        style={{ zIndex: 9999 }}
      >
        {PickerBody}
      </PopoverContent>
    </Popover>
  );
}

function Tab({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-lg transition",
        active ? "bg-white/15" : "hover:bg-white/10"
      )}
    >
      {label}
    </button>
  );
}
