/**
 * =============================================================================
 * lib/supabase.js — Cliente REST do Supabase, sem dependência externa.
 *
 * Fala com https://<seu-servidor>/rest/v1 usando a chave service_role. Isso
 * significa duas coisas:
 *
 *   1. Nenhuma porta nova precisa ser aberta no firewall: tudo vai pela 443,
 *      que já está aberta para o site.
 *   2. A service_role IGNORA todas as regras de RLS. Este arquivo enxerga o
 *      banco inteiro, de qualquer usuário. Por isso o programa só escuta em
 *      127.0.0.1 e exige senha — ele nunca deve ser exposto na rede.
 *
 * Tolerância a esquema: o UndoinG evoluiu por muitas migrações e nem toda
 * instalação tem exatamente as mesmas tabelas. Em vez de quebrar, as funções
 * daqui tentam os nomes conhecidos em ordem e avisam "tabela não encontrada"
 * quando nenhum existe. É melhor um painel que informa a lacuna do que um
 * painel que mostra tela branca.
 * =============================================================================
 */

'use strict';

class ErroSupabase extends Error {
  constructor(mensagem, status, corpo) {
    super(mensagem);
    this.name = 'ErroSupabase';
    this.status = status;
    this.corpo = corpo;
  }
}

function criarCliente({ supabaseUrl, serviceKey }) {
  const base = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;

  const cabecalhos = (extra = {}) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  });

  async function requisicao(caminho, opcoes = {}) {
    const url = caminho.startsWith('http') ? caminho : `${base}/${caminho}`;
    let resposta;
    try {
      resposta = await fetch(url, {
        ...opcoes,
        headers: cabecalhos(opcoes.headers),
        signal: AbortSignal.timeout(opcoes.timeoutMs || 30000),
      });
    } catch (e) {
      throw new ErroSupabase(`Não consegui falar com o servidor: ${e.message}`, 0);
    }

    const texto = await resposta.text();
    let dados = null;
    if (texto) {
      try { dados = JSON.parse(texto); } catch { dados = texto; }
    }

    if (!resposta.ok) {
      const msg = (dados && (dados.message || dados.hint || dados.error)) || `HTTP ${resposta.status}`;
      throw new ErroSupabase(msg, resposta.status, dados);
    }

    return { dados, cabecalhos: resposta.headers };
  }

  /** SELECT. `params` é uma query string no formato do PostgREST. */
  async function selecionar(tabela, params = '') {
    const { dados } = await requisicao(`${tabela}${params ? `?${params}` : ''}`);
    return Array.isArray(dados) ? dados : [];
  }

  /** Conta linhas sem trazê-las (usa o cabeçalho content-range). */
  async function contar(tabela, filtro = '') {
    const params = [filtro, 'select=*', 'limit=1'].filter(Boolean).join('&');
    const { cabecalhos: h } = await requisicao(`${tabela}?${params}`, {
      headers: { Prefer: 'count=exact' },
    });
    const range = h.get('content-range') || '';
    const total = Number(String(range).split('/')[1]);
    return Number.isFinite(total) ? total : 0;
  }

  async function atualizar(tabela, filtro, valores) {
    const { dados } = await requisicao(`${tabela}?${filtro}`, {
      method: 'PATCH',
      body: JSON.stringify(valores),
      headers: { Prefer: 'return=representation' },
    });
    return dados;
  }

  async function inserir(tabela, valores) {
    const { dados } = await requisicao(tabela, {
      method: 'POST',
      body: JSON.stringify(valores),
      headers: { Prefer: 'return=representation' },
    });
    return dados;
  }

  async function remover(tabela, filtro) {
    await requisicao(`${tabela}?${filtro}`, { method: 'DELETE' });
    return true;
  }

  /** Chama uma função do banco (RPC). */
  async function rpc(nome, args = {}) {
    const { dados } = await requisicao(`rpc/${nome}`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
    return dados;
  }

  // -------------------------------------------------------------------------
  // Tolerância a esquema
  // -------------------------------------------------------------------------

  const cacheTabelas = new Map();

  /** Devolve o primeiro nome de tabela que existir, ou null. */
  async function primeiraTabelaExistente(nomes) {
    const chave = nomes.join('|');
    if (cacheTabelas.has(chave)) return cacheTabelas.get(chave);
    for (const nome of nomes) {
      try {
        await requisicao(`${nome}?select=*&limit=1`);
        cacheTabelas.set(chave, nome);
        return nome;
      } catch (e) {
        if (e.status === 404 || e.status === 400) continue;
        // Erro que não é "não existe" (rede, autenticação) deve subir.
        if (e.status === 0 || e.status === 401 || e.status === 403) throw e;
      }
    }
    cacheTabelas.set(chave, null);
    return null;
  }

  /** Conta com tolerância: devolve null quando a tabela não existe. */
  async function contarTolerante(nomes, filtro = '') {
    const tabela = await primeiraTabelaExistente([].concat(nomes));
    if (!tabela) return null;
    try {
      return await contar(tabela, filtro);
    } catch {
      return null;
    }
  }

  /** SELECT com tolerância: devolve [] e a tabela usada. */
  async function selecionarTolerante(nomes, params = '') {
    const tabela = await primeiraTabelaExistente([].concat(nomes));
    if (!tabela) return { tabela: null, linhas: [] };
    try {
      return { tabela, linhas: await selecionar(tabela, params) };
    } catch {
      return { tabela, linhas: [] };
    }
  }

  /** Testa se a chave e o endereço funcionam. */
  async function testarConexao() {
    await requisicao('profiles?select=id&limit=1', { timeoutMs: 15000 });
    return true;
  }

  return {
    requisicao,
    selecionar,
    contar,
    atualizar,
    inserir,
    remover,
    rpc,
    primeiraTabelaExistente,
    contarTolerante,
    selecionarTolerante,
    testarConexao,
  };
}

module.exports = { criarCliente, ErroSupabase };
