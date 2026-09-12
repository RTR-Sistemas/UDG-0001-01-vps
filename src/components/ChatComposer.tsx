/**
 * =============================================================================
 * File: src/components/ChatComposer.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import { useCallback, useRef, useState } from "react";
import { Paperclip, Smile, AtSign, Send, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import AudioRecorder from "@/components/AudioRecorder";
import MediaUploader from "@/components/MediaUploader";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Props = {
  value: string;
  onChange: (v: string) => void;
  onSendText: () => void;
  onSendMedia: (files: File[]) => void;
  onSendAudio: (blob: Blob) => void;
  placeholder?: string;
  disabled?: boolean;
};

// lightweight emoji list to avoid adding deps
const EMOJIS = ["😀","😁","😂","🤣","😊","😍","😘","😎","🤩","🤔","🙌","👏","👍","🔥","🎉","🥳","💯","✅","❤️","💡","📎","📷"];

export default function ChatComposer({
  value,
  onChange,
  onSendText,
  onSendMedia,
  onSendAudio,
  placeholder = "Escreva uma mensagem… Use @ para mencionar",
  disabled = false,
}: Props) {
  const [chars, setChars] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSendText();
    }
  }, [value, onSendText]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const file = it.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      onSendMedia(files);
    }
  }, [onSendMedia]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onSendMedia(files as File[]);
  }, [onSendMedia]);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-2 sm:p-3",
        "shadow-sm",
        disabled && "opacity-60 pointer-events-none"
      )}
      onPaste={handlePaste}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      aria-label="Campo de composição de mensagem"
    >
      <div className="flex items-end gap-2">
        {/* Attachments / Media */}
        <div className="flex items-center gap-1">
          <MediaUploader onMediaReady={onSendMedia} />
          <AudioRecorder onAudioReady={onSendAudio} maxDuration={120} />
        </div>

        {/* Textarea with mentions */}
        <MentionTextarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => { onChange(e.target.value); setChars(e.target.value.length); }}
          onKeyDown={handleKeyDown}
          className="flex-1 min-h-[44px] max-h-40 resize-y px-3 py-2 rounded-lg border bg-background"
          rows={1}
        />

        {/* Emoji picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-[44px] w-[44px]">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <ScrollArea className="h-40">
              <div className="grid grid-cols-6 gap-2 text-xl">
                {EMOJIS.map(e => (
                  <button
                    type="button"
                    key={e}
                    className="hover:bg-accent rounded-md p-1"
                    onClick={() => onChange(value + e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Send */}
        <Button
          onClick={onSendText}
          disabled={!value.trim()}
          size="icon"
          className="bg-gradient-to-r from-primary to-secondary h-[44px] w-[44px] flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-1 pt-1 flex justify-between text-xs text-muted-foreground">
        <span className="hidden sm:inline">Enter envia • Shift+Enter quebra linha • Arraste arquivos ou cole imagens</span>
        <span>{chars}/2000</span>
      </div>
    </div>
  );
}
