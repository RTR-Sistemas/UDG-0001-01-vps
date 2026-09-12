/**
 * =============================================================================
 * File: src/pages/Security.tsx
 * Purpose: Página pública (para quem está logado) explicando a criptografia
 *          pós-quântica da UndoinG.
 *
 * Duas regras guiaram este texto:
 *   1. Explicar de verdade, sem jargão vazio. Quem lê tem que sair sabendo o
 *      que está protegido e por que isso importa.
 *   2. Não mentir por omissão. A seção "o que ainda não está protegido" é tão
 *      visível quanto a lista de conquistas. Segurança que se vende como
 *      absoluta é a que gera usuário confiante na hora errada.
 * =============================================================================
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Atom,
  Check,
  Clock,
  Database,
  Eye,
  FileWarning,
  Fingerprint,
  KeyRound,
  Lock,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { PqSecurityCard } from "@/components/security/PqSecurityCard";
import { PQ_LENGTHS } from "@/lib/pq";

export default function Security() {
  const navigate = useNavigate();

  const especificacoes = useMemo(
    () => [
      {
        papel: "Troca de chaves",
        algoritmo: "ML-KEM-768",
        antigo: "antes chamado Kyber-768",
        padrao: "FIPS 203",
        detalhe: `chave pública de ${PQ_LENGTHS.kemPublicKey} bytes`,
      },
      {
        papel: "Assinatura digital",
        algoritmo: "ML-DSA-65",
        antigo: "antes chamado Dilithium-3",
        padrao: "FIPS 204",
        detalhe: `assinatura de ${PQ_LENGTHS.dsaSignature} bytes por mensagem`,
      },
      {
        papel: "Cifra do conteúdo",
        algoritmo: "AES-256-GCM",
        antigo: "padrão de fato desde 2001",
        padrao: "FIPS 197 · SP 800-38D",
        detalhe: "chave diferente a cada mensagem",
      },
      {
        papel: "Derivação de chaves",
        algoritmo: "HKDF-SHA-256",
        antigo: "",
        padrao: "RFC 5869",
        detalhe: "separa o material de cada mensagem",
      },
    ],
    []
  );

  const protegido = [
    {
      icone: MessageSquare,
      titulo: "O texto das suas conversas",
      texto:
        "Sai cifrado do seu aparelho e só é aberto no aparelho de quem recebe. No banco de dados fica um bloco de bytes sem sentido.",
    },
    {
      icone: Users,
      titulo: "Conversas em grupo",
      texto:
        "Cada membro recebe a chave da conversa encapsulada só para ele. Quem não é do grupo não abre — nem o servidor.",
    },
    {
      icone: Fingerprint,
      titulo: "A identidade de quem escreve",
      texto:
        "Toda mensagem é assinada. Ninguém consegue publicar uma mensagem no seu nome, nem dentro de um grupo.",
    },
    {
      icone: Database,
      titulo: "Backups e vazamentos de banco",
      texto:
        "Um dump do banco não entrega conversa nenhuma. O conteúdo continua cifrado onde quer que a cópia vá parar.",
    },
    {
      icone: Clock,
      titulo: "Gravação para quebra futura",
      texto:
        "Quem interceptar e guardar o tráfego de hoje não consegue abrir depois, nem com um computador quântico.",
    },
    {
      icone: KeyRound,
      titulo: "Chaves rotativas",
      texto:
        "As chaves são trocadas a cada 500 mensagens ou 7 dias. Comprometer o aparelho hoje não abre o passado nem o futuro.",
    },
  ];

  const naoProtegido = [
    {
      titulo: "Quem falou com quem, e quando",
      texto:
        "Esses metadados ficam registrados no servidor para o aplicativo funcionar. Só o conteúdo é cifrado.",
    },
    {
      titulo: "Fotos, áudios e vídeos",
      texto:
        "Ainda são enviados sem cifra de cliente. Cifrar mídia com a chave da conversa é o próximo passo.",
    },
    {
      titulo: "Histórico em um aparelho novo",
      texto:
        "As chaves privadas nunca saem do seu aparelho. Isso é proposital — mas significa que, ao entrar em um aparelho novo, o histórico cifrado anterior não é reaberto.",
    },
    {
      titulo: "Quem estiver com o seu aparelho desbloqueado",
      texto:
        "Nenhuma criptografia protege contra alguém lendo a tela por cima do seu ombro. Use bloqueio de tela.",
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="flex items-center gap-2">
            <Atom className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Segurança</h1>
          </div>
        </div>

        {/* Hero */}
        <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-transparent p-5 space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3 w-3" />
            Criptografia pós-quântica ativa
          </span>
          <h2 className="text-2xl font-bold leading-tight">
            Suas conversas já estão protegidas contra o computador quântico.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A UndoinG cifra o texto das mensagens de ponta a ponta com os algoritmos que o NIST
            padronizou em 2024 para resistir a computadores quânticos. Não é uma promessa para
            o futuro: está funcionando agora, em toda mensagem que você envia.
          </p>
        </section>

        {/* Estado da sua conta */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Esta conta, neste aparelho
          </h3>
          <PqSecurityCard />
        </section>

        {/* O problema */}
        <section className="rounded-2xl border bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold">O problema que quase ninguém resolve</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A criptografia que protege quase toda a internet hoje (RSA, curvas elípticas) se
            apoia em contas que um computador comum levaria bilhões de anos para fazer. Um
            computador quântico grande o bastante faria em horas.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Isso cria um ataque que já está em curso, chamado{" "}
            <strong className="text-foreground">"guardar agora, abrir depois"</strong>: um
            adversário grava o tráfego cifrado hoje, guarda, e espera a tecnologia chegar. Trocar
            a criptografia só quando o computador quântico existir <em>não resolve</em> — o que
            já foi gravado continua lá.
          </p>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
            <p className="text-sm text-foreground leading-relaxed">
              <strong>A única defesa é já estar usando criptografia resistente hoje.</strong> É
              exatamente o que a UndoinG faz — para que o material gravado nunca tenha valor.
            </p>
          </div>
        </section>

        {/* Como funciona */}
        <section className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold">Como funciona, em três passos</h3>
          </div>

          {[
            {
              n: 1,
              t: "Seu aparelho cria duas chaves",
              d: "Uma identifica você (ML-DSA-65) e outra recebe segredos (ML-KEM-768). As partes privadas nunca saem daqui — não vão para o servidor, nem para a nuvem, nem para nós.",
            },
            {
              n: 2,
              t: "Cada conversa ganha uma chave própria",
              d: "Ao escrever para alguém, seu aparelho sorteia uma chave nova e a embrulha usando a chave pública de quem vai receber. Só a chave privada dessa pessoa desembrulha.",
            },
            {
              n: 3,
              t: "Cada mensagem ganha a sua própria chave",
              d: "Da chave da conversa nasce uma chave diferente por mensagem. Quebrar uma mensagem — o que já é inviável — não revelaria nenhuma outra.",
            },
          ].map((passo) => (
            <div key={passo.n} className="flex gap-3">
              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center">
                {passo.n}
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{passo.t}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{passo.d}</p>
              </div>
            </div>
          ))}

          <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
            O servidor da UndoinG participa de tudo isso <strong>sem nunca ver o conteúdo</strong>.
            Ele guarda e entrega blocos cifrados, como um carteiro que carrega envelopes lacrados.
          </p>
        </section>

        {/* Especificações */}
        <section className="rounded-2xl border bg-card p-5 space-y-3 shadow-sm">
          <h3 className="text-base font-bold">A tecnologia, sem enfeite</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Todos padronizados pelo NIST (o instituto de padrões dos Estados Unidos) em agosto de
            2024, no nível 3 de segurança — uma margem acima do que a maioria das implementações
            comerciais adota.
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-semibold">Para quê</th>
                  <th className="py-2 pr-3 font-semibold">Algoritmo</th>
                  <th className="py-2 pr-3 font-semibold">Padrão</th>
                  <th className="py-2 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {especificacoes.map((linha) => (
                  <tr key={linha.papel} className="border-b last:border-0 align-top">
                    <td className="py-2.5 pr-3 text-muted-foreground">{linha.papel}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-mono font-semibold text-foreground">
                        {linha.algoritmo}
                      </span>
                      {linha.antigo && (
                        <span className="block text-[10px] text-muted-foreground">
                          {linha.antigo}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                      {linha.padrao}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{linha.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* O que está protegido */}
        <section className="space-y-3">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            O que está protegido
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {protegido.map((item) => {
              const Icone = item.icone;
              return (
                <div
                  key={item.titulo}
                  className="rounded-xl border bg-card p-3.5 space-y-1.5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Icone className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.texto}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* O que ainda não está */}
        <section className="space-y-3">
          <h3 className="text-base font-bold flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-amber-500" />
            O que ainda não está protegido
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Preferimos dizer isto na sua cara a deixar você confiar em algo que não existe.
          </p>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 divide-y divide-amber-500/15">
            {naoProtegido.map((item) => (
              <div key={item.titulo} className="p-3.5 space-y-1">
                <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Como conferir */}
        <section className="rounded-2xl border bg-card p-5 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold">Não confie: confira</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Toda conta tem um <strong className="text-foreground">código de segurança</strong> —
            uma sequência de números e letras derivada da sua chave de identidade. Ele aparece
            no topo desta página e dentro de cada conversa, tocando no selo{" "}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-2.5 w-2.5" />
              Pós-quântica
            </span>
            .
          </p>
          <ol className="space-y-2 text-xs text-muted-foreground">
            {[
              "Abra a conversa e toque no selo verde no topo.",
              "Ligue para a pessoa, ou fale com ela pessoalmente.",
              "Leiam os dois códigos em voz alta.",
              "Se baterem, ninguém está no meio da conversa. Se mudarem do nada um dia, desconfie e pergunte antes de continuar.",
            ].map((passo, i) => (
              <li key={i} className="flex gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{passo}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground leading-relaxed">
            É por isso que o código existe: mesmo que alguém tomasse conta dos nossos servidores e
            tentasse trocar as chaves, o código mudaria — e você veria.
          </p>
        </section>

        <div className="flex flex-wrap gap-2 pb-6">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/settings")}>
            Configurações de privacidade
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/messages")}>
            Voltar às conversas
          </Button>
        </div>
      </div>
    </div>
  );
}
