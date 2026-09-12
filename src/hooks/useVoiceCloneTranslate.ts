import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { callBackend } from "@/lib/backendApi";

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

export interface VoiceCloneTranslateResult {
  success: boolean;
  originalText?: string;
  detectedLanguage?: string;
  detectedLanguageInfo?: LanguageInfo;
  translatedText?: string;
  targetLang?: string;
  targetLanguageInfo?: LanguageInfo;
  audio?: string;
  method?: string;
  voice?: string;
  sameLanguage?: boolean;
  elapsedMs?: number;
  message?: string;
  error?: string;
}

export function useVoiceCloneTranslate() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const translateAudio = async (
    audioBlob: Blob,
    targetLang: string,
    originalText?: string,
    options?: { sourceLang?: string; gender?: "female" | "male"; tryClone?: boolean }
  ): Promise<VoiceCloneTranslateResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const base64Audio = await base64Promise;

      const result = await callBackend<VoiceCloneTranslateResult>(
        "voice-clone-translate",
        {
          audio: base64Audio,
          targetLang,
          originalText,
          sourceLang: options?.sourceLang,
          gender: options?.gender || "female",
          tryClone: options?.tryClone !== false,
        },
        { timeoutMs: 90000 }
      );

      if (!result?.success) {
        const message = result?.message || result?.error || "Não foi possível dublar o áudio.";
        setError(message);
        toast({
          title: message.includes("VOICE_SAMPLE_REQUIRED") ? "Amostra de voz necessária" : "Erro na dublagem",
          description: message,
          variant: message.includes("VOICE_SAMPLE_REQUIRED") ? undefined : "destructive",
        });
        return { success: false, error: result?.error, message };
      }

      return result;
    } catch (err: any) {
      const errMsg = err?.message || "Erro desconhecido ao processar áudio";
      setError(errMsg);
      toast({
        title: errMsg.includes("VOICE_SAMPLE_REQUIRED") ? "Amostra de voz necessária" : "Erro na dublagem",
        description: errMsg,
        variant: errMsg.includes("VOICE_SAMPLE_REQUIRED") ? undefined : "destructive",
      });
      return { success: false, error: errMsg, message: errMsg };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    translateAudio,
    isProcessing,
    error,
    clearError: () => setError(null),
  };
}