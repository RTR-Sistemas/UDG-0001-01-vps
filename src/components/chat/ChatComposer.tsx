/**
 * =============================================================================
 * File: src/components/chat/ChatComposer.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Paperclip, Mic, Square, Send, BellRing } from "lucide-react";
import AttentionButton from "@/components/chat/AttentionButton";
import { usePermissions } from "@/contexts/PermissionContext";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type Props = {
  onSend: (text: string, files?: File[], audioBlob?: Blob) => void;
  disabled?: boolean;
  /** Quando informado (chat privado), habilita o botão "Chamar atenção" no próprio chat */
  receiverId?: string | null;
};

export default function ChatComposer({ onSend, disabled, receiverId }: Props) {
  const { requestPermission } = usePermissions();
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [text, setText] = React.useState("");
  const [isRecording, setIsRecording] = React.useState(false);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);

  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const resize = () => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 220) + "px"; };
    resize();
    const handler = () => resize();
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  };

  const doSend = (files?: File[]) => {
    const clean = text.trim();
    if (!clean && !(files && files.length > 0)) { return; }
    onSend(clean, files);
    setText("");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const pickFiles = () => fileRef.current?.click();
  const onPicked: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) doSend(files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startRec = async () => {
    const micGranted = await requestPermission(
      'microphone',
      'Para gravar e enviar sua mensagem de voz, o app precisa acessar o microfone.'
    );
    if (!micGranted) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onSend("", undefined, blob);
      };
      recRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (e) { console.error(e); alert("Não foi possível acessar o microfone."); }
  };

  const stopRec = () => { const mr = recRef.current; if (mr && mr.state !== "inactive") mr.stop(); recRef.current = null; };

  return (
    <div className="flex items-end gap-2">
      {receiverId ? (
        <AttentionButton
          receiverId={receiverId}
          className="h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center hover:bg-accent"
          label={<BellRing size={18} />}
          title="Chamar atenção"
          onSuccess={() => {
            // sucesso silencioso
          }}
          onError={(msg) => {
            console.warn("Atenção não enviada:", msg);
          }}
        />
      ) : null}
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={onPicked}
      />
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escreva sua mensagem..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none rounded-xl border border-border/50 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60"
      />
      <button
        type="button"
        onClick={startRec}
        disabled={disabled || isRecording}
        aria-label={isRecording ? "Gravando" : "Gravar mensagem de voz"}
        className="h-11 w-11 shrink-0 rounded-xl border border-border/50 flex items-center justify-center hover:bg-accent transition-colors"
      >
        {isRecording ? <Square size={18} className="text-red-500" /> : <Mic size={18} />}
      </button>
      <button
        type="button"
        onClick={() => doSend()}
        disabled={disabled}
        aria-label="Enviar"
        className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <Send size={18} />
      </button>
    </div>
  );
}

