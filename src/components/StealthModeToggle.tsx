/**
 * =============================================================================
 * File: src/components/StealthModeToggle.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState } from "react";
import { Shield, ShieldOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useStealthMode } from "@/hooks/useStealthMode";
import { useToast } from "@/hooks/use-toast";
import { detectCurrentPlatform } from "@/utils/stealthDetector";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


export function StealthModeToggle() {
  const { config, enableStealthMode, disableStealthMode, toggleHidden } = useStealthMode();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [enterPin, setEnterPin] = useState("");

  const platform = detectCurrentPlatform();

  const getRevealInstructions = () => {
    switch (platform) {
      case "android":
        return "📱 Android: Abra o Discador e digite o PIN de 6 números";
      case "ios":
        return "📱 iPhone: Abra o app de Mensagens e envie o PIN de 6 números para si mesmo";
      case "windows":
        return "💻 Windows: Abra a Calculadora e digite o PIN de 6 números";
      case "mac":
        return "💻 Mac: Abra a Calculadora e digite o PIN de 6 números";
      case "linux":
        return "🐧 Linux: Abra a Calculadora e digite o PIN de 6 números";
      default:
        return "💻 Desktop: Abra a Calculadora e digite o PIN de 6 números";
    }
  };

  const handleEnableStealthMode = () => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      toast({
        title: "PIN inválido",
        description: "O PIN deve ter exatamente 6 números",
        variant: "destructive",
      });
      return;
    }

    if (pin !== confirmPin) {
      toast({
        title: "PINs não coincidem",
        description: "Digite o mesmo PIN nos dois campos",
        variant: "destructive",
      });
      return;
    }

    enableStealthMode(pin);
    setPin("");
    setConfirmPin("");
    setOpen(false);
    
    toast({
      title: "Modo Stealth ativado",
      description: "Você pode agora ocultar o aplicativo",
    });
  };

  const handleDisableStealthMode = () => {
    disableStealthMode();
    setOpen(false);
    
    toast({
      title: "Modo Stealth desativado",
      description: "O aplicativo não pode mais ser ocultado",
    });
  };

  const handleToggleHidden = () => {
    if (!config.enabled) {
      toast({
        title: "Modo Stealth não ativado",
        description: "Ative o Modo Stealth primeiro",
        variant: "destructive",
      });
      return;
    }

    if (config.isHidden) {
      // Revealing - need PIN
      if (enterPin.length !== 6) {
        toast({
          title: "Digite o PIN",
          description: "Digite o PIN de 6 números para revelar",
          variant: "destructive",
        });
        return;
      }

      if (toggleHidden(enterPin)) {
        setEnterPin("");
        toast({
          title: "App revelado",
          description: "O aplicativo está visível novamente",
        });
      } else {
        toast({
          title: "PIN incorreto",
          description: "Digite o PIN correto",
          variant: "destructive",
        });
      }
    } else {
      // Hiding - need PIN
      if (enterPin.length !== 6) {
        toast({
          title: "Digite o PIN",
          description: "Digite o PIN de 6 números para ocultar",
          variant: "destructive",
        });
        return;
      }

      if (toggleHidden(enterPin)) {
        setEnterPin("");
        toast({
          title: "App ocultado",
          description: getRevealInstructions(),
          duration: 5000,
        });
      } else {
        toast({
          title: "PIN incorreto",
          description: "Digite o PIN correto",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          title="Modo Stealth"
        >
          {config.enabled ? (
            <Shield className="h-5 w-5 text-primary" />
          ) : (
            <ShieldOff className="h-5 w-5" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modo Stealth</DialogTitle>
          <DialogDescription>
            Oculte o aplicativo e revele-o com um código secreto
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!config.enabled ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="pin">PIN de 6 números</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirme o PIN</Label>
                <Input
                  id="confirmPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Como revelar o app:</p>
                <p className="text-sm text-muted-foreground">
                  {getRevealInstructions()}
                </p>
              </div>

              <Button onClick={handleEnableStealthMode} className="w-full">
                <Lock className="mr-2 h-4 w-4" />
                Ativar Modo Stealth
              </Button>
            </>
          ) : (
            <>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Status do App</Label>
                  <span className={config.isHidden ? "text-destructive" : "text-green-500"}>
                    {config.isHidden ? "🔒 Oculto" : "🔓 Visível"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enterPin">Digite o PIN para {config.isHidden ? "revelar" : "ocultar"}</Label>
                <Input
                  id="enterPin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={enterPin}
                  onChange={(e) => setEnterPin(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              <Button
                onClick={handleToggleHidden}
                variant={config.isHidden ? "default" : "destructive"}
                className="w-full"
              >
                {config.isHidden ? "🔓 Revelar App" : "🔒 Ocultar App"}
              </Button>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Lembrete:</p>
                <p className="text-sm text-muted-foreground">
                  {getRevealInstructions()}
                </p>
              </div>

              <Button
                onClick={handleDisableStealthMode}
                variant="outline"
                className="w-full"
              >
                Desativar Modo Stealth
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
