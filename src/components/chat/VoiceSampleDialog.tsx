import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, CheckCircle2, UploadCloud, Volume2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { uploadToCloudinary, blobToFile } from "@/integrations/cloudinary/upload";

interface VoiceSampleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  recentOwnAudioUrl: string | null;
  hasRegisteredSample: boolean;
  onReady: (url: string) => void;
}

export function VoiceSampleDialog({
  open,
  onOpenChange,
  currentUserId,
  recentOwnAudioUrl,
  hasRegisteredSample,
  onReady,
}: VoiceSampleDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Duração real da amostra gravada — o XTTS rejeita referências curtas. */
  const [sampleSeconds, setSampleSeconds] = useState(0);

  /** Mínimo aceitável para servir de referência de voz. */
  const MIN_SAMPLE_SECONDS = 3;

  const secondsRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const cleanupRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setSeconds(0);
    secondsRef.current = 0;
  }, []);

  // Reseta o formulário ao abrir o diálogo
  useEffect(() => {
    if (open) {
      setBlob(null);
      setPreviewUrl(null);
      setError(null);
      setSeconds(0);
      setSampleSeconds(0);
      secondsRef.current = 0;
    } else {
      cleanupRecording();
    }
  }, [open, cleanupRecording]);

  // Limpa o preview ao fechar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = async () => {
    setError(null);
    setBlob(null);
    setPreviewUrl(null);
    setSampleSeconds(0);
    secondsRef.current = 0;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const nextBlob = new Blob(chunksRef.current, { type: mimeType });
        // Guarda a duração ANTES do reset do cronômetro: é ela que diz se a
        // amostra serve de referência para a clonagem.
        setSampleSeconds(secondsRef.current);
        if (nextBlob.size > 0) {
          setBlob(nextBlob);
          setPreviewUrl(URL.createObjectURL(nextBlob));
        }
      };

      recorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          const next = prev >= 19 ? prev : prev + 1;
          secondsRef.current = next;
          if (prev >= 19) stopRecording();
          return next;
        });
      }, 1000);
    } catch (e) {
      console.error('[VoiceSampleDialog] Falha ao acessar o microfone:', e);
      setError('Não foi possível acessar o microfone. Verifique a permissão no seu navegador.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
    setSeconds(0);
  };

  const uploadSample = async () => {
    if (!blob) return;
    // Amostra curta demais faz o XTTS recusar a clonagem e o usuário fica sem
    // entender por que "a voz dele" nunca aparece. Melhor avisar aqui.
    if (sampleSeconds > 0 && sampleSeconds < MIN_SAMPLE_SECONDS) {
      setError(`A amostra ficou com ${sampleSeconds}s. Grave pelo menos ${MIN_SAMPLE_SECONDS} segundos para a clonagem funcionar.`);
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const file = blobToFile(blob, 'voice-sample.webm', blob.type);
      const { url } = await uploadToCloudinary(file, {
        kind: 'messages',
        userId: currentUserId,
        folder: `voice-samples/${currentUserId}`,
      });
      if (!url) throw new Error('Upload retornou vazio');
      onReady(url);
      toast({
        title: hasRegisteredSample ? 'Voz atualizada' : 'Voz registrada',
        description: 'Sua amostra de voz foi salva para a dublagem de áudios.',
      });
    } catch (e: any) {
      console.error('[VoiceSampleDialog] Erro no upload:', e);
      setError('Falha ao enviar a amostra. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const useRecentAudio = () => {
    if (!recentOwnAudioUrl) return;
    onReady(recentOwnAudioUrl);
    toast({
      title: hasRegisteredSample ? 'Voz atualizada' : 'Voz registrada',
      description: 'Usando seu último áudio enviado como amostra de voz.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-xl border-border/50 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            {hasRegisteredSample ? 'Sua voz registrada' : 'Registre a sua voz'}
          </DialogTitle>
          <DialogDescription>
            Sua voz é usada para <span className="font-semibold text-foreground">dublar os áudios do chat</span> com
            a sua própria voz. Grave pelo menos {MIN_SAMPLE_SECONDS} segundos falando de forma clara, sem ruído de
            fundo. Se a clonagem não responder em 3 segundos, a dublagem sai com uma voz neural natural — você
            nunca fica sem áudio. A amostra fica armazenada com segurança e é usada somente para isso.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {isRecording ? (
            <div className="w-full flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary animate-pulse">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-sm font-semibold">Gravando... {seconds}s</span>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-full gap-2"
                onClick={stopRecording}
              >
                <Square className="h-4 w-4" /> Parar
              </Button>
            </div>
          ) : blob && previewUrl ? (
            <div className="w-full flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4" /> Amostra gravada{sampleSeconds > 0 ? ` (${sampleSeconds}s)` : ''}
              </div>
              <audio controls src={previewUrl} className="w-full h-10" />
              {sampleSeconds > 0 && sampleSeconds < MIN_SAMPLE_SECONDS && (
                <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 text-xs bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 w-full">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Muito curta para clonar a voz. Regrave com pelo menos {MIN_SAMPLE_SECONDS} segundos.</span>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/5 border border-destructive/15 rounded-xl px-3 py-2 w-full">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex items-center gap-2 w-full">
                <Button type="button" variant="outline" size="sm" className="rounded-full flex-1" onClick={() => { setBlob(null); setPreviewUrl(null); setSampleSeconds(0); setError(null); }}>
                  Regravar
                </Button>
                <Button type="button" size="sm" className="rounded-full flex-1 gap-1.5" onClick={uploadSample} disabled={isUploading || (sampleSeconds > 0 && sampleSeconds < MIN_SAMPLE_SECONDS)}>
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  Usar amostra
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-muted/30 p-5">
              <div className="text-muted-foreground text-center text-xs max-w-[280px]">
                <Volume2 className="h-6 w-6 text-primary mx-auto mb-2" />
                Toque no microfone e leia (ou fale) normalmente por alguns segundos.
              </div>
              {error && (
                <div className="flex items-start gap-2 text-destructive text-xs bg-destructive/5 border border-destructive/15 rounded-xl px-3 py-2 w-full">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full border-primary/50 text-primary hover:bg-primary/10"
                onClick={startRecording}
              >
                <Mic className="h-6 w-6" />
              </Button>
            </div>
          )}

          {!isRecording && !blob && recentOwnAudioUrl && (
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-xs gap-1.5" onClick={useRecentAudio}>
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              Usar meu último áudio enviado
            </Button>
          )}

          {hasRegisteredSample && !isRecording && !blob && (
            <p className="text-[10px] text-muted-foreground text-center">
              Você já tem uma voz registrada. Registrar novamente substitui a amostra anterior.
            </p>
          )}
        </div>

        <div className={cn("flex justify-end gap-2")}>
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}