/**
 * =============================================================================
 * lib/store.js — Configuração criptografada, sessões e trilha de auditoria.
 *
 * A decisão de segurança central deste programa está aqui.
 *
 * O painel precisa da chave `service_role` do Supabase — a chave que ignora
 * todas as regras de RLS e enxerga o banco inteiro. Guardá-la em texto puro num
 * arquivo seria repetir o erro que já custou caro neste projeto.
 *
 * Então ela nunca é gravada em claro. O que fica no disco é o resultado de:
 *
 *     chave_de_cofre = scrypt(senha_do_admin, salt)
 *     arquivo        = AES-256-GCM(service_role, chave_de_cofre)
 *
 * Consequência prática: sem a sua senha, o arquivo `config.local.json` não
 * serve para nada — nem para quem copiar a pasta inteira, nem para um programa
 * malicioso que leia seus arquivos. A chave só existe em memória, e só enquanto
 * você estiver com a sessão aberta.
 *
 * Se você esquecer a senha, não há recuperação: apague o config.local.json e
 * configure de novo com a chave do painel do Supabase. Isso é uma propriedade
 * do desenho, não um defeito.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/** Onde os dados ficam: ao lado do .exe, não dentro dele. */
function pastaDeDados() {
  const base = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
  const dir = path.join(base, 'dados');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const ARQ_CONFIG = () => path.join(pastaDeDados(), 'config.local.json');
const ARQ_AUDIT = () => path.join(pastaDeDados(), 'auditoria.jsonl');

// ---------------------------------------------------------------------------
// Criptografia
// ---------------------------------------------------------------------------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 32 };

function derivarChave(senha, salt) {
  return crypto.scryptSync(senha, salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
  });
}

function cifrar(texto, chave) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return {
    iv: iv.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
    dados: dados.toString('base64'),
  };
}

function decifrar(pacote, chave) {
  const d = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(pacote.iv, 'base64'));
  d.setAuthTag(Buffer.from(pacote.tag, 'base64'));
  return Buffer.concat([
    d.update(Buffer.from(pacote.dados, 'base64')),
    d.final(),
  ]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

function lerConfig() {
  try {
    return JSON.parse(fs.readFileSync(ARQ_CONFIG(), 'utf8'));
  } catch {
    return null;
  }
}

function estaConfigurado() {
  const c = lerConfig();
  return Boolean(c && c.cofre && c.salt);
}

/**
 * Primeira execução: define a senha do admin e guarda a service_role cifrada.
 */
function configurar({ senha, supabaseUrl, serviceKey, siteUrl }) {
  if (!senha || senha.length < 10) {
    throw new Error('A senha precisa ter pelo menos 10 caracteres.');
  }
  if (!/^https?:\/\//.test(supabaseUrl || '')) {
    throw new Error('Endereço do Supabase inválido.');
  }
  if (!serviceKey || serviceKey.length < 20) {
    throw new Error('Chave service_role inválida.');
  }

  const salt = crypto.randomBytes(16);
  const chave = derivarChave(senha, salt);

  const config = {
    versao: 1,
    criadoEm: new Date().toISOString(),
    salt: salt.toString('base64'),
    // Serve só para saber se a senha digitada está certa, sem guardar a senha.
    verificador: cifrar('undoing-admin-ok', chave),
    cofre: cifrar(JSON.stringify({ serviceKey }), chave),
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    siteUrl: (siteUrl || '').replace(/\/$/, ''),
  };

  fs.writeFileSync(ARQ_CONFIG(), JSON.stringify(config, null, 2), { mode: 0o600 });
  return true;
}

/**
 * Abre o cofre com a senha. Devolve a configuração destravada ou null.
 */
function destravar(senha) {
  const c = lerConfig();
  if (!c) return null;
  try {
    const chave = derivarChave(senha, Buffer.from(c.salt, 'base64'));
    if (decifrar(c.verificador, chave) !== 'undoing-admin-ok') return null;
    const cofre = JSON.parse(decifrar(c.cofre, chave));
    return {
      serviceKey: cofre.serviceKey,
      supabaseUrl: c.supabaseUrl,
      siteUrl: c.siteUrl,
    };
  } catch {
    return null;
  }
}

/** Troca a senha reescrevendo o cofre — a service_role continua a mesma. */
function trocarSenha(senhaAtual, senhaNova) {
  const aberto = destravar(senhaAtual);
  if (!aberto) throw new Error('Senha atual incorreta.');
  return configurar({
    senha: senhaNova,
    supabaseUrl: aberto.supabaseUrl,
    serviceKey: aberto.serviceKey,
    siteUrl: aberto.siteUrl,
  });
}

// ---------------------------------------------------------------------------
// Sessões (em memória — fecham junto com o programa, de propósito)
// ---------------------------------------------------------------------------

const sessoes = new Map();
const DURACAO_SESSAO = 8 * 60 * 60 * 1000; // 8 horas

function criarSessao(dados) {
  const token = crypto.randomBytes(32).toString('base64url');
  sessoes.set(token, { ...dados, expiraEm: Date.now() + DURACAO_SESSAO });
  return token;
}

function lerSessao(token) {
  if (!token) return null;
  const s = sessoes.get(token);
  if (!s) return null;
  if (Date.now() > s.expiraEm) {
    sessoes.delete(token);
    return null;
  }
  return s;
}

function encerrarSessao(token) {
  sessoes.delete(token);
}

// ---------------------------------------------------------------------------
// Auditoria — o que o administrador fez
// ---------------------------------------------------------------------------

/**
 * Toda ação que muda alguma coisa passa por aqui. Isso não é burocracia: sem
 * registro de quem removeu o quê e quando, você não consegue responder a um
 * recurso de usuário nem a um pedido da ANPD.
 *
 * Formato JSONL (uma linha por evento) porque é à prova de corrupção: um
 * arquivo cortado no meio ainda tem todas as linhas anteriores legíveis.
 */
function registrar(acao, detalhes = {}) {
  const linha = JSON.stringify({
    em: new Date().toISOString(),
    acao,
    ...detalhes,
  });
  try {
    fs.appendFileSync(ARQ_AUDIT(), linha + '\n');
  } catch (e) {
    console.error('[auditoria] falha ao gravar:', e.message);
  }
}

function lerAuditoria(limite = 300) {
  try {
    const linhas = fs.readFileSync(ARQ_AUDIT(), 'utf8').trim().split('\n');
    return linhas
      .slice(-limite)
      .reverse()
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  pastaDeDados,
  estaConfigurado,
  configurar,
  destravar,
  trocarSenha,
  criarSessao,
  lerSessao,
  encerrarSessao,
  registrar,
  lerAuditoria,
};
