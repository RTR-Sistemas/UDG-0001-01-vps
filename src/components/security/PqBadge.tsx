/**
 * =============================================================================
 * File: src/components/security/PqBadge.tsx
 * Purpose: Selo compacto "Pós-quântica" para o cabeçalho das conversas.
 *
 * O selo tem duas funções. A primeira é informar: a pessoa precisa saber que
 * aquela conversa está protegida, e por quê. A segunda é ser honesto — quando
 * a criptografia NÃO está ativa (o outro lado ainda não abriu o aplicativo
 * atualizado, por exemplo), o selo muda de cor e diz isso, em vez de fingir
 * que está tudo cifrado. Um cadeado que mente é pior do que cadeado nenhum.
 * =============================================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Atom, Check, Copy, ExternalLink, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePqIdentity } from "@/hooks/usePqIdentity";
import { fetchPeerBundle, fingerprint as fingerprintOf } from "@/lib/pq";

interface PqBadgeProps {
  /** Em conversa 1:1: o outro participante. */
  peerId?: string | null;
  /** Em grupo: todos os membros (inclusive quem está vendo). */
  memberIds?: string[];
  peerName?: string | null;
  className?: string;
}

type PeerState = "carregando" | "protegido" | "parcial" | "sem-pq";

export function PqBadge({ peerId, memberIds, peerName, className }: PqBadgeProps) {
  const navigate = useNavigate();
  const { fingerprint, ready } = usePqIdentity();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [peerState, setPeerState] = useState<PeerState>("carregando");
  const [peerPrint, setPeerPrint] = useState<string | null>(null);
  const [semChave, setSemChave] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  // `memberIds === undefined` num grupo significa "a lista ainda está
  // carregando" — diferente de "grupo sem ninguém". Sem essa distinção o selo
  // piscaria "Sem PQ" por um instante em toda abertura de grupo, e um aviso de
  // segurança que aparece e some sozinho ensina o usuário a ignorá-lo.
  const carregandoMembros = !peerId && memberIds === undefined;
  const alvos = peerId ? [peerId] : (memberIds ?? []);
  const chaveDosAlvos = alvos.slice().sort().join(",");

  useEffect(() => {
    if (carregandoMembros) {
      setPeerState("carregando");
      return;
    }
    if (alvos.length === 0) {
      setPeerState("sem-pq");
      return;
    }
    let ativo = true;
    setPeerState("carregando");

    Promise.all(alvos.map((id) => fetchPeerBundle(id)))
      .then((bundles) => {
        if (!ativo) return;
        const faltando = bundles.filter((b) => !b).length;
        setSemChave(faltando);
        if (faltando === 0) setPeerState("protegido");
        else if (faltando === bundles.length) setPeerState("sem-pq");
        else setPeerState("parcial");

        setPeerPrint(peerId && bundles[0] ? fingerprintOf(bundles[0].sigPublicKey) : null);
      })
      .catch(() => {
        if (ativo) setPeerState("sem-pq");
      });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDosAlvos, peerId, carregandoMembros]);

  const protegido = ready && peerState === "protegido";
  const indefinido = peerState === "carregando";

  const copiar = async (valor: string | null) => {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar" });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          protegido
            ? "Conversa protegida por criptografia pós-quântica. Toque para saber mais."
            : "Criptografia pós-quântica indisponível nesta conversa. Toque para entender."
        }
        title={
          protegido
            ? "Protegida de ponta a ponta com criptografia pós-quântica (ML-KEM-768 + ML-DSA-65)"
            : "Esta conversa ainda não está com criptografia pós-quântica"
        }
        className={`h-7 px-2 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all border ${
          indefinido
            ? "bg-muted/50 border-border text-muted-foreground"
            : protegido
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
        } ${className ?? ""}`}
      >
        {indefinido ? (
          <Shield className="h-3 w-3" />
        ) : protegido ? (
          <ShieldCheck className="h-3 w-3" />
        ) : (
          <ShieldOff className="h-3 w-3" />
        )}
        <span className="text-[10px] uppercase font-bold hidden sm:inline">
          {indefinido ? "Verificando" : protegido ? "Pós-quântica" : "Sem PQ"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Atom className="h-5 w-5 text-primary" />
              {protegido ? "Conversa protegida" : "Proteção incompleta"}
            </DialogTitle>
            <DialogDescription className="text-left">
              {protegido
                ? "Só você e quem está do outro lado conseguem ler estas mensagens. Nem a UndoinG consegue."
                : peerState === "parcial"
                  ? `${semChave} pessoa(s) desta conversa ainda não ativaram a criptografia. Enquanto isso, as mensagens seguem sem a proteção pós-quântica.`
                  : "A outra ponta ainda não ativou a criptografia. Basta ela abrir a versão mais recente do aplicativo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-bold text-foreground">
                Por que "pós-quântica"?
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quem grava mensagens cifradas hoje pode guardá-las para abrir amanhã, quando
                existirem computadores quânticos capazes de quebrar a criptografia tradicional.
                A UndoinG já usa os algoritmos que o NIST padronizou justamente para resistir a
                isso — então o que for gravado hoje continua ilegível depois.
              </p>
            </div>

            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Troca de chaves</dt>
                <dd className="font-semibold text-foreground text-right">ML-KEM-768 · FIPS 203</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Assinatura</dt>
                <dd className="font-semibold text-foreground text-right">ML-DSA-65 · FIPS 204</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Conteúdo</dt>
                <dd className="font-semibold text-foreground text-right">AES-256-GCM</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Chave por mensagem</dt>
                <dd className="font-semibold text-foreground text-right">Sim (HKDF-SHA-256)</dd>
              </div>
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">Confirme que ninguém está no meio</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Compare os dois códigos abaixo com {peerName || "a outra pessoa"} por telefone ou
                pessoalmente. Se forem iguais dos dois lados, a conversa é só de vocês.
              </p>

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Seu código
                </p>
                <div className="rounded-lg bg-black/85 px-3 py-2 flex items-start gap-2">
                  <code className="font-mono text-[10px] leading-relaxed text-amber-300 break-all select-all flex-1">
                    {fingerprint ?? "gerando…"}
                  </code>
                  <button
                    type="button"
                    onClick={() => copiar(fingerprint)}
                    className="text-amber-300/70 hover:text-amber-300 flex-shrink-0"
                    aria-label="Copiar seu código de segurança"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {peerId && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-1">
                      Código de {peerName || "quem está do outro lado"}
                    </p>
                    <div className="rounded-lg bg-black/85 px-3 py-2">
                      <code className="font-mono text-[10px] leading-relaxed text-sky-300 break-all select-all">
                        {peerState === "carregando"
                          ? "carregando…"
                          : peerPrint ?? "ainda não ativou a criptografia"}
                      </code>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              onClick={() => {
                setOpen(false);
                navigate("/seguranca");
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Entenda a segurança da UndoinG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PqBadge;
