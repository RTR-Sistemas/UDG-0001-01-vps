/**
 * =============================================================================
 * Edge Function: purchase-coins
 *
 * DESATIVADA em 30/08/2026 — o UndoinG não usa pagamento por enquanto.
 *
 * Antes: validava a sessão e criava um pedido de compra de moedas.
 *
 * Este stub não lê o corpo, não abre conexão com o banco e não usa segredo
 * nenhum. Responde 410 Gone e registra a tentativa.
 *
 * ⚠️  Publicar este arquivo NÃO basta: a função continua existindo no projeto.
 *     Para remover de vez:
 *         supabase functions delete purchase-coins --project-ref ipmldkprqdhybedhpgmt
 *     O stub existe para o caso de você preferir manter a função publicada
 *     (com verify_jwt = true) enquanto decide.
 *
 * PARA REATIVAR: restaure do git, ligue MONETIZACAO_ATIVA em
 * src/config/monetizacao.ts e feche a trilha de dinheiro conforme o
 * PLANO_SEGURANCA_UDG_2026-08-30.MD.
 * =============================================================================
 */

const CORPO = JSON.stringify({
  error: "monetizacao_desativada",
  message: "A loja do UndoinG está desativada. Nenhuma operação de pagamento é aceita.",
});

const CABECALHOS: Record<string, string> = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
};

Deno.serve((req: Request) => {
  const origem = req.headers.get("cf-connecting-ip") ??
                 req.headers.get("x-real-ip") ??
                 "origem desconhecida";
  console.warn(`[purchase-coins] chamada a função desativada de ${origem}`);

  return new Response(CORPO, { status: 410, headers: CABECALHOS });
});
