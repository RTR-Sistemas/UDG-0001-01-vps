/**
 * =============================================================================
 * File: src/components/MyCode.tsx
 * Purpose: Part of the client/server application codebase.
 *
 * Notes:
 *  - This file was documented automatically on 2026-01-25.
 *  - Comments are meant to improve maintainability without changing behavior.
 * =============================================================================
 */

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// -----------------------------------------------------------------------------
// SECTION: Local helpers / types
// -----------------------------------------------------------------------------


interface MyCodeProps {
  userCode?: string;
}

export default function MyCode({ userCode }: MyCodeProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyCode = () => {
    if (userCode) {
      navigator.clipboard.writeText(userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Código copiado!",
        description: "Compartilhe com seus amigos",
      });
    }
  };

  if (!userCode) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-muted-foreground">Carregando seu código...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full p-6 mx-auto w-fit mb-4">
          <QrCode className="h-12 w-12 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Seu Código UDG</h3>
        <p className="text-sm text-muted-foreground">
          Compartilhe este código com seus amigos para que eles possam adicionar você
        </p>
      </div>

      <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <span className="text-4xl font-bold font-mono text-primary tracking-wider">
              {userCode}
            </span>
          </div>
          
          <Button 
            onClick={copyCode} 
            className="w-full bg-gradient-to-r from-primary to-secondary"
            size="lg"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5 mr-2" />
                Código Copiado!
              </>
            ) : (
              <>
                <Copy className="h-5 w-5 mr-2" />
                Copiar Código
              </>
            )}
          </Button>
        </div>
      </Card>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Como funciona:</p>
        <ol className="list-decimal list-inside space-y-1 pl-2">
          <li>Copie seu código usando o botão acima</li>
          <li>Compartilhe com seus amigos</li>
          <li>Eles devem inserir seu código na aba "Adicionar"</li>
          <li>Você receberá uma solicitação na aba "Pedidos"</li>
          <li>Aceite a solicitação para se tornarem amigos</li>
        </ol>
      </div>
    </div>
  );
}
