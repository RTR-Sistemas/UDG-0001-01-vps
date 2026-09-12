/**
 * =============================================================================
 * File: src/components/AudioRecorder.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionContext";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface AudioRecorderProps {
  onAudioReady: (audioBlob: Blob) => void;
  maxDuration?: number; // in seconds
}

export default function AudioRecorder({ onAudioReady, maxDuration = 60 }: AudioRecorderProps) {
  const { requestPermission } = usePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    const micGranted = await requestPermission(
      'microphone',
      'Para gravar sua mensagem de voz, o app precisa acessar o microfone.'
    );
    if (!micGranted) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return newDuration;
        });
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onAudioReady(audioBlob);
      reset();
    }
  };

  const reset = () => {
    setAudioBlob(null);
    setDuration(0);
    chunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Mic className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Áudio gravado</p>
              <p className="text-xs text-muted-foreground">{formatTime(duration)}</p>
            </div>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={reset}
          className="h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={handleSend}
          className="bg-gradient-to-r from-primary to-secondary"
        >
          Enviar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <>
          <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium text-destructive">
              Gravando... {formatTime(duration)} / {formatTime(maxDuration)}
            </span>
          </div>
          <Button
            size="icon"
            onClick={stopRecording}
            className="bg-destructive hover:bg-destructive/90"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        </>
      ) : (
        <Button
          size="icon"
          onClick={startRecording}
          variant="outline"
          className="hover:bg-primary hover:text-primary-foreground"
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
