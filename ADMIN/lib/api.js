/**
 * =============================================================================
 * lib/api.js — Toda a lógica de dados do painel.
 *
 * Cada função aqui responde a uma pergunta que um administrador faz de verdade:
 * quantas pessoas entraram hoje, o que está esperando moderação, quem pediu
 * exclusão de dados, o que quebrou na última hora.
 *
 * Duas regras seguidas em todo o arquivo:
 *
 *  1. NADA QUEBRA POR TABELA AUSENTE. O banco do UndoinG passou por dezenas de
 *     migrações e nem tudo existe em toda instalação. Quando uma tabela não
 *     está lá, o painel mostra "não disponível" naquele cartão e segue em
 *     frente — em vez de derrubar a tela inteira.
 *
 *  2. TODA AÇÃO QUE MUDA ALGO É REGISTRADA. Remover post, banir conta, apagar
 *     dados: tudo passa pela auditoria antes de acontecer. Sem esse registro
 *     você não consegue responder a um recurso de usuário nem a um pedido da
 *     ANPD — e a política de moderação que publicamos promete exatamente isso.
 * =============================================================================
 */

'use strict';

const store = require('./store');

const DIA = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const diasAtras = (n) => iso(Date.now() - n * DIA);

/** Agrupa registros por dia a partir de um campo de data. */
function porDia(linhas, campo, dias) {
  const balde = new Map();
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DIA).toISOString().slice(0, 10);
    balde.set(d, 0);
  }
  for (const linha of linhas) {
    const valor = linha && linha[campo];
    if (!valor) continue;
    const d = String(valor).slice(0, 10);
    if (balde.has(d)) balde.set(d, balde.get(d) + 1);
  }
  return [...balde.entries()].map(([data, valor]) => ({ data, valor }));
}

/** Busca datas de criação numa janela, para montar série temporal. */
async function serie(sb, tabelas, campo, dias) {
  const { tabela, linhas } = await sb.selecionarTolerante(
    tabelas,
    `select=${campo}&${campo}=gte.${diasAtras(dias)}&order=${campo}.asc&limit=20000`,
  );
  if (!tabela) return null;
  return porDia(linhas, campo, dias);
}

// ---------------------------------------------------------------------------
// Nomes de tabela conhecidos, em ordem de preferência
// ---------------------------------------------------------------------------
const T = {
  perfis: ['profiles'],
  posts: ['posts'],
  mensagens: ['messages'],
  conversas: ['conversations'],
  comunidades: ['communities'],
  denuncias: ['reports', 'post_reports', 'content_reports'],
  moderacao: ['content_moderation_log'],
  erros: ['client_errors'],
  lgpd: ['lgpd_requests'],
  auditoria: ['admin_audit'],
  bloqueios: ['user_blocks'],
};

// ---------------------------------------------------------------------------
// 1. Painel geral
// ---------------------------------------------------------------------------

async function dashboard(sb) {
  const [
    usuarios, usuarios24h, usuarios7d,
    posts, posts24h,
    mensagens24h,
    comunidades,
    denunciasAbertas,
    pendentesModeracao,
    erros24h,
    lgpdAbertos,
  ] = await Promise.all([
    sb.contarTolerante(T.perfis),
    sb.contarTolerante(T.perfis, `created_at=gte.${diasAtras(1)}`),
    sb.contarTolerante(T.perfis, `created_at=gte.${diasAtras(7)}`),
    sb.contarTolerante(T.posts),
    sb.contarTolerante(T.posts, `created_at=gte.${diasAtras(1)}`),
    sb.contarTolerante(T.mensagens, `created_at=gte.${diasAtras(1)}`),
    sb.contarTolerante(T.comunidades),
    sb.contarTolerante(T.denuncias, 'status=eq.pending'),
    sb.contarTolerante(T.moderacao, 'action_taken=eq.pending_review'),
    sb.contarTolerante(T.erros, `criado_em=gte.${diasAtras(1)}`),
    sb.contarTolerante(T.lgpd, 'status=eq.aberto'),
  ]);

  const [serieUsuarios, seriePosts, serieMensagens, serieErros] = await Promise.all([
    serie(sb, T.perfis, 'created_at', 30),
    serie(sb, T.posts, 'created_at', 30),
    serie(sb, T.mensagens, 'created_at', 14),
    serie(sb, T.erros, 'criado_em', 14),
  ]);

  return {
    cartoes: {
      usuarios, usuarios24h, usuarios7d,
      posts, posts24h, mensagens24h, comunidades,
      denunciasAbertas, pendentesModeracao, erros24h, lgpdAbertos,
    },
    series: {
      usuarios: serieUsuarios,
      posts: seriePosts,
      mensagens: serieMensagens,
      erros: serieErros,
    },
    em: new Date().toISOString(),
  };
}

/** Versão leve, para o fluxo em tempo real (só contagens). */
async function pulso(sb) {
  const [usuarios, usuarios24h, mensagens1h, erros1h, denunciasAbertas] = await Promise.all([
    sb.contarTolerante(T.perfis),
    sb.contarTolerante(T.perfis, `created_at=gte.${diasAtras(1)}`),
    sb.contarTolerante(T.mensagens, `created_at=gte.${iso(Date.now() - 3600000)}`),
    sb.contarTolerante(T.erros, `criado_em=gte.${iso(Date.now() - 3600000)}`),
    sb.contarTolerante(T.denuncias, 'status=eq.pending'),
  ]);

  // Presença: quem foi visto nos últimos 5 minutos.
  const online = await sb.contarTolerante(
    T.perfis,
    `last_seen=gte.${iso(Date.now() - 5 * 60000)}`,
  );

  return { usuarios, usuarios24h, mensagens1h, erros1h, denunciasAbertas, online, em: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// 2. Usuários
// ---------------------------------------------------------------------------

async function listarUsuarios(sb, { busca = '', limite = 50 } = {}) {
  const campos = 'id,username,full_name,avatar_url,created_at,last_seen,is_banned,is_adult_verified,pq_mlkem_pubkey';
  let params = `select=${campos}&order=created_at.desc&limit=${Math.min(Number(limite) || 50, 200)}`;
  if (busca) {
    const b = encodeURIComponent(`%${busca}%`);
    params += `&or=(username.ilike.${b},full_name.ilike.${b})`;
  }
  const { tabela, linhas } = await sb.selecionarTolerante(T.perfis, params);
  if (!tabela) return { indisponivel: true, linhas: [] };
  return {
    linhas: linhas.map((u) => ({
      ...u,
      pq_ativo: Boolean(u.pq_mlkem_pubkey),
      pq_mlkem_pubkey: undefined,
    })),
  };
}

async function detalheUsuario(sb, id) {
  const { linhas } = await sb.selecionarTolerante(T.perfis, `select=*&id=eq.${id}&limit=1`);
  const perfil = linhas[0] || null;
  if (!perfil) return null;

  const [posts, mensagens, denuncias] = await Promise.all([
    sb.contarTolerante(T.posts, `user_id=eq.${id}`),
    sb.contarTolerante(T.mensagens, `user_id=eq.${id}`),
    sb.contarTolerante(T.denuncias, `reported_user_id=eq.${id}`),
  ]);

  // Nunca devolvemos as chaves públicas inteiras nem campos internos grandes.
  delete perfil.pq_mldsa_pubkey;
  delete perfil.pq_mlkem_pubkey;
  delete perfil.pq_mldsa_sig;

  return { perfil, contagens: { posts, mensagens, denuncias } };
}

async function acaoUsuario(sb, id, acao, motivo, quem) {
  const acoes = {
    banir: { is_banned: true },
    desbanir: { is_banned: false },
    verificar_idade: { is_adult_verified: true },
    revogar_verificacao: { is_adult_verified: false },
  };
  const valores = acoes[acao];
  if (!valores) throw new Error('Ação desconhecida.');

  store.registrar('usuario.' + acao, { alvo: id, motivo, quem });
  await sb.atualizar('profiles', `id=eq.${id}`, valores);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 3. Moderação
// ---------------------------------------------------------------------------

async function filaModeracao(sb, { limite = 50 } = {}) {
  const pendentes = await sb.selecionarTolerante(
    T.moderacao,
    `select=*&action_taken=eq.pending_review&order=created_at.desc&limit=${limite}`,
  );
  const denuncias = await sb.selecionarTolerante(
    T.denuncias,
    `select=*&order=created_at.desc&limit=${limite}`,
  );
  return {
    automatica: { tabela: pendentes.tabela, linhas: pendentes.linhas },
    denuncias: { tabela: denuncias.tabela, linhas: denuncias.linhas },
  };
}

async function decidirModeracao(sb, { tipo, id, decisao, motivo, quem }) {
  if (!['manter', 'remover'].includes(decisao)) throw new Error('Decisão inválida.');
  store.registrar('moderacao.' + decisao, { tipo, alvo: id, motivo, quem });

  if (tipo === 'automatica') {
    const t = await sb.primeiraTabelaExistente(T.moderacao);
    if (!t) throw new Error('Tabela de moderação não encontrada.');
    await sb.atualizar(t, `id=eq.${id}`, {
      action_taken: decisao === 'remover' ? 'blocked' : 'allowed',
      is_published: decisao !== 'remover',
    });
  } else {
    const t = await sb.primeiraTabelaExistente(T.denuncias);
    if (!t) throw new Error('Tabela de denúncias não encontrada.');
    await sb.atualizar(t, `id=eq.${id}`, { status: decisao === 'remover' ? 'resolved' : 'dismissed' });
  }
  return { ok: true };
}

async function removerPost(sb, id, motivo, quem) {
  store.registrar('conteudo.remover_post', { alvo: id, motivo, quem });
  await sb.remover('posts', `id=eq.${id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 4. LGPD
// ---------------------------------------------------------------------------

async function listarLgpd(sb) {
  const { tabela, linhas } = await sb.selecionarTolerante(
    T.lgpd,
    'select=*&order=criado_em.desc&limit=200',
  );
  if (!tabela) return { indisponivel: true, linhas: [] };
  return { linhas };
}

async function criarPedidoLgpd(sb, { userId, tipo, observacao, quem }) {
  const tipos = ['acesso', 'portabilidade', 'correcao', 'exclusao', 'revogacao'];
  if (!tipos.includes(tipo)) throw new Error('Tipo de pedido inválido.');

  const prazo = new Date(Date.now() + 15 * DIA).toISOString();
  store.registrar('lgpd.abrir', { alvo: userId, tipo, quem });

  const t = await sb.primeiraTabelaExistente(T.lgpd);
  if (!t) throw new Error('Tabela lgpd_requests não existe. Rode ADMIN/sql/admin_tables.sql.');

  return sb.inserir(t, {
    user_id: userId, tipo, status: 'aberto', observacao: observacao || null, prazo_em: prazo,
  });
}

async function concluirPedidoLgpd(sb, { id, resultado, quem }) {
  store.registrar('lgpd.concluir', { pedido: id, resultado, quem });
  const t = await sb.primeiraTabelaExistente(T.lgpd);
  if (!t) throw new Error('Tabela lgpd_requests não existe.');
  return sb.atualizar(t, `id=eq.${id}`, {
    status: 'concluido', resultado: resultado || null, concluido_em: new Date().toISOString(),
  });
}

/**
 * Exportação de dados do titular (art. 18, V — portabilidade).
 *
 * Junta tudo o que o banco tem sobre uma pessoa num único JSON. Importante: o
 * conteúdo das mensagens privadas sai como está no banco — ou seja, cifrado.
 * Isso não é falha da exportação: é a criptografia de ponta a ponta funcionando.
 * Nem o servidor consegue abrir, e a exportação diz isso explicitamente.
 */
async function exportarDadosUsuario(sb, id, quem) {
  store.registrar('lgpd.exportar', { alvo: id, quem });

  const buscar = async (tabelas, filtro, limite = 5000) => {
    const { tabela, linhas } = await sb.selecionarTolerante(tabelas, `select=*&${filtro}&limit=${limite}`);
    return tabela ? linhas : null;
  };

  const [perfil, posts, mensagens, denuncias] = await Promise.all([
    buscar(T.perfis, `id=eq.${id}`, 1),
    buscar(T.posts, `user_id=eq.${id}`),
    buscar(T.mensagens, `user_id=eq.${id}`),
    buscar(T.denuncias, `reporter_id=eq.${id}`),
  ]);

  return {
    gerado_em: new Date().toISOString(),
    titular: id,
    aviso:
      'As mensagens de conversas privadas aparecem cifradas (envelopes com prefixo "pq1."). ' +
      'Elas são protegidas por criptografia de ponta a ponta pós-quântica: a chave está apenas ' +
      'no aparelho do titular e nem o servidor consegue abri-las. Para ler o histórico em texto, ' +
      'o titular deve usar o próprio aplicativo, no aparelho onde a identidade foi criada.',
    perfil: perfil ? perfil[0] : null,
    posts,
    mensagens,
    denuncias_feitas: denuncias,
  };
}

/**
 * Exclusão de conta (art. 18, VI). Não é "marcar como inativo": apaga.
 * A remoção em auth.users normalmente arrasta o resto por ON DELETE CASCADE.
 */
async function excluirUsuario(sb, supabaseUrl, id, motivo, quem) {
  store.registrar('lgpd.excluir_conta', { alvo: id, motivo, quem });

  // A API REST (/rest/v1) não alcança o schema `auth`. A remoção da conta em si
  // é feita pela API administrativa de autenticação, que aceita a service_role.
  const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${id}`;
  await sb.requisicao(url, { method: 'DELETE' });

  return {
    ok: true,
    aviso:
      'A conta foi removida. Confira se as mídias do usuário no Cloudinary também ' +
      'foram apagadas — o banco não alcança o provedor de mídia, e a Política de ' +
      'Privacidade promete a eliminação completa.',
  };
}

// ---------------------------------------------------------------------------
// 5. Conteúdo
// ---------------------------------------------------------------------------

async function listarConteudo(sb, { limite = 40 } = {}) {
  const [posts, comunidades] = await Promise.all([
    sb.selecionarTolerante(T.posts, `select=id,user_id,content,created_at,media_urls,is_community_approved&order=created_at.desc&limit=${limite}`),
    sb.selecionarTolerante(T.comunidades, `select=id,name,created_at&order=created_at.desc&limit=${limite}`),
  ]);
  return { posts: posts.linhas, comunidades: comunidades.linhas };
}

// ---------------------------------------------------------------------------
// 6. Erros do aplicativo
// ---------------------------------------------------------------------------

async function listarErros(sb, { horas = 24 } = {}) {
  const desde = iso(Date.now() - horas * 3600000);
  const { tabela, linhas } = await sb.selecionarTolerante(
    T.erros,
    `select=*&criado_em=gte.${desde}&order=criado_em.desc&limit=2000`,
  );
  if (!tabela) {
    return {
      indisponivel: true,
      dica: 'A tabela client_errors ainda não existe. Rode supabase/checks/criar_tabela_client_errors.sql.',
      grupos: [], recentes: [],
    };
  }

  const mapa = new Map();
  for (const e of linhas) {
    const chave = `${e.mensagem}|${e.rota || ''}`;
    const atual = mapa.get(chave) || { mensagem: e.mensagem, rota: e.rota, vezes: 0, ultimo: e.criado_em, tipo: e.tipo };
    atual.vezes += 1;
    if (e.criado_em > atual.ultimo) atual.ultimo = e.criado_em;
    mapa.set(chave, atual);
  }

  return {
    grupos: [...mapa.values()].sort((a, b) => b.vezes - a.vezes).slice(0, 50),
    recentes: linhas.slice(0, 50),
    total: linhas.length,
  };
}

// ---------------------------------------------------------------------------
// 7. Saúde do sistema
// ---------------------------------------------------------------------------

async function saude(sb, siteUrl) {
  const checar = async (url, nome) => {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      return { nome, url, ok: r.ok, status: r.status, ms: Date.now() - t0 };
    } catch (e) {
      return { nome, url, ok: false, status: 0, ms: Date.now() - t0, erro: e.message };
    }
  };

  const base = (siteUrl || '').replace(/\/$/, '');
  const checagens = [];
  if (base) {
    checagens.push(checar(`${base}/`, 'Site'));
    checagens.push(checar(`${base}/api/app-config`, 'Funções (/api)'));
    checagens.push(checar(`${base}/privacidade`, 'Página de privacidade'));
  }

  const t0 = Date.now();
  let banco;
  try {
    await sb.testarConexao();
    banco = { nome: 'Banco de dados', ok: true, status: 200, ms: Date.now() - t0 };
  } catch (e) {
    banco = { nome: 'Banco de dados', ok: false, status: e.status || 0, ms: Date.now() - t0, erro: e.message };
  }

  return { itens: [banco, ...(await Promise.all(checagens))], em: new Date().toISOString() };
}

module.exports = {
  dashboard,
  pulso,
  listarUsuarios,
  detalheUsuario,
  acaoUsuario,
  filaModeracao,
  decidirModeracao,
  removerPost,
  listarLgpd,
  criarPedidoLgpd,
  concluirPedidoLgpd,
  exportarDadosUsuario,
  excluirUsuario,
  listarConteudo,
  listarErros,
  saude,
};
