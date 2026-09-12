/**
 * =============================================================================
 * File: src/components/chat/ChatInput.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Paperclip, Mic, Square, Send, Clock, Lock } from "lucide-react";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type ChatInputProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onUploadFiles: (files: File[]) => void;
  onRecordStart: () => void;
  onRecordStop: () => void;
  isRecording?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export default function ChatInput({
  value,
  onChange,
  onSend,
  onUploadFiles,
  onRecordStart,
  onRecordStop,
  isRecording,
  disabled,
  placeholder,
}: ChatInputProps) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // Envia com Enter (mas permite Shift+Enter para quebra de linha)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Ajusta a altura da caixa de texto automaticamente conforme digita
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = () => {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    };
    resize();
    const handler = () => resize();
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [value]);

  const pickFiles = () => fileRef.current?.click();
  
  const onPicked: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) onUploadFiles(files);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col w-full gap-2">
      <div className="flex items-end gap-2">
        {/* Botão de Anexo */}
        <button
          type="button"
          onClick={pickFiles}
          className="h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="Enviar foto ou vídeo (Autodestrutivo)"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          multiple
          onChange={onPicked}
        />

        {/* Área de Texto */}
        <div className="relative flex-1">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Digite uma mensagem..."}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full min-h-[44px] max-h-52 resize-none rounded-xl border border-input bg-background/50 backdrop-blur-sm",
              "px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 placeholder:text-muted-foreground leading-relaxed",
              "scrollbar-thin scrollbar-thumb-muted/50 scrollbar-track-transparent"
            )}
          />
        </div>

        {/* Botão de Gravação / Parar */}
        {!isRecording ? (
          <button
            type="button"
            onClick={onRecordStart}
            disabled={disabled}
            className="h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Gravar áudio (Autodestrutivo)"
          >
            <Mic size={20} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onRecordStop}
            className="h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center bg-destructive text-destructive-foreground hover:opacity-90 animate-pulse shadow-md shadow-destructive/20"
            title="Parar gravação"
          >
            <Square size={18} fill="currentColor" />
          </button>
        )}

        {/* Botão Enviar */}
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className={cn(
            "h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center transition-all",
            value.trim() 
              ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm" 
              : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
          )}
          title="Enviar (Autodestruição: 2min)"
        >
          <Send size={18} className={cn(value.trim() && "ml-0.5")} />
        </button>
      </div>

      {/* Indicador Visual do Modo Autodestruição */}
      <div className="flex items-center justify-end gap-3 px-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-medium select-none">
          <Lock size={10} />
          <span>Criptografado</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-orange-500/80 font-medium select-none animate-pulse">
          <Clock size={10} />
          <span>Autodestruição (2 min)</span>
        </div>
      </div>
    </div>
  );
}