import { useState } from "react";
import { Check, Info, Loader2, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  PERMISSION_META,
  isIosPwaInstalled,
  requestNativePermission,
  type PermissionType,
} from "@/lib/permissions";

interface PermissionRequestModalProps {
  type: PermissionType;
  contextMessage: string;
  onDone: (granted: boolean) => void;
}

export function PermissionRequestModal({ type, contextMessage, onDone }: PermissionRequestModalProps) {
  const meta = PERMISSION_META[type];
  const Icon = meta.icon;

  const [phase, setPhase] = useState<"idle" | "requesting" | "denied">("idle");
  const isIosNotInstalled = type === "notifications" && !isIosPwaInstalled();

  const handleAccept = async () => {
    if (isIosNotInstalled) {
      onDone(false);
      return;
    }
    setPhase("requesting");
    const granted = await requestNativePermission(type);
    if (granted) {
      onDone(true);
    } else {
      setPhase("denied");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onDone(false)} />
      <Card className="relative w-full max-w-md shadow-2xl border-primary/20 bg-card animate-in fade-in zoom-in-95 duration-200">
        <CardContent className="p-6 space-y-5">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => onDone(false)}
          >
            <X className="h-4 w-4" />
          </button>

          {phase === "denied" ? (
            <>
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Info className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-semibold text-lg leading-snug">
                    {meta.shortTitle} bloqueada no navegador
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{meta.deniedHint}</p>
                </div>
              </div>
              <Button type="button" className="w-full" onClick={() => onDone(false)}>
                Entendi
              </Button>
            </>
          ) : isIosNotInstalled ? (
            <>
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-semibold text-lg leading-snug">Instale o app para receber notificações</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    No iPhone/iPad, as notificações só funcionam com o app instalado na Tela de
                    Início. Toque em <b>Compartilhar</b> e depois em{" "}
                    <b>Adicionar à Tela de Início</b>.
                  </p>
                </div>
              </div>
              <Button type="button" className="w-full" onClick={() => onDone(false)}>
                Entendi
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-semibold text-lg leading-snug">{meta.title}</h2>
                  {contextMessage ? (
                    <p className="text-sm text-foreground/90 leading-relaxed">{contextMessage}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground leading-relaxed">{meta.description}</p>
                </div>
              </div>

              <ul className="space-y-2 rounded-xl border border-border/60 bg-muted/40 p-3.5">
                {meta.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDone(false)}
                  disabled={phase === "requesting"}
                >
                  Agora não
                </Button>
                <Button type="button" onClick={handleAccept} disabled={phase === "requesting"}>
                  {phase === "requesting" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Solicitando...
                    </>
                  ) : (
                    "Permitir"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
