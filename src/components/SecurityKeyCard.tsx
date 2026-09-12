import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Eye, EyeOff, Copy, Download, Check } from "lucide-react";

interface SecurityKeyCardProps {
  profileId: string;
  registrationNumber: number;
}

/**
 * Card "Minha Chave de Segurança" — exibido no perfil do próprio usuário.
 * A chave é privada (RLS: apenas o dono lê via account_security_keys).
 */
export function SecurityKeyCard({ profileId, registrationNumber }: SecurityKeyCardProps) {
  const [key, setKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("account_security_keys")
          .select("security_key")
          .eq("user_id", profileId)
          .maybeSingle();
        if (active && !error && data?.security_key) {
          setKey(data.security_key);
        }
      } catch {
        /* silencioso */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profileId]);

  if (loading) return null;

  const copyKey = async () => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Chave copiada!", description: "Cole em um local seguro." });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar", description: "Use o botão de download." });
    }
  };

  const downloadKey = () => {
    if (!key) return;
    const content = [
      "════════════════════════════════════════",
      "  UNDOING · CHAVE DE SEGURANÇA",
      "════════════════════════════════════════",
      "",
      `Cadastro (selo): #${registrationNumber}`,
      "",
      `Chave de Segurança:`,
      `${key}`,
      "",
      "GUARDE ESTA CHAVE EM LOCAL SEGURO.",
      "Com ela você recupera sua conta caso",
      "esqueça a senha ou o email.",
      "════════════════════════════════════════",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "undoing-chave-de-seguranca.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!key) return null;

  return (
    <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold text-foreground">Minha Chave de Segurança</p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Com ela você recupera sua conta caso esqueça a senha ou o email.
      </p>
      <div className="rounded-lg bg-black/85 px-3 py-2 text-center">
        <code className="font-mono font-bold tracking-widest text-amber-300 text-xs break-all select-all">
          {revealed ? key : "•".repeat(Math.min(key.length, 16))}
        </code>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={() => setRevealed(!revealed)}>
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {revealed ? "Ocultar" : "Revelar"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={copyKey}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={downloadKey}>
          <Download className="h-3.5 w-3.5" />
          Salvar arquivo
        </Button>
      </div>
    </div>
  );
}
