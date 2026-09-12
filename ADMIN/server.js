/**
 * =============================================================================
 * UndoinG Admin — servidor local
 *
 * Um painel de administração que roda na SUA máquina e conversa com o seu
 * servidor por HTTPS. Nada é publicado, nada é exposto: ele escuta apenas em
 * 127.0.0.1, e uma conexão vinda de fora é recusada antes de qualquer coisa.
 *
 * Por que local e não uma página no ar:
 *   Este programa usa a chave `service_role`, que ignora todas as regras de
 *   RLS e enxerga o banco inteiro. Uma ferramenta com esse poder na internet é
 *   um alvo — e um único erro de configuração entrega tudo. Rodando local, a
 *   superfície de ataque é o seu computador, não o mundo.
 *
 * Zero dependências externas: só a biblioteca padrão do Node. Isso torna o
 * empacotamento em .exe simples e elimina a cadeia de suprimentos do npm como
 * risco para uma ferramenta que segura a chave mestra do sistema.
 * =============================================================================
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const store = require('./lib/store');
const { criarCliente } = require('./lib/supabase');
const api = require('./lib/api');

const PORTA = Number(process.env.UDG_ADMIN_PORT || 3456);
const HOST = '127.0.0.1';

/** Estado da sessão viva: o cliente só existe depois do login. */
let clienteAtual = null;
let configAtual = null;

// ---------------------------------------------------------------------------
// Utilidades de HTTP
// ---------------------------------------------------------------------------

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function json(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(corpo);
}

function lerCorpo(req, limite = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const partes = [];
    req.on('data', (c) => {
      total += c.length;
      if (total > limite) { reject(new Error('Corpo grande demais.')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => {
      const texto = Buffer.concat(partes).toString('utf8');
      if (!texto) return resolve({});
      try { resolve(JSON.parse(texto)); } catch { reject(new Error('JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

function lerCookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Pasta da interface, funcionando tanto em dev quanto dentro do .exe. */
function pastaUi() {
  return path.join(__dirname, 'ui');
}

// ---------------------------------------------------------------------------
// Proteções
// ---------------------------------------------------------------------------

/** Só aceita conexão da própria máquina. */
function ehLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

/**
 * Defesa contra "DNS rebinding": um site malicioso aberto no seu navegador não
 * pode falar com este painel se o cabeçalho Host não for localhost.
 */
function hostConfiavel(req) {
  const host = (req.headers.host || '').split(':')[0];
  return host === '127.0.0.1' || host === 'localhost';
}

/** Bloqueia requisição de escrita vinda de outra origem (CSRF). */
function origemConfiavel(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origem = req.headers.origin;
  if (!origem) return true; // fetch same-origin do próprio painel
  try {
    const u = new URL(origem);
    return (u.hostname === '127.0.0.1' || u.hostname === 'localhost')
      && u.port === String(PORTA);
  } catch {
    return false;
  }
}

// Freio simples contra tentativa de senha em sequência.
const tentativas = { contagem: 0, bloqueadoAte: 0 };

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

async function rotaPublica(req, res, url) {
  // ---- estado inicial -----------------------------------------------------
  if (url.pathname === '/api/estado' && req.method === 'GET') {
    return json(res, 200, {
      configurado: store.estaConfigurado(),
      autenticado: Boolean(store.lerSessao(lerCookie(req, 'udg_admin'))),
      versao: '1.0.0',
    });
  }

  // ---- primeira execução --------------------------------------------------
  if (url.pathname === '/api/configurar' && req.method === 'POST') {
    if (store.estaConfigurado()) return json(res, 409, { erro: 'Já configurado.' });
    const corpo = await lerCorpo(req);
    try {
      // Testa a chave ANTES de gravar: melhor falhar agora do que na primeira tela.
      const teste = criarCliente({ supabaseUrl: corpo.supabaseUrl, serviceKey: corpo.serviceKey });
      await teste.testarConexao();
    } catch (e) {
      return json(res, 400, { erro: `Não consegui conectar: ${e.message}` });
    }
    try {
      store.configurar(corpo);
      store.registrar('sistema.configurado', { supabaseUrl: corpo.supabaseUrl });
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 400, { erro: e.message });
    }
  }

  // ---- login --------------------------------------------------------------
  if (url.pathname === '/api/login' && req.method === 'POST') {
    if (Date.now() < tentativas.bloqueadoAte) {
      const seg = Math.ceil((tentativas.bloqueadoAte - Date.now()) / 1000);
      return json(res, 429, { erro: `Muitas tentativas. Espere ${seg} segundos.` });
    }

    const { senha } = await lerCorpo(req);
    const aberto = store.destravar(String(senha || ''));

    if (!aberto) {
      tentativas.contagem += 1;
      if (tentativas.contagem >= 5) {
        tentativas.bloqueadoAte = Date.now() + 60000;
        tentativas.contagem = 0;
        store.registrar('login.bloqueado', {});
      }
      store.registrar('login.falhou', {});
      return json(res, 401, { erro: 'Senha incorreta.' });
    }

    tentativas.contagem = 0;
    configAtual = aberto;
    clienteAtual = criarCliente(aberto);

    const token = store.criarSessao({ quem: 'admin' });
    store.registrar('login.ok', {});

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': `udg_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
      'Cache-Control': 'no-store',
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  return false;
}

async function rotaProtegida(req, res, url, sessao) {
  const sb = clienteAtual;
  const quem = sessao.quem;

  if (!sb) return json(res, 503, { erro: 'Sessão sem conexão. Entre novamente.' });

  const p = url.pathname;
  const q = url.searchParams;

  // ---- sessão -------------------------------------------------------------
  if (p === '/api/logout' && req.method === 'POST') {
    store.encerrarSessao(lerCookie(req, 'udg_admin'));
    store.registrar('logout', {});
    clienteAtual = null;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'udg_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    });
    return res.end('{"ok":true}');
  }

  if (p === '/api/trocar-senha' && req.method === 'POST') {
    const { senhaAtual, senhaNova } = await lerCorpo(req);
    store.trocarSenha(senhaAtual, senhaNova);
    store.registrar('sistema.senha_trocada', { quem });
    return json(res, 200, { ok: true });
  }

  // ---- leitura ------------------------------------------------------------
  if (p === '/api/dashboard') return json(res, 200, await api.dashboard(sb));
  if (p === '/api/pulso') return json(res, 200, await api.pulso(sb));
  if (p === '/api/usuarios') {
    return json(res, 200, await api.listarUsuarios(sb, {
      busca: q.get('busca') || '', limite: q.get('limite') || 50,
    }));
  }
  if (p.startsWith('/api/usuarios/') && req.method === 'GET') {
    const id = p.split('/')[3];
    const dados = await api.detalheUsuario(sb, id);
    return json(res, dados ? 200 : 404, dados || { erro: 'Usuário não encontrado.' });
  }
  if (p === '/api/moderacao') return json(res, 200, await api.filaModeracao(sb));
  if (p === '/api/lgpd' && req.method === 'GET') return json(res, 200, await api.listarLgpd(sb));
  if (p === '/api/conteudo') return json(res, 200, await api.listarConteudo(sb));
  if (p === '/api/erros') return json(res, 200, await api.listarErros(sb, { horas: Number(q.get('horas')) || 24 }));
  if (p === '/api/saude') return json(res, 200, await api.saude(sb, configAtual.siteUrl));
  if (p === '/api/auditoria') return json(res, 200, { linhas: store.lerAuditoria(400) });

  // ---- fluxo em tempo real (Server-Sent Events) ---------------------------
  if (p === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });

    let vivo = true;
    const enviar = async () => {
      if (!vivo) return;
      try {
        const dados = await api.pulso(sb);
        res.write(`data: ${JSON.stringify(dados)}\n\n`);
      } catch (e) {
        res.write(`data: ${JSON.stringify({ erro: e.message })}\n\n`);
      }
    };

    await enviar();
    const timer = setInterval(enviar, 10000);
    req.on('close', () => { vivo = false; clearInterval(timer); });
    return true;
  }

  // ---- escrita ------------------------------------------------------------
  if (p.startsWith('/api/usuarios/') && p.endsWith('/acao') && req.method === 'POST') {
    const id = p.split('/')[3];
    const { acao, motivo } = await lerCorpo(req);
    return json(res, 200, await api.acaoUsuario(sb, id, acao, motivo, quem));
  }

  if (p.startsWith('/api/usuarios/') && p.endsWith('/exportar') && req.method === 'GET') {
    const id = p.split('/')[3];
    const dados = await api.exportarDadosUsuario(sb, id, quem);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-${id}.json"`,
    });
    return res.end(JSON.stringify(dados, null, 2));
  }

  if (p.startsWith('/api/usuarios/') && p.endsWith('/excluir') && req.method === 'POST') {
    const id = p.split('/')[3];
    const { motivo } = await lerCorpo(req);
    return json(res, 200, await api.excluirUsuario(sb, configAtual.supabaseUrl, id, motivo, quem));
  }

  if (p === '/api/moderacao/decidir' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    return json(res, 200, await api.decidirModeracao(sb, { ...corpo, quem }));
  }

  if (p === '/api/conteudo/remover-post' && req.method === 'POST') {
    const { id, motivo } = await lerCorpo(req);
    return json(res, 200, await api.removerPost(sb, id, motivo, quem));
  }

  if (p === '/api/lgpd' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    return json(res, 200, await api.criarPedidoLgpd(sb, { ...corpo, quem }));
  }

  if (p === '/api/lgpd/concluir' && req.method === 'POST') {
    const corpo = await lerCorpo(req);
    return json(res, 200, await api.concluirPedidoLgpd(sb, { ...corpo, quem }));
  }

  return false;
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

const servidor = http.createServer(async (req, res) => {
  if (!ehLocal(req)) { res.writeHead(403); return res.end('Acesso permitido apenas da própria máquina.'); }
  if (!hostConfiavel(req)) { res.writeHead(403); return res.end('Host não permitido.'); }
  if (!origemConfiavel(req)) { res.writeHead(403); return res.end('Origem não permitida.'); }

  const url = new URL(req.url, `http://${HOST}:${PORTA}`);

  try {
    // Arquivos da interface
    if (!url.pathname.startsWith('/api/')) {
      const nome = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
      const alvo = path.join(pastaUi(), nome);
      if (!alvo.startsWith(pastaUi()) || !fs.existsSync(alvo)) {
        res.writeHead(404); return res.end('Não encontrado.');
      }
      const tipo = TIPOS[path.extname(alvo)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(alvo));
    }

    if (await rotaPublica(req, res, url) !== false) return;

    const sessao = store.lerSessao(lerCookie(req, 'udg_admin'));
    if (!sessao) return json(res, 401, { erro: 'Sessão expirada. Entre novamente.' });

    if (await rotaProtegida(req, res, url, sessao) !== false) return;

    return json(res, 404, { erro: 'Rota não encontrada.' });
  } catch (e) {
    console.error('[erro]', e);
    if (!res.headersSent) return json(res, 500, { erro: e.message || 'Erro interno.' });
    try { res.end(); } catch { /* já respondido */ }
  }
});

servidor.listen(PORTA, HOST, () => {
  const endereco = `http://${HOST}:${PORTA}`;
  console.log('');
  console.log('  ╔════════════════════════════════════════════════╗');
  console.log('  ║            UndoinG Admin  ·  v1.0.0            ║');
  console.log('  ╚════════════════════════════════════════════════╝');
  console.log('');
  console.log(`   Painel:  ${endereco}`);
  console.log(`   Dados:   ${store.pastaDeDados()}`);
  console.log('');
  console.log('   Escutando SOMENTE nesta máquina. Feche esta janela para encerrar.');
  console.log('');

  if (process.platform === 'win32') {
    execFile('cmd', ['/c', 'start', '""', endereco], () => {});
  }
});

process.on('SIGINT', () => {
  console.log('\n   Encerrado.');
  process.exit(0);
});
