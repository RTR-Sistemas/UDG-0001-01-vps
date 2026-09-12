import { useState, useEffect, useRef, useCallback } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Lock,
  UserCheck,
  LogOut,
  Camera,
  Upload,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileImage,
  ScanFace,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAgeDetection, AgeDetectionResult } from "@/hooks/useAgeDetection";
import { supabase } from "@/integrations/supabase/client";

interface AgeVerificationModalProps {
  isOpen: boolean;
  userId: string;
  onSuccess: () => void;
}

type VerificationStep = "camera" | "document" | "result";
type VerificationStatus = "pending" | "scanning" | "approved" | "failed";

// Number of consecutive 18+ detections needed to confirm
const REQUIRED_CONFIRMATIONS = 5;
// Minimum confidence for a detection to count
const MIN_CONFIDENCE = 0.55;

export default function AgeVerificationModal({
  isOpen,
  userId,
  onSuccess,
}: AgeVerificationModalProps) {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { loadModels, detectAge, detectAgeFromImage, isModelLoaded, isLoading: modelsLoading } =
    useAgeDetection();

  const [step, setStep] = useState<VerificationStep>("camera");
  const [status, setStatus] = useState<VerificationStatus>("pending");
  const [detectedAge, setDetectedAge] = useState<number | null>(null);
  const [faceBox, setFaceBox] = useState<AgeDetectionResult["faceBox"]>(null);
  const [confirmCount, setConfirmCount] = useState(0);
  const [scanMessage, setScanMessage] = useState("Posicione seu rosto na câmera...");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load face-api models on mount
  useEffect(() => {
    if (isOpen && !isModelLoaded && !modelsLoading) {
      loadModels();
    }
  }, [isOpen, isModelLoaded, modelsLoading, loadModels]);

  // Start camera when models loaded and step is camera
  useEffect(() => {
    if (step === "camera" && isModelLoaded && status === "pending") {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, isModelLoaded, status]);

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          // Start scanning after video is playing
          startScanning();
        };
      }
    } catch (err: any) {
      console.error("Erro ao acessar câmera:", err);
      setScanMessage("Não foi possível acessar a câmera. Tente o envio de documento.");
      toast({
        title: "Câmera indisponível",
        description: "Permita o acesso à câmera ou use o envio de documento.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startScanning = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    setStatus("scanning");
    setConfirmCount(0);
    setScanMessage("Analisando seu rosto...");

    let consecutive18Plus = 0;
    let totalScans = 0;
    const MAX_SCANS = 120; // ~60 seconds at 500ms interval

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      totalScans++;

      const result = await detectAge(videoRef.current);

      if (!result) {
        setFaceBox(null);
        setScanMessage("Posicione seu rosto visível na câmera...");
        consecutive18Plus = 0;
        setConfirmCount(0);
        return;
      }

      setDetectedAge(result.age);
      setFaceBox(result.faceBox);

      if (result.confidence < MIN_CONFIDENCE) {
        setScanMessage("Aproxime-se um pouco mais da câmera...");
        return;
      }

      if (result.isAdult) {
        consecutive18Plus++;
        setConfirmCount(consecutive18Plus);
        setScanMessage(
          `Verificando... (${consecutive18Plus}/${REQUIRED_CONFIRMATIONS})`
        );

        if (consecutive18Plus >= REQUIRED_CONFIRMATIONS) {
          // Successfully verified!
          clearInterval(scanIntervalRef.current!);
          scanIntervalRef.current = null;
          await handleVerificationSuccess("face_detection", result.age);
        }
      } else {
        consecutive18Plus = 0;
        setConfirmCount(0);
        setScanMessage("Idade estimada abaixo de 18 anos. Continue posicionando o rosto...");
      }

      // Timeout — too many scans without success
      if (totalScans >= MAX_SCANS && consecutive18Plus < REQUIRED_CONFIRMATIONS) {
        clearInterval(scanIntervalRef.current!);
        scanIntervalRef.current = null;
        setStatus("failed");
        setScanMessage(
          "Não foi possível confirmar a maioridade via câmera. Tente enviar um documento."
        );
      }
    }, 500);
  };

  // Draw face detection overlay on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (faceBox && status === "scanning") {
      const isAdultDetected = detectedAge !== null && detectedAge >= 18;

      // Draw face rectangle
      ctx.strokeStyle = isAdultDetected ? "#22c55e" : "#ef4444";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(faceBox.x, faceBox.y, faceBox.width, faceBox.height);

      // Draw corners for premium look
      const cornerLen = 20;
      ctx.setLineDash([]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = isAdultDetected ? "#22c55e" : "#f97316";

      // Top-left
      ctx.beginPath();
      ctx.moveTo(faceBox.x, faceBox.y + cornerLen);
      ctx.lineTo(faceBox.x, faceBox.y);
      ctx.lineTo(faceBox.x + cornerLen, faceBox.y);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(faceBox.x + faceBox.width - cornerLen, faceBox.y);
      ctx.lineTo(faceBox.x + faceBox.width, faceBox.y);
      ctx.lineTo(faceBox.x + faceBox.width, faceBox.y + cornerLen);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(faceBox.x, faceBox.y + faceBox.height - cornerLen);
      ctx.lineTo(faceBox.x, faceBox.y + faceBox.height);
      ctx.lineTo(faceBox.x + cornerLen, faceBox.y + faceBox.height);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(faceBox.x + faceBox.width - cornerLen, faceBox.y + faceBox.height);
      ctx.lineTo(faceBox.x + faceBox.width, faceBox.y + faceBox.height);
      ctx.lineTo(faceBox.x + faceBox.width, faceBox.y + faceBox.height - cornerLen);
      ctx.stroke();

      // Age label
      if (detectedAge !== null) {
        const label = `~${detectedAge} anos`;
        ctx.font = "bold 16px Inter, sans-serif";
        const textWidth = ctx.measureText(label).width;
        const labelX = faceBox.x + (faceBox.width - textWidth) / 2;
        const labelY = faceBox.y - 10;

        ctx.fillStyle = isAdultDetected
          ? "rgba(34,197,94,0.85)"
          : "rgba(239,68,68,0.85)";
        ctx.beginPath();
        ctx.roundRect(labelX - 8, labelY - 18, textWidth + 16, 24, 6);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, labelX, labelY);
      }
    }
  }, [faceBox, detectedAge, status]);

  const handleVerificationSuccess = async (method: string, age: number) => {
    setStatus("approved");
    stopCamera();

    try {
      // Update profile in Supabase
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          is_adult_confirmed: true,
          adult_confirmed_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileErr) {
        console.error("Erro ao atualizar perfil:", profileErr);
      }

      // Log the verification
      await supabase.from("age_verification_log").insert({
        user_id: userId,
        session_id: `local_${method}_${Date.now()}`,
        status: "completed",
        provider: method,
        result: { age, method, verified: true },
      });

      toast({
        title: "✅ Idade Confirmada!",
        description: "Você foi verificado com sucesso como maior de 18 anos.",
      });

      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error("Erro ao salvar verificação:", err);
      // Still allow access even if DB save fails — the local check passed
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
  };

  // Handle document upload
  const handleDocumentUpload = async () => {
    if (!documentFile) return;

    setIsAnalyzingDoc(true);
    setScanMessage("Analisando documento...");

    try {
      const result = await detectAgeFromImage(documentFile);

      if (!result) {
        toast({
          title: "Nenhum rosto detectado",
          description:
            "Não encontramos um rosto no documento. Envie uma foto nítida do seu RG, CNH ou Passaporte.",
          variant: "destructive",
        });
        setIsAnalyzingDoc(false);
        return;
      }

      if (result.isAdult && result.confidence >= 0.4) {
        await handleVerificationSuccess("document_upload", result.age);
      } else {
        setStatus("failed");
        setScanMessage(
          `Idade estimada: ~${result.age} anos. Não foi possível confirmar maioridade.`
        );
        toast({
          title: "Verificação falhou",
          description: `A idade estimada pelo documento foi ~${result.age} anos. Acesso negado para menores de 18.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Erro ao analisar documento:", err);
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar o documento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingDoc(false);
    }
  };

  const resetVerification = () => {
    setStatus("pending");
    setDetectedAge(null);
    setFaceBox(null);
    setConfirmCount(0);
    setDocumentFile(null);
    setScanMessage("Posicione seu rosto na câmera...");
    setStep("camera");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 sm:p-6 overflow-hidden">
      <div className="relative w-full max-w-4xl h-[90vh] bg-card border border-border/40 shadow-2xl rounded-3xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-border/20 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-xl text-red-500 animate-pulse">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                Verificação de Maioridade 🔞
              </h2>
              <p className="text-xs text-muted-foreground">
                Garantindo um ambiente seguro e em conformidade legal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Lock className="h-4 w-4" />
              <span>Verificação Local</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 border-destructive/20 hover:bg-destructive/10 text-destructive gap-1.5"
              onClick={() => signOut()}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Deslogar</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Instructions Side */}
          <div className="w-full md:w-1/3 p-6 border-r border-border/20 flex flex-col justify-between bg-muted/10 overflow-y-auto">
            <div className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Por que isso é necessário?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para acessar o UndoinG Master, a lei exige que verifiquemos a
                  idade de nossos membros. Usamos reconhecimento facial com IA
                  para validar sua maioridade de forma rápida e segura.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Como funciona:
                </h3>
                <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-4">
                  <li>Permita o acesso à câmera do dispositivo.</li>
                  <li>Posicione seu rosto de frente para a câmera.</li>
                  <li>A IA analisará sua idade automaticamente.</li>
                  <li>Se aprovado, o acesso será liberado em instantes.</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 space-y-1">
                <span className="font-semibold">Privacidade Protegida:</span>
                <p className="text-[11px] leading-relaxed">
                  A análise é feita localmente no seu dispositivo. Nenhuma imagem
                  é enviada para nossos servidores. Apenas o resultado
                  (maior/menor de 18) é registrado.
                </p>
              </div>

              {/* Progress indicator */}
              {status === "scanning" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Confirmações</span>
                    <span className="font-bold text-primary">
                      {confirmCount}/{REQUIRED_CONFIRMATIONS}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${(confirmCount / REQUIRED_CONFIRMATIONS) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Switch to document upload */}
            {step === "camera" && status !== "approved" && (
              <div className="mt-6 pt-4 border-t border-border/20 space-y-2">
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">
                  Alternativa
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed border-primary/40 hover:bg-primary/5 text-xs gap-1.5"
                  onClick={() => {
                    stopCamera();
                    setStep("document");
                    setStatus("pending");
                  }}
                >
                  <FileImage className="h-3.5 w-3.5" />
                  Enviar Documento (RG/CNH)
                </Button>
              </div>
            )}

            {step === "document" && status !== "approved" && (
              <div className="mt-6 pt-4 border-t border-border/20 space-y-2">
                <span className="text-[10px] text-muted-foreground font-semibold block uppercase">
                  Alternativa
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed border-primary/40 hover:bg-primary/5 text-xs gap-1.5"
                  onClick={resetVerification}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Verificar pela Câmera
                </Button>
              </div>
            )}
          </div>

          {/* Main Verification Area */}
          <div className="flex-1 bg-black/40 flex flex-col items-center justify-center p-4 relative">
            {/* Loading Models */}
            {modelsLoading && (
              <div className="text-center space-y-3 animate-in fade-in duration-200">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm font-medium text-muted-foreground">
                  Carregando modelos de IA...
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Isso pode levar alguns segundos na primeira vez
                </p>
              </div>
            )}

            {/* Approved */}
            {status === "approved" && (
              <div className="text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="h-16 w-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-500/30 shadow-lg shadow-green-500/5">
                  <ShieldCheck className="h-10 w-10 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-green-500">
                    Acesso Permitido
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {detectedAge
                      ? `Idade estimada: ~${detectedAge} anos. Redirecionando...`
                      : "Sua idade foi confirmada. Redirecionando..."}
                  </p>
                </div>
              </div>
            )}

            {/* Failed */}
            {status === "failed" && (
              <div className="text-center space-y-4 max-w-md p-6 animate-in zoom-in-95 duration-200">
                <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
                  <XCircle className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-red-500">
                    Verificação Falhou
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {scanMessage}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                  <Button
                    onClick={resetVerification}
                    variant="outline"
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Tentar Câmera Novamente
                  </Button>
                  <Button
                    onClick={() => {
                      setStep("document");
                      setStatus("pending");
                      setFaceBox(null);
                      setDetectedAge(null);
                    }}
                    variant="outline"
                    className="gap-1.5"
                  >
                    <Upload className="h-4 w-4" />
                    Enviar Documento
                  </Button>
                  <Button
                    onClick={() => signOut()}
                    variant="destructive"
                    className="gap-1.5"
                  >
                    <LogOut className="h-4 w-4" />
                    Deslogar
                  </Button>
                </div>
              </div>
            )}

            {/* Camera View */}
            {step === "camera" &&
              !modelsLoading &&
              status !== "approved" &&
              status !== "failed" && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden border border-border/25 shadow-inner bg-zinc-900">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ transform: "scaleX(-1)" }}
                    />

                    {/* Scan overlay */}
                    {status === "scanning" && !faceBox && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 border-2 border-dashed border-primary/40 rounded-full animate-pulse flex items-center justify-center">
                          <ScanFace className="h-12 w-12 text-primary/30 animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status message */}
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground px-2">
                    {status === "scanning" ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                        {scanMessage}
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Iniciando câmera...
                      </>
                    )}
                  </div>
                </div>
              )}

            {/* Document Upload View */}
            {step === "document" &&
              !modelsLoading &&
              status !== "approved" &&
              status !== "failed" && (
                <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="text-center space-y-2">
                    <div className="h-14 w-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                      <FileImage className="h-7 w-7" />
                    </div>
                    <h3 className="text-lg font-bold">
                      Enviar Documento de Identidade
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Envie uma foto nítida do seu RG, CNH ou Passaporte com
                      foto visível
                    </p>
                  </div>

                  {/* Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      documentFile
                        ? "border-primary bg-primary/5"
                        : "border-border/40 hover:border-primary/40 hover:bg-muted/20"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setDocumentFile(file);
                        e.target.value = "";
                      }}
                    />

                    {documentFile ? (
                      <div className="space-y-3">
                        <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
                        <p className="text-sm font-medium text-foreground">
                          {documentFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(documentFile.size / 1024).toFixed(0)} KB — Clique
                          para trocar
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                          Clique para selecionar ou tirar foto
                        </p>
                        <p className="text-xs text-muted-foreground/60">
                          JPG, PNG ou HEIC • Máx 10MB
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Analyze button */}
                  <Button
                    className="w-full h-11 gap-2 text-sm font-semibold"
                    onClick={handleDocumentUpload}
                    disabled={!documentFile || isAnalyzingDoc}
                  >
                    {isAnalyzingDoc ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analisando documento...
                      </>
                    ) : (
                      <>
                        <ScanFace className="h-4 w-4" />
                        Analisar Documento
                      </>
                    )}
                  </Button>

                  <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      A foto deve conter um rosto visível. Documentos sem foto
                      ou fotos borradas serão rejeitados.
                    </span>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
