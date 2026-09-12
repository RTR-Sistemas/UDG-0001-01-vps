/**
 * =============================================================================
 * File: src/components/ui/mention-textarea.tsx
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmojiPicker } from "@/components/ui/emoji-picker";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export interface MentionTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onMentionSelect?: (username: string) => void;
}

const MentionTextarea = React.forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  ({ className, onMentionSelect, ...props }, ref) => {
    const [showSuggestions, setShowSuggestions] = React.useState(false);
    const [mentionQuery, setMentionQuery] = React.useState("");
    const [cursorPosition, setCursorPosition] = React.useState(0);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [suggestionPosition, setSuggestionPosition] = React.useState({ top: 0, left: 0 });
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Autosize without scrollbars (requested)
    const autosize = React.useCallback((el: HTMLTextAreaElement | null) => {
      if (!el) return;
      // Reset then grow to content height
      el.style.height = "0px";
      // Cap a bit so big texts don't explode layouts
      el.style.height = Math.min(el.scrollHeight, 240) + "px";
    }, []);

    const insertEmoji = (emoji: string) => {
      const el = textareaRef.current;
      if (!el) return;

      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;

      const currentValue =
        typeof props.value === "string" ? props.value : (el.value ?? "");

      const nextValue = currentValue.slice(0, start) + emoji + currentValue.slice(end);

      // Controlled
      if (props.onChange) {
        const syntheticEvent = {
          ...({} as any),
          target: { value: nextValue },
          currentTarget: { value: nextValue },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        props.onChange(syntheticEvent);
      } else {
        el.value = nextValue;
      }

      // Restore cursor
      requestAnimationFrame(() => {
        try {
          const pos = start + emoji.length;
          el.setSelectionRange(pos, pos);
        } catch { }
      });
    };

    const suggestionsRef = React.useRef<HTMLDivElement>(null);

    // Fetch users for mentions
    const { data: users } = useQuery({
      queryKey: ["users-mention", mentionQuery],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .ilike("username", `${mentionQuery}%`)
          .limit(10);

        if (error) throw error;
        return data || [];
      },
      enabled: showSuggestions,
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart;

      setCursorPosition(cursorPos);

      // Check for @ mentions
      const textBeforeCursor = value.substring(0, cursorPos);
      const mentionMatch = textBeforeCursor.match(/@([\p{L}\p{N}._-]*)$/u);

      if (mentionMatch) {
        setMentionQuery(mentionMatch[1]);
        setShowSuggestions(true);

        setActiveIndex(0);

        // Calculate position for suggestions (fixed overlay)
        const textarea = textareaRef.current;
        if (textarea) {
          const coords = getCaretCoordinates(textarea, cursorPos);
          const rect = textarea.getBoundingClientRect();
          setSuggestionPosition({
            top: Math.round(rect.top + coords.top + 28),
            left: Math.round(rect.left + coords.left),
          });
        }
      } else {
        setShowSuggestions(false);
        setMentionQuery("");
      }

      // Grow textarea as user types (no scrollbar)
      autosize(e.currentTarget);

      // Call parent onChange
      if (props.onChange) {
        props.onChange(e);
      }
    };

    const handleMentionClick = (username: string) => {
      if (!props.onChange) return;

      const textarea = textareaRef.current;
      if (!textarea) return;

      const value = textarea.value;
      const textBeforeCursor = value.substring(0, cursorPosition);
      const textAfterCursor = value.substring(cursorPosition);

      // Find the @ symbol position
      const mentionStart = textBeforeCursor.lastIndexOf("@");

      // Replace the partial mention with the full username
      const newValue =
        value.substring(0, mentionStart) +
        `@${username} ` +
        textAfterCursor;

      // Create synthetic event and call onChange
      const syntheticEvent = {
        target: { ...textarea, value: newValue },
        currentTarget: { ...textarea, value: newValue },
      } as React.ChangeEvent<HTMLTextAreaElement>;

      props.onChange(syntheticEvent);

      if (onMentionSelect) {
        onMentionSelect(username);
      }

      setShowSuggestions(false);
      setMentionQuery("");

      // Focus and position cursor
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = mentionStart + username.length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      props.onKeyDown?.(e);
      if (!showSuggestions || !users || users.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, users.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        // Insere o usuário selecionado
        e.preventDefault();
        const pick = users[activeIndex];
        if (pick?.username) handleMentionClick(pick.username);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
      }
    };

    // Helper function to get caret coordinates
    const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
      const div = document.createElement("div");
      const style = getComputedStyle(element);

      Array.from(style).forEach((prop) => {
        div.style.setProperty(prop, style.getPropertyValue(prop));
      });

      div.style.position = "absolute";
      div.style.visibility = "hidden";
      div.style.whiteSpace = "pre-wrap";
      div.style.wordWrap = "break-word";

      div.textContent = element.value.substring(0, position);

      const span = document.createElement("span");
      span.textContent = element.value.substring(position) || ".";
      div.appendChild(span);

      document.body.appendChild(div);

      const coordinates = {
        top: span.offsetTop,
        left: span.offsetLeft,
      };

      if (div.parentNode) div.parentNode.removeChild(div);

      return coordinates;
    };

    // Close suggestions when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          suggestionsRef.current &&
          !suggestionsRef.current.contains(event.target as Node) &&
          textareaRef.current &&
          !textareaRef.current.contains(event.target as Node)
        ) {
          setShowSuggestions(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Keep height in sync for controlled values
    React.useEffect(() => {
      autosize(textareaRef.current);
    }, [autosize, props.value]);

    return (
      // Important for mobile: when used inside flex rows (comment composers),
      // flex-1/min-w-0 prevents the textarea from shrinking/cropping.
      <div className="relative w-full flex-1 min-w-0">
        <textarea
          className={cn(
            // Default ≈3 lines, no scrollbar, grows with content
            "flex min-h-[96px] max-h-60 w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-2 pr-14 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={(node) => {
            textareaRef.current = node;
            if (typeof ref === "function") {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={(e) => autosize(e.currentTarget)}
          {...props}
          rows={props.rows ?? 3}
        />
        <div className="absolute bottom-2 right-3">
          <EmojiPicker onSelect={insertEmoji} triggerClassName="h-8 w-8" />
        </div>


        {showSuggestions && users && users.length > 0 && (
          <div
            ref={suggestionsRef}
            className="fixed z-[100] w-64 rounded-lg border-2 border-primary bg-card shadow-2xl"
            style={{
              top: `${suggestionPosition.top}px`,
              left: `${suggestionPosition.left}px`,
            }}
          >
            <div className="max-h-48 overflow-y-auto p-2">
              {users.map((user, idx) => (
                <button
                  key={user.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer transition-all text-left border",
                    "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                    activeIndex === idx
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-transparent"
                  )}
                  onClick={() => handleMentionClick(user.username)}
                >
                  <Avatar className="h-8 w-8 border-2 border-border">
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                      {user.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">@{user.username}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

MentionTextarea.displayName = "MentionTextarea";

export { MentionTextarea };
