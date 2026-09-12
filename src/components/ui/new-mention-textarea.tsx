/**
 * =============================================================================
 * File: src/components/ui/new-mention-textarea.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export interface NewMentionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onMentionSelect?: (username: string) => void;
}

const autosize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = Math.min(el.scrollHeight, 220) + "px";
};

export const NewMentionTextarea = React.forwardRef<HTMLTextAreaElement, NewMentionTextareaProps>(
  ({ className, onMentionSelect, onChange, onKeyDown, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const insertEmoji = (emoji: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const currentValue = typeof props.value === "string" ? props.value : (el.value ?? "");
      const nextValue = currentValue.slice(0, start) + emoji + currentValue.slice(end);

      const syntheticEvent = {
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>;

      if (onChange) {
        onChange(syntheticEvent);
      } else {
        el.value = nextValue;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(el, nextValue);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }

      requestAnimationFrame(() => {
        try {
          const pos = start + emoji.length;
          el.setSelectionRange(pos, pos);
        } catch { }
      });
    };

    const mergedRef = React.useCallback((node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
    }, [ref]);

    const [showSuggestions, setShowSuggestions] = React.useState(false);
    const [mentionQuery, setMentionQuery] = React.useState("");
    const [cursorPos, setCursorPos] = React.useState(0);
    const [suggestionPos, setSuggestionPos] = React.useState<{ top: number; left: number }>({ top: 36, left: 12 });

    React.useEffect(() => { autosize(textareaRef.current); }, []);

    const { data: users } = useQuery({
      queryKey: ["mention-users", mentionQuery],
      enabled: showSuggestions,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("profiles").select("id, username, avatar_url")
          .ilike("username", `${mentionQuery}%`).limit(8);
        if (error) throw error;
        return (data ?? []) as { id: string; username: string; avatar_url: string | null }[];
      },
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      const pos = e.target.selectionStart ?? v.length;
      setCursorPos(pos);
      const before = v.substring(0, pos);
      const m = before.match(/@([\p{L}\p{N}._-]*)$/u);
      if (m) { setMentionQuery(m[1]); if (!showSuggestions) setShowSuggestions(true); requestAnimationFrame(() => { setSuggestionPos({ top: 36, left: 12 }); }); }
      else { if (showSuggestions) setShowSuggestions(false); if (mentionQuery) setMentionQuery(""); }
      autosize(e.currentTarget);
      onChange?.(e);
    };

    const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { onKeyDown?.(e); };

    const applyMention = (username: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const val = typeof props.value === "string" ? props.value : el.value;
      const before = val.substring(0, cursorPos);
      const start = before.lastIndexOf("@");
      if (start < 0) return;

      const after = val.substring(cursorPos);
      const next = `${val.substring(0, start)}@${username} ${after}`;

      const syntheticEvent = {
        target: { value: next },
        currentTarget: { value: next },
      } as unknown as React.ChangeEvent<HTMLTextAreaElement>;

      if (onChange) {
        onChange(syntheticEvent);
      } else {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(el, next);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }

      setShowSuggestions(false);
      setMentionQuery("");
      const newPos = start + username.length + 2;
      requestAnimationFrame(() => {
        el.focus();
        try { el.setSelectionRange(newPos, newPos); } catch { }
        autosize(el);
      });
      onMentionSelect?.(username);
    };

    return (
      // Important for mobile: inside flex rows, we need flex-1/min-w-0 so the textarea
      // truly occupies the remaining width (otherwise it can shrink and look "cortado").
      <div className="relative w-full flex-1 min-w-0">
        <textarea
          {...props}
          ref={mergedRef}
          className={cn(
            // Give a comfortable default height (≈3 lines) and keep autosize up to 220px.
            "min-h-[96px] max-h-56 w-full resize-none rounded-xl border border-input bg-background/95 px-4 py-3 pr-12 text-sm outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground leading-5",
            "overflow-hidden",
            className
          )}
          onChange={handleChange}
          onKeyDown={handleKey}
          onInput={(e) => { autosize(e.currentTarget); props.onInput?.(e); }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          rows={props.rows ?? 3}
          placeholder={props.placeholder || "Digite uma mensagem... Use @ para mencionar"}
        />
        <div className="absolute bottom-2 right-3">
          <EmojiPicker onSelect={insertEmoji} triggerClassName="h-8 w-8" />
        </div>

        {showSuggestions && users && users.length > 0 && (
          <div className="absolute z-30 w-64 rounded-md border bg-popover p-1 shadow-md" style={{ top: suggestionPos.top, left: suggestionPos.left }} onMouseDown={(e) => e.preventDefault()}>
            <div className="max-h-56 overflow-auto py-1">
              {users.map((u) => (
                <button key={u.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent" onMouseDown={(e) => e.preventDefault()} onClick={() => applyMention(u.username)}>
                  <Avatar className="h-6 w-6"><AvatarImage src={u.avatar_url ?? undefined} alt={u.username} /><AvatarFallback>{u.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <span className="text-sm">@{u.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);
NewMentionTextarea.displayName = "NewMentionTextarea";
export default NewMentionTextarea;
