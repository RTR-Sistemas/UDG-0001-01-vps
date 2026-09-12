/**
 * =============================================================================
 * File: src/lib/errorTracking.ts
 * Purpose: Enxergar o que quebra em produção — sem depender de serviço externo.
 *
 * Criado em 06/09/2026.
 *
 * Por que existe:
 *   Até aqui, um erro em produção só aparecia se o usuário mandasse um print.
 *   Isso significa descobrir tarde, e quase sempre pela pessoa errada. Este
 *   módulo captura os erros que escapam (exceções não tratadas, promessas
 *   rejeitadas, erros de renderização) e envia um resumo para a função
 *   /api/client-error, que grava em `client_errors` no banco.
 *
 * O que ele NÃO faz de propósito:
 *   • não envia conteúdo de mensagem, nome, e-mail nem nada que o usuário
 *     escreveu — só o tipo do erro, a mensagem técnica, a pilha e a rota;
 *   • não instala biblioteca de terceiros: nenhum dado sai para fora do seu
 *     próprio servidor, o que também evita uma declaração a mais na LGPD;
 *   • não repete o mesmo erro: cada assinatura é enviada uma vez por sessão,
 *     com teto de 20 envios, para um laço de erro não virar enxurrada.
 * =============================================================================
 */

const ENDPOINT = "/api/client-error";
const TETO_POR_SESSAO = 20;

const jaEnviados = new Set<string>();
let enviados = 0;

interface ErroCliente {
  tipo: "erro" | "promessa" | "render";
  mensagem: string;
  pilha?: string;
  rota: string;
  buildId?: string;
  userAgent: string;
}

function assinatura(e: ErroCliente): string {
  return `${e.tipo}|${e.mensagem}|${(e.pilha || "").slice(0, 200)}`;
}

/** Mensagens de ruído que não valem uma linha no banco. */
function ehRuido(mensagem: string): boolean {
  const ruidos = [
    "ResizeObserver loop",
    "Non-Error promise rejection captured",
    "Load failed",
    "Failed to fetch dynamically imported module",
    "NetworkError when attempting to fetch",
    "The operation was aborted",
  ];
  return ruidos.some((r) => mensagem.includes(r));
}

async function enviar(erro: ErroCliente): Promise<void> {
  if (enviados >= TETO_POR_SESSAO) return;
  if (ehRuido(erro.mensagem)) return;

  const chave = assinatura(erro);
  if (jaEnviados.has(chave)) return;
  jaEnviados.add(chave);
  enviados += 1;

  try {
    const corpo = JSON.stringify(erro);
    // sendBeacon sobrevive ao fechamento da aba; fetch é o plano B.
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        ENDPOINT,
        new Blob([corpo], { type: "application/json" }),
      );
      if (ok) return;
    }
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corpo,
      keepalive: true,
    });
  } catch {
    /* Se nem o relatório de erro consegue ser enviado, não insistimos. */
  }
}

/** Registra um erro manualmente (use dentro de um catch que importa). */
export function reportarErro(erro: unknown, contexto?: string): void {
  const e = erro instanceof Error ? erro : new Error(String(erro));
  void enviar({
    tipo: "render",
    mensagem: contexto ? `${contexto}: ${e.message}` : e.message,
    pilha: e.stack?.slice(0, 2000),
    rota: location.pathname,
    buildId: (import.meta as { env?: Record<string, string> }).env?.VITE_BUILD_ID,
    userAgent: navigator.userAgent,
  });
}

/** Liga a captura global. Chamar uma única vez, no main.tsx. */
export function iniciarErrorTracking(): void {
  window.addEventListener("error", (evento) => {
    void enviar({
      tipo: "erro",
      mensagem: evento.message || "erro sem mensagem",
      pilha: evento.error?.stack?.slice(0, 2000),
      rota: location.pathname,
      buildId: (import.meta as { env?: Record<string, string> }).env?.VITE_BUILD_ID,
      userAgent: navigator.userAgent,
    });
  });

  window.addEventListener("unhandledrejection", (evento) => {
    const motivo = evento.reason;
    void enviar({
      tipo: "promessa",
      mensagem:
        motivo instanceof Error ? motivo.message : String(motivo).slice(0, 500),
      pilha: motivo instanceof Error ? motivo.stack?.slice(0, 2000) : undefined,
      rota: location.pathname,
      buildId: (import.meta as { env?: Record<string, string> }).env?.VITE_BUILD_ID,
      userAgent: navigator.userAgent,
    });
  });
}
