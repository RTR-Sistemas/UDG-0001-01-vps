/**
 * =============================================================================
 * File: src/components/NewComposer.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */


import React, { memo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, Camera, Image as ImageIcon } from "lucide-react";
import AudioRecorder from "@/components/AudioRecorder";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Props = {
  value: string;
  onChange: (v: string) => void;
  onSendText: () => void;
  onSendMedia: (files: File[]) => void;
  onSendAudio: (blob: Blob) => void;
};

function NewComposerInner({ value, onChange, onSendText, onSendMedia, onSendAudio }: Props) {
  const filePickerRef = useRef<HTMLInputElement>(null);
  const capturePickerRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full border-t bg-card p-3 sm:p-4 relative z-[60] pointer-events-auto" onClick={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.stopPropagation()}>
      <div className="flex items-end gap-2">
        {/* Galeria */}
        <input
          ref={filePickerRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) onSendMedia(files as File[]);
            if (filePickerRef.current) filePickerRef.current.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="h-[44px] w-[44px]" onClick={()=>filePickerRef.current?.click()}>
          <ImageIcon className="h-5 w-5" />
        </Button>

        {/* Câmera nativa */}
        <input
          ref={capturePickerRef}
          type="file"
          accept="image/*,video/*"
          capture
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) onSendMedia(files as File[]);
            if (capturePickerRef.current) capturePickerRef.current.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="icon" className="h-[44px] w-[44px]" onClick={()=>capturePickerRef.current?.click()}>
          <Camera className="h-5 w-5" />
        </Button>

        {/* Áudio */}
        <AudioRecorder onAudioReady={onSendAudio} maxDuration={120} />

        {/* Texto */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (value.trim()) onSendText();
            }
          }}
          onKeyUp={(e)=>e.stopPropagation()}
          onKeyPress={(e)=>e.stopPropagation()}
          placeholder="Digite sua mensagem (Enter envia • Shift+Enter quebra linha)"
          rows={1}
          className={cn("flex-1 min-h-[44px] max-h-40 resize-y px-3 py-2 rounded-md border bg-background")}
        />

        {/* Enviar */}
        <Button
          type="button"
          onClick={onSendText}
          disabled={!value.trim()}
          size="icon"
          className="bg-gradient-to-r from-primary to-secondary h-[44px] w-[44px] flex-shrink-0"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default memo(NewComposerInner);
