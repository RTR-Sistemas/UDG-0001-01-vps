import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Video, X, RotateCcw, Send, FlipHorizontal, SkipBack, Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionContext";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}



export function CameraCaptureModal({ isOpen, onClose, onCapture }: CameraCaptureModalProps) {
  const { toast } = useToast();
  const { requestPermission } = usePermissions();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"photo" | "video" | null>(null);

  const initCamera = useCallback(async () => {
    const cameraGranted = await requestPermission(
      'camera',
      'Para tirar fotos e gravar vídeos que você envia no chat e nas publicações, o app precisa acessar a câmera e o microfone.'
    );
    if (!cameraGranted) {
      onClose();
      return;
    }
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      toast({ title: "Erro de Câmera", description: "Não foi possível acessar a câmera ou microfone.", variant: "destructive" });
      onClose();
    }
  }, [facingMode, onClose, toast, requestPermission]);

  useEffect(() => {
    if (isOpen && !previewFile) {
      initCamera();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isOpen, previewFile, initCamera]);

  // Frame processing loop
  const drawFrame = useCallback(() => {
    // CRITICAL: Schedule the next frame IMMEDIATELY unconditionally to prevent loop freezing.
    requestRef.current = requestAnimationFrame(drawFrame);

    if (!videoRef.current || !canvasRef.current) return;
    
    const { videoWidth, videoHeight } = videoRef.current;
    if (videoWidth === 0 || videoHeight === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== videoWidth) canvas.width = videoWidth;
    if (canvas.height !== videoHeight) canvas.height = videoHeight;

    ctx.save();
    
    // Espelhar vídeo apenas se for câmera frontal (user)
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, [facingMode]);

  useEffect(() => {
    if (isOpen && !previewFile) {
      requestRef.current = requestAnimationFrame(drawFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isOpen, previewFile, drawFrame]);

  // Recording Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const takePhoto = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewType("photo");
    }, "image/jpeg", 0.9);
  };

  const startRecording = () => {
    if (!canvasRef.current || !mediaStreamRef.current) return;
    try {
      // Create a stream from canvas at 30fps
      const canvasStream = canvasRef.current.captureStream(30);
      
      // Add microphone audio tracks from the original media stream
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => canvasStream.addTrack(track));

      const mediaRecorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `video_${Date.now()}.webm`, { type: "video/webm" });
        setPreviewFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setPreviewType("video");
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      toast({ title: "Erro", description: "Navegador não suporta a gravação requisitada.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRetake = () => {
    setPreviewFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewType(null);
    initCamera(); // Resume camera
  };

  const handleSend = () => {
    if (previewFile) {
      onCapture(previewFile);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200" style={{ touchAction: "none" }}>
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full h-10 w-10">
          <X className="h-6 w-6" />
        </Button>
        
        {!previewFile && (
          <Button variant="ghost" size="icon" onClick={toggleCamera} className="text-white hover:bg-white/20 rounded-full h-10 w-10">
            <FlipHorizontal className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Recording Timer Indicator */}
      {isRecording && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white font-mono font-medium text-sm">
            00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime} / 00:60
          </span>
        </div>
      )}

      {/* Main View Area */}
      <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center pt-16 pb-32">
        {previewFile && previewUrl ? (
          previewType === "photo" ? (
             <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
          ) : (
             <video src={previewUrl} controls autoPlay loop className="max-w-full max-h-full object-contain" />
          )
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
          </>
        )}
      </div>

      {/* Footer Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-6 px-4">
        
        {previewFile ? (
          <div className="flex justify-center gap-6 w-full max-w-sm mx-auto">
             <Button variant="secondary" size="lg" className="flex-1 rounded-full h-14" onClick={handleRetake}>
               <RotateCcw className="h-5 w-5 mr-2" />
               Refazer
             </Button>
             <Button size="lg" className="flex-1 rounded-full h-14 bg-primary hover:bg-primary/90 text-white" onClick={handleSend}>
               <Send className="h-5 w-5 mr-2" />
               Enviar
             </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-end h-full gap-6 w-full max-w-lg mx-auto">
            {/* Shutter Button */}
            <div className="flex justify-center items-center h-20 mb-4">
               {isRecording ? (
                 <button 
                   onClick={stopRecording}
                   className="w-16 h-16 rounded-full border-4 border-red-500 bg-red-500/20 flex items-center justify-center animate-pulse"
                 >
                   <Square className="h-6 w-6 text-red-500 fill-red-500" />
                 </button>
               ) : (
                 <div className="flex items-center gap-8">
                   <button 
                     onClick={takePhoto}
                     className="flex flex-col items-center gap-1 group"
                   >
                     <div className="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105 active:scale-95">
                       <div className="w-12 h-12 rounded-full bg-white opacity-90"></div>
                     </div>
                     <span className="text-white/80 text-[10px] uppercase font-bold tracking-wider">Foto</span>
                   </button>

                   <button 
                     onClick={startRecording}
                     className="flex flex-col items-center gap-1 group"
                   >
                     <div className="w-14 h-14 rounded-full border-4 border-red-500 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105 active:scale-95">
                       <div className="w-12 h-12 rounded-full bg-red-500 opacity-90"></div>
                     </div>
                     <span className="text-white/80 text-[10px] uppercase font-bold tracking-wider">Vídeo</span>
                   </button>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
