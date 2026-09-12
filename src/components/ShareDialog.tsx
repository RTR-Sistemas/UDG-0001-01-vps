/**
 * =============================================================================
 * File: src/components/ShareDialog.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import * as React from "react";
import { Check, Copy, Facebook, Instagram, Loader2, MessageSquare, Send, Share2, Twitter, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  shareText: string;
  shareUrl: string;
  preview?: {
    avatarUrl?: string | null;
    username?: string | null;
    contentSnippet?: string | null;
  };
};

export function ShareDialog({
  open,
  onOpenChange,
  title,
  description,
  shareText,
  shareUrl,
  preview,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [sharing, setSharing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const getPayload = () => ({ title, text: shareText, url: shareUrl });

  const shareOnPlatform = async (platform: string) => {
    try {
      setSharing(true);
      const encodedText = encodeURIComponent(shareText);
      const encodedUrl = encodeURIComponent(shareUrl);

      let shareWindow: Window | null = null;

      switch (platform) {
        case "whatsapp":
          shareWindow = window.open(`https://wa.me/?text=${encodedText}%0A${encodedUrl}`, "_blank");
          break;
        case "facebook":
          shareWindow = window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
            "_blank",
            "width=600,height=400"
          );
          break;
        case "twitter":
          shareWindow = window.open(
            `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
            "_blank",
            "width=550,height=420"
          );
          break;
        case "telegram":
          shareWindow = window.open(
            `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
            "_blank",
            "width=550,height=420"
          );
          break;
        case "instagram":
          toast({
            title: "Instagram",
            description: "Para compartilhar no Instagram, abra o app e cole o link!",
          });
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          break;
        case "copy":
          await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
          setCopied(true);
          toast({
            title: "Link copiado!",
            description: "Conteúdo copiado para a área de transferência.",
          });
          setTimeout(() => setCopied(false), 2000);
          break;
      }

      if (shareWindow && platform !== "copy" && platform !== "instagram") {
        toast({
          title: "Compartilhando...",
          description: "Abrindo para compartilhar.",
        });
      }
    } catch (error) {
      console.error("Erro ao compartilhar:", error);
      toast({
        variant: "destructive",
        title: "Erro ao compartilhar",
        description: "Não foi possível compartilhar no momento.",
      });
    } finally {
      setSharing(false);
    }
  };

  const handleNativeShare = async () => {
    try {
      setSharing(true);
      const payload = getPayload();

      if (navigator.share && navigator.canShare?.(payload as any)) {
        await navigator.share(payload as any);
        toast({ title: "Compartilhado!", description: "Compartilhado com sucesso." });
      } else {
        await navigator.clipboard.writeText(`${payload.text}\n\n${payload.url}`);
        setCopied(true);
        toast({
          title: "Link copiado!",
          description: "Copiado. Cole em qualquer rede social!",
        });
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") console.error(error);
    } finally {
      setSharing(false);
    }
  };

  const shareOptions = [
    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "bg-green-500 hover:bg-green-600" },
    { id: "facebook", label: "Facebook", icon: Facebook, color: "bg-blue-600 hover:bg-blue-700" },
    { id: "twitter", label: "Twitter", icon: Twitter, color: "bg-sky-500 hover:bg-sky-600" },
    { id: "telegram", label: "Telegram", icon: Send, color: "bg-blue-500 hover:bg-blue-600" },
    { id: "instagram", label: "Instagram", icon: Instagram, color: "bg-pink-600 hover:bg-pink-700" },
    { id: "copy", label: copied ? "Copiado!" : "Copiar Link", icon: copied ? Check : Copy, color: "bg-gray-700 hover:bg-gray-800" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Fit comfortably on mobile (avoid being cut off)
          "bg-gray-900 border-gray-800 text-white p-0 overflow-hidden",
          "w-[calc(100vw-1.25rem)] sm:max-w-md",
          "max-h-[92vh]"
        )}
      >
        <div className="sticky top-0 z-10 bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
              <DialogDescription className="text-gray-400 text-sm">
                {description ?? "Compartilhe este conteúdo com seus amigos"}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(92vh - 78px)" }}>
          <div className="mb-6">
            <Button
              onClick={handleNativeShare}
              disabled={sharing}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-12 rounded-lg"
            >
              {sharing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
              {navigator.share ? "Compartilhar no Dispositivo" : "Copiar para Compartilhar"}
            </Button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              {navigator.share ? "Usa o sistema de compartilhamento do seu dispositivo" : "Copie o link e cole em qualquer rede social"}
            </p>
          </div>

          <Separator className="bg-gray-800 my-4" />

          <div className="mb-4">
            <h3 className="font-medium mb-3 text-gray-300">Compartilhar em redes sociais</h3>
            <div className="grid grid-cols-3 gap-3">
              {shareOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <TooltipProvider key={option.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => shareOnPlatform(option.id)}
                          disabled={sharing}
                          className={cn(
                            "h-14 flex flex-col gap-1 rounded-lg",
                            option.color,
                            option.id === "copy" && copied && "bg-green-600 hover:bg-green-700"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs font-medium">{option.label}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Compartilhar no {option.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>

          {preview && (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10 ring-1 ring-purple-500/30">
                  <AvatarImage src={preview.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-600 to-pink-600">
                    {(preview.username ?? "?").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="font-semibold truncate">@{preview.username ?? "usuario"}</div>
                  <div className="text-xs text-gray-400 truncate">{shareUrl}</div>
                </div>
              </div>
              {preview.contentSnippet && (
                <div className="text-sm text-gray-200 whitespace-pre-wrap">{preview.contentSnippet}</div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
