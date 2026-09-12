/**
 * =============================================================================
 * File: src/components/security/PqSecurityCard.tsx
 * Purpose: Painel de criptografia pós-quântica visível ao usuário.
 *
 * Mostra o que está protegendo a conta e, principalmente, o CÓDIGO DE
 * SEGURANÇA (fingerprint) da identidade deste dispositivo. Esse código é a
 * única defesa real contra um servidor malicioso trocando chaves: duas pessoas
 * comparam os códigos por um canal fora do aplicativo (ao vivo, por telefone) e,
 * se baterem, ninguém está no meio.
 * =============================================================================
 */

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePqIdentity } from "@/hooks/usePqIdentity";
import { PQ_SUITE, clearUserPqData, fetchPeerBundle, fingerprint as fingerprintOf } from "@/lib/pq";
import { useAuth } from "@/hooks/useAuth";

interface PqSecurityCardProps {
  /** Quando informado, mostra também o código do outro lado da conversa. */
  peerId?: string | null;
  /** Nome do peer, só para o texto. */
  peerName?: string | null;
  className?: string;
}

export function PqSecurityCard({ peerId, peerName, className }: PqSecurityCardProps) {
  const { fingerprint, ready, publishing, error } = usePqIdentity();
  const { user } = useAuth();
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [peerPrint, setPeerPrint] = useState<string | null>(null);
  const [peerLoading, setPeerLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!peerId) {
      setPeerPrint(null);
      return;
    }
    let active = true;
    setPeerLoading(true);
    fetchPeerBundle(peerId)
      .then((bundle) => {
        if (!active) return;
        setPeerPrint(bundle ? fingerprintOf(bundle.sigPublicKey) : null);
      })
      .catch(() => {
        if (active) setPeerPrint(null);
      })
      .finally(() => {
        if (active) setPeerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [peerId]);

  const copyFingerprint = async () => {
    if (!fingerprint) return;
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Código copiado", description: "Compare com a outra pessoa fora do aplicativo." });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar" });
    }
  };

  const statusIcon = error ? (
    <ShieldAlert className="h-5 w-5 text-amber-500" />
  ) : ready ? (
    <ShieldCheck className="h-5 w-5 text-emerald-500" />
  ) : (
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  );

  const statusText = error
    ? "Chaves ainda não publicadas — as mensagens seguem sem proteção pós-quântica."
    : publishing
      ? "Publicando suas chaves públicas…"
      : ready
        ? "Ativa. Mensagens deste dispositivo saem cifradas ponta a ponta."
        : "Preparando as chaves deste dispositivo…";

  return (
    <div className={`rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2">
        {statusIcon}
        <div>
          <p className="text-sm font-bold text-foreground">Criptografia pós-quântica</p>
          <p className="text-[11px] text-muted-foreground leading-snug">{statusText}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-1 text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Suíte</dt>
          <dd className="font-mono text-foreground/80 text-right break-all">{PQ_SUITE}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Padrões</dt>
          <dd className="text-foreground/80 text-right">FIPS 203 · FIPS 204 · SP 800-38D</dd>
        </div>
      </dl>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] font-semibold text-foreground">Seu código de segurança</p>
        </div>
        <div className="rounded-lg bg-black/85 px-3 py-2">
          <code className="font-mono text-[11px] tracking-wide text-amber-300 break-all select-all">
            {fingerprint ?? "—"}
          </code>
        </div>
      </div>

      {peerId && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-foreground">
            Código de {peerName || "quem está do outro lado"}
          </p>
          <div className="rounded-lg bg-black/85 px-3 py-2">
            <code className="font-mono text-[11px] tracking-wide text-sky-300 break-all select-all">
              {peerLoading ? "carregando…" : peerPrint ?? "esta pessoa ainda não ativou a criptografia"}
            </code>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug">
        Compare os códigos com a outra pessoa por um canal diferente do aplicativo. Se forem
        iguais, ninguém consegue se colocar no meio da conversa — nem hoje, nem com um
        computador quântico no futuro.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" onClick={copyFingerprint} disabled={!fingerprint}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar meu código
        </Button>

        {/* Ação destrutiva: sair da conta não apaga mais as chaves, então
            quem quiser limpar de verdade precisa pedir aqui, de propósito. */}
        {user?.id && (
          <Button
            size="sm"
            variant={confirmandoApagar ? "destructive" : "outline"}
            className="h-7 text-[11px] gap-1.5"
            onClick={() => {
              if (!confirmandoApagar) {
                setConfirmandoApagar(true);
                setTimeout(() => setConfirmandoApagar(false), 6000);
                return;
              }
              clearUserPqData(user.id);
              toast({
                title: "Chaves apagadas",
                description: "Recarregue a página para gerar chaves novas neste aparelho.",
              });
              setConfirmandoApagar(false);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmandoApagar ? "Confirmar: apagar tudo" : "Esquecer chaves deste aparelho"}
          </Button>
        )}
      </div>

      {confirmandoApagar && (
        <p className="text-[11px] text-destructive leading-snug">
          Isto destrói a chave privada guardada aqui. As conversas cifradas
          anteriores deixam de ser legíveis neste aparelho, para sempre.
        </p>
      )}
    </div>
  );
}

export default PqSecurityCard;
