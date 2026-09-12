/**
 * =============================================================================
 * withdraw-diamonds.js
 *
 * DESATIVADO em 30/08/2026 — o UndoinG não usa pagamento por enquanto.
 *
 * Este arquivo é um bloqueio deliberado, não um resto de código. A implementação
 * anterior está no histórico do git (withdraw-diamonds.js, commit anterior a esta data).
 *
 * Por que um stub em vez de apagar o arquivo:
 *   • deixa registrado que o endpoint EXISTIU e foi fechado de propósito;
 *   • responde 410 Gone (recurso removido) em vez de 404, o que evita alguém
 *     concluir que errou o caminho e ficar tentando variações;
 *   • zero superfície: não lê corpo, não toca no banco, não usa segredo nenhum.
 *
 * Antes: convertia diamantes em saque via PIX/PayPal/transferência.
 *
 * PARA REATIVAR: restaure o arquivo do git, ligue MONETIZACAO_ATIVA em
 * src/config/monetizacao.ts e — antes de produção — feche a trilha de dinheiro
 * conforme o PLANO_SEGURANCA_UDG_2026-08-30.MD.
 * =============================================================================
 */

const RESPOSTA = JSON.stringify({
  error: 'monetizacao_desativada',
  message: 'A loja do UndoinG está desativada. Nenhuma operação de pagamento é aceita.',
});

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    // Sem CORS de propósito: nenhum site precisa chamar um endpoint desligado.
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 405, headers, body: RESPOSTA };
  }

  console.warn('[withdraw-diamonds.js] chamada a endpoint desativado de', 
    event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || 'origem desconhecida');

  return { statusCode: 410, headers, body: RESPOSTA };
}
