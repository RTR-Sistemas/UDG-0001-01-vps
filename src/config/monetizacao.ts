/**
 * =============================================================================
 * File: src/config/monetizacao.ts
 * Purpose: Interruptor único da monetização (loja, moedas, diamantes, PIX).
 *
 * Decisão de 30/08/2026: o UndoinG não vai usar pagamento por enquanto.
 * Em vez de espalhar `if` pelo código ou apenas esconder os botões, tudo passa
 * por esta constante — e o desligamento acontece na CAMADA DE SERVIÇO, antes de
 * qualquer chamada de rede.
 *
 * Por que isso importa para a segurança:
 *   Esconder o botão não fecha o endpoint. Enquanto `purchase-coins`,
 *   `withdraw-diamonds`, `pix-confirm-code` e `payment-webhook` estiverem de pé,
 *   qualquer pessoa chama direto com `curl` — e a trilha de dinheiro é onde uma
 *   falha vira prejuízo. Superfície que não existe não pode ser atacada.
 *
 * O que foi desligado junto com esta constante:
 *   • entrada "Carteira" no menu Mais          (AppLayout.tsx)
 *   • rota /wallet                             (App.tsx)
 *   • compra de moedas e saque                 (walletService.ts)
 *   • loja, planos e assinatura                (monetization.ts)
 *   • cadastro e confirmação de chave PIX      (pixService.ts)
 *   • os 4 endpoints da Netlify                (stubs 410 Gone)
 *   • as 2 Edge Functions do Supabase          (stubs 410 Gone)
 *
 * PARA REATIVAR:
 *   1. `MONETIZACAO_ATIVA = true` aqui;
 *   2. devolver a entrada "Carteira" no AppLayout e a rota /wallet no App.tsx
 *      (os dois trechos estão comentados no lugar de origem);
 *   3. restaurar os endpoints a partir do git;
 *   4. ANTES de ligar em produção, fechar a trilha de dinheiro: assinatura HMAC
 *      de verdade no webhook do Mercado Pago (hoje é um segredo estático
 *      comparado em tempo não constante), idempotência por `order_id` e
 *      auditoria de crédito. Ver PLANO_SEGURANCA_UDG_2026-08-30.MD.
 * =============================================================================
 */

/** Quando false, toda a trilha de dinheiro fica inerte. */
export const MONETIZACAO_ATIVA = false;

/** Erro padrão devolvido por qualquer operação de pagamento desligada. */
export class MonetizacaoDesativadaError extends Error {
  readonly code = "MONETIZACAO_DESATIVADA";
  constructor(operacao = "Esta operação") {
    super(`${operacao} está indisponível: a loja do UndoinG está desativada.`);
    this.name = "MonetizacaoDesativadaError";
  }
}

/** Lança quando a monetização está desligada. Use no início da função. */
export function exigirMonetizacaoAtiva(operacao: string): void {
  if (!MONETIZACAO_ATIVA) throw new MonetizacaoDesativadaError(operacao);
}
