/* ==========================================================================
   app.js — interface do UndoinG Admin.

   Uma página só, sem framework. As telas são funções que devolvem HTML e
   ligam seus próprios eventos. Os dados chegam por fetch; os números do topo
   chegam por um fluxo contínuo (Server-Sent Events) e se atualizam sozinhos a
   cada 10 segundos, sem recarregar nada.
   ========================================================================== */

import { grafico, spark, formatar } from './charts.js';

const $ = (s, raiz = document) => raiz.querySelector(s);
const $$ = (s, raiz = document) => [...raiz.querySelectorAll(s)];

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const quando = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return d.toLocaleDateString('pt-BR');
};

// --------------------------------------------------------------------------
// Comunicação
// --------------------------------------------------------------------------

async function api(caminho, opcoes = {}) {
  const r = await fetch(caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
  });
  if (r.status === 401) { mostrarLogin(); throw new Error('Sessão expirada.'); }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
  return dados;
}

const post = (caminho, corpo) => api(caminho, { method: 'POST', body: JSON.stringify(corpo || {}) });

// --------------------------------------------------------------------------
// Telas de entrada
// --------------------------------------------------------------------------

function mostrarConfiguracao() {
  document.body.innerHTML = `
    <div class="entrada"><div class="entrada-caixa">
      <div class="cartao">
        <h1>Primeira configuração</h1>
        <p class="legenda">Este painel roda só na sua máquina e nunca fica exposto na internet.</p>

        <div class="aviso">
          A chave <b>service_role</b> ignora todas as regras de segurança do banco e
          enxerga tudo. Ela será guardada <b>cifrada com a sua senha</b> — sem a senha,
          o arquivo salvo não serve para nada. Se você esquecer a senha, não há
          recuperação: será preciso configurar de novo.
        </div>

        <label for="url">Endereço do Supabase</label>
        <input id="url" class="campo" placeholder="https://udgservidor.online" value="https://udgservidor.online" />

        <label for="site">Endereço do site (para os testes de saúde)</label>
        <input id="site" class="campo" placeholder="https://udgservidor.online" value="https://udgservidor.online" />

        <label for="chave">Chave service_role</label>
        <input id="chave" class="campo mono" type="password" placeholder="eyJ... ou sb_secret_..." />

        <label for="senha">Crie uma senha para este painel (mínimo 10 caracteres)</label>
        <input id="senha" class="campo" type="password" autocomplete="new-password" />

        <div style="margin-top:18px">
          <button class="botao" data-tipo="primario" id="salvar">Testar conexão e salvar</button>
        </div>
        <p class="erro-msg" id="erro"></p>
      </div>
    </div></div>`;

  $('#salvar').onclick = async () => {
    const btn = $('#salvar');
    btn.disabled = true; btn.textContent = 'Testando…'; $('#erro').textContent = '';
    try {
      await post('/api/configurar', {
        supabaseUrl: $('#url').value.trim(),
        siteUrl: $('#site').value.trim(),
        serviceKey: $('#chave').value.trim(),
        senha: $('#senha').value,
      });
      mostrarLogin();
    } catch (e) {
      $('#erro').textContent = e.message;
      btn.disabled = false; btn.textContent = 'Testar conexão e salvar';
    }
  };
}

function mostrarLogin() {
  document.body.innerHTML = `
    <div class="entrada"><div class="entrada-caixa">
      <div class="cartao">
        <div class="marca" style="padding:0 0 16px">
          <div class="marca-ponto">U</div>
          <div><div class="marca-nome">UndoinG Admin</div>
          <div class="marca-sub">Painel de gestão</div></div>
        </div>
        <label for="senha">Senha do painel</label>
        <input id="senha" class="campo" type="password" autocomplete="current-password" autofocus />
        <div style="margin-top:16px">
          <button class="botao" data-tipo="primario" id="entrar">Entrar</button>
        </div>
        <p class="erro-msg" id="erro"></p>
      </div>
    </div></div>`;

  const entrar = async () => {
    $('#erro').textContent = '';
    try {
      await post('/api/login', { senha: $('#senha').value });
      iniciarPainel();
    } catch (e) { $('#erro').textContent = e.message; }
  };
  $('#entrar').onclick = entrar;
  $('#senha').onkeydown = (e) => { if (e.key === 'Enter') entrar(); };
}

// --------------------------------------------------------------------------
// Estrutura do painel
// --------------------------------------------------------------------------

const TELAS = [
  { id: 'painel', nome: 'Visão geral', icone: '◧', grupo: 'Acompanhar' },
  { id: 'saude', nome: 'Saúde do sistema', icone: '◍', grupo: 'Acompanhar' },
  { id: 'erros', nome: 'Erros do app', icone: '⚠', grupo: 'Acompanhar' },
  { id: 'usuarios', nome: 'Usuários', icone: '☺', grupo: 'Gerir' },
  { id: 'moderacao', nome: 'Moderação', icone: '⚑', grupo: 'Gerir', contador: 'denunciasAbertas' },
  { id: 'conteudo', nome: 'Conteúdo', icone: '▤', grupo: 'Gerir' },
  { id: 'lgpd', nome: 'LGPD', icone: '⚖', grupo: 'Conformidade' },
  { id: 'auditoria', nome: 'Auditoria', icone: '☰', grupo: 'Conformidade' },
];

let telaAtual = 'painel';
let fluxo = null;

function iniciarPainel() {
  const grupos = [...new Set(TELAS.map((t) => t.grupo))];
  document.body.innerHTML = `
    <div class="app">
      <nav class="lateral">
        <div class="marca">
          <div class="marca-ponto">U</div>
          <div><div class="marca-nome">UndoinG</div><div class="marca-sub">Admin · v1.0</div></div>
        </div>
        ${grupos.map((g) => `
          <div class="nav-sep">${g}</div>
          ${TELAS.filter((t) => t.grupo === g).map((t) => `
            <button class="nav-item" data-tela="${t.id}">
              <span aria-hidden="true">${t.icone}</span> ${t.nome}
              <span class="contador" data-contador="${t.contador || ''}" hidden></span>
            </button>`).join('')}
        `).join('')}
        <div style="margin-top:auto; padding-top:16px">
          <button class="nav-item" id="tema"><span aria-hidden="true">◐</span> Tema</button>
          <button class="nav-item" id="sair"><span aria-hidden="true">⏻</span> Sair</button>
        </div>
      </nav>
      <main class="principal" id="conteudo"></main>
    </div>
    <div class="gaveta-fundo" id="gaveta-fundo" hidden></div>
    <aside class="gaveta" id="gaveta" hidden></aside>`;

  $$('.nav-item[data-tela]').forEach((b) => {
    b.onclick = () => irPara(b.dataset.tela);
  });

  $('#tema').onclick = () => {
    const atual = document.documentElement.dataset.tema;
    const novo = atual === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    localStorage.setItem('udg_admin_tema', novo);
    if (telaAtual === 'painel') irPara('painel');
  };

  $('#sair').onclick = async () => {
    if (fluxo) fluxo.close();
    await post('/api/logout');
    mostrarLogin();
  };

  $('#gaveta-fundo').onclick = fecharGaveta;

  irPara('painel');
  abrirFluxo();
}

function irPara(id) {
  telaAtual = id;
  $$('.nav-item[data-tela]').forEach((b) => {
    b.setAttribute('aria-current', b.dataset.tela === id ? 'page' : 'false');
  });
  const render = {
    painel: telaPainel, saude: telaSaude, erros: telaErros,
    usuarios: telaUsuarios, moderacao: telaModeracao, conteudo: telaConteudo,
    lgpd: telaLgpd, auditoria: telaAuditoria,
  }[id];
  render();
}

function cabecalho(titulo, subtitulo, extra = '') {
  return `<header class="cabecalho">
    <div><h1>${titulo}</h1><p>${subtitulo}</p></div>
    <div style="display:flex;gap:10px;align-items:center">
      ${extra}
      <span class="aovivo"><span class="pulso" id="pulso-indicador"></span>
        <span id="pulso-texto">ao vivo</span></span>
    </div>
  </header>`;
}

const carregando = (msg = 'Carregando…') => `<p class="vazio">${msg}</p>`;

// --------------------------------------------------------------------------
// Fluxo em tempo real
// --------------------------------------------------------------------------

function abrirFluxo() {
  if (fluxo) fluxo.close();
  fluxo = new EventSource('/api/stream');

  fluxo.onmessage = (ev) => {
    let d;
    try { d = JSON.parse(ev.data); } catch { return; }

    const ind = $('#pulso-indicador');
    if (ind) ind.dataset.estado = 'on';
    const txt = $('#pulso-texto');
    if (txt) txt.textContent = `ao vivo · ${new Date(d.em).toLocaleTimeString('pt-BR')}`;

    const alvo = (sel, valor) => { const n = $(sel); if (n) n.textContent = formatar(valor); };
    alvo('#vivo-online', d.online);
    alvo('#vivo-msg1h', d.mensagens1h);
    alvo('#vivo-erros1h', d.erros1h);
    alvo('#vivo-usuarios', d.usuarios);

    const c = $('[data-contador="denunciasAbertas"]');
    if (c) {
      c.textContent = formatar(d.denunciasAbertas || 0);
      c.hidden = !d.denunciasAbertas;
    }
  };

  fluxo.onerror = () => {
    const ind = $('#pulso-indicador');
    if (ind) ind.dataset.estado = 'off';
    const txt = $('#pulso-texto');
    if (txt) txt.textContent = 'reconectando…';
  };
}

// --------------------------------------------------------------------------
// Tela: visão geral
// --------------------------------------------------------------------------

async function telaPainel() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('Visão geral', 'Os números do UndoinG, atualizando sozinhos.') + carregando();

  let d;
  try { d = await api('/api/dashboard'); }
  catch (e) { c.innerHTML = cabecalho('Visão geral', '') + `<p class="vazio">${esc(e.message)}</p>`; return; }

  const k = d.cartoes;
  const tile = (rotulo, valor, id, serie, cor, extra = '') => `
    <div class="cartao">
      <h2>${rotulo}</h2>
      <div class="tile">
        <div>
          <div class="numero" ${id ? `id="${id}"` : ''}>${formatar(valor)}</div>
          <div class="delta" data-sinal="igual">${extra}</div>
        </div>
        <div class="spark" data-spark="${serie}" data-cor="${cor}"></div>
      </div>
    </div>`;

  c.innerHTML = cabecalho('Visão geral', 'Os números do UndoinG, atualizando sozinhos.') + `
    <section class="grade grade-4" style="margin-bottom:14px">
      ${tile('Contas', k.usuarios, 'vivo-usuarios', 'usuarios', 'var(--s1)',
    `+${formatar(k.usuarios24h ?? 0)} em 24 h · +${formatar(k.usuarios7d ?? 0)} em 7 dias`)}
      ${tile('Publicações', k.posts, null, 'posts', 'var(--s2)',
    `+${formatar(k.posts24h ?? 0)} em 24 h`)}
      <div class="cartao">
        <h2>Pessoas online agora</h2>
        <div class="numero" id="vivo-online">—</div>
        <div class="delta" data-sinal="igual">vistas nos últimos 5 minutos</div>
      </div>
      <div class="cartao">
        <h2>Mensagens na última hora</h2>
        <div class="numero" id="vivo-msg1h">—</div>
        <div class="delta" data-sinal="igual">${formatar(k.mensagens24h ?? 0)} nas últimas 24 h</div>
      </div>
    </section>

    <section class="grade grade-4" style="margin-bottom:20px">
      <div class="cartao">
        <h2>Denúncias abertas</h2>
        <div class="numero">${formatar(k.denunciasAbertas ?? 0)}</div>
        <div class="delta" data-sinal="${k.denunciasAbertas ? 'desce' : 'igual'}">
          ${k.denunciasAbertas ? 'esperando análise' : 'nada na fila'}</div>
      </div>
      <div class="cartao">
        <h2>Aguardando moderação</h2>
        <div class="numero">${formatar(k.pendentesModeracao ?? 0)}</div>
        <div class="delta" data-sinal="igual">mídia marcada como "revisar"</div>
      </div>
      <div class="cartao">
        <h2>Erros na última hora</h2>
        <div class="numero" id="vivo-erros1h">—</div>
        <div class="delta" data-sinal="igual">${formatar(k.erros24h ?? 0)} nas últimas 24 h</div>
      </div>
      <div class="cartao">
        <h2>Pedidos LGPD abertos</h2>
        <div class="numero">${formatar(k.lgpdAbertos ?? 0)}</div>
        <div class="delta" data-sinal="igual">prazo legal: 15 dias</div>
      </div>
    </section>

    <section class="grade grade-2">
      <div class="cartao">
        <h2>Novas contas por dia</h2>
        <p class="legenda">Últimos 30 dias</p>
        <div data-grafico="usuarios"></div>
      </div>
      <div class="cartao">
        <h2>Publicações por dia</h2>
        <p class="legenda">Últimos 30 dias</p>
        <div data-grafico="posts"></div>
      </div>
      <div class="cartao">
        <h2>Mensagens por dia</h2>
        <p class="legenda">Últimos 14 dias</p>
        <div data-grafico="mensagens"></div>
      </div>
      <div class="cartao">
        <h2>Erros do aplicativo por dia</h2>
        <p class="legenda">Últimos 14 dias · quanto mais baixo, melhor</p>
        <div data-grafico="erros"></div>
      </div>
    </section>`;

  const cores = { usuarios: 'var(--s1)', posts: 'var(--s2)', mensagens: 'var(--s3)', erros: 'var(--s4)' };
  const unidades = { usuarios: 'contas', posts: 'publicações', mensagens: 'mensagens', erros: 'erros' };

  for (const [nome, serie] of Object.entries(d.series)) {
    const alvo = $(`[data-grafico="${nome}"]`);
    if (!alvo) continue;
    if (!serie) { alvo.innerHTML = '<p class="vazio">Tabela não encontrada neste banco.</p>'; continue; }
    grafico(alvo, serie, {
      cor: cores[nome], titulo: nome, unidade: unidades[nome],
      forma: nome === 'erros' ? 'barras' : 'area',
    });
  }

  $$('[data-spark]').forEach((n) => {
    const s = d.series[n.dataset.spark];
    if (s) spark(n, s, n.dataset.cor);
  });
}

// --------------------------------------------------------------------------
// Tela: saúde
// --------------------------------------------------------------------------

async function telaSaude() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('Saúde do sistema', 'Testa o site, as funções e o banco agora.',
    '<button class="botao" id="recheca">Verificar de novo</button>') + carregando('Verificando…');

  let d;
  try { d = await api('/api/saude'); }
  catch (e) { c.querySelector('.vazio').textContent = e.message; return; }

  const linhas = d.itens.map((i) => `
    <tr>
      <td>${esc(i.nome)}</td>
      <td><span class="etiqueta" data-estado="${i.ok ? 'bom' : 'grave'}">
        ${i.ok ? '● no ar' : '● fora do ar'}</span></td>
      <td class="num">${i.status || '—'}</td>
      <td class="num">${i.ms} ms</td>
      <td class="mono trunc">${esc(i.erro || i.url || '')}</td>
    </tr>`).join('');

  c.querySelector('.vazio').outerHTML = `
    <div class="cartao"><div class="tabela-wrap"><table>
      <thead><tr><th>Serviço</th><th>Estado</th><th>HTTP</th><th>Resposta</th><th>Detalhe</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div></div>`;

  $('#recheca').onclick = telaSaude;
}

// --------------------------------------------------------------------------
// Tela: erros
// --------------------------------------------------------------------------

async function telaErros() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('Erros do aplicativo', 'O que quebrou na mão dos usuários.',
    `<select class="campo" id="janela" style="width:auto">
      <option value="1">última hora</option>
      <option value="24" selected>últimas 24 h</option>
      <option value="168">últimos 7 dias</option>
    </select>`) + carregando();

  const carregar = async () => {
    const horas = $('#janela').value;
    try {
      const d = await api(`/api/erros?horas=${horas}`);
      const alvo = $('.vazio') || $('#lista-erros');
      if (d.indisponivel) {
        alvo.outerHTML = `<div class="cartao" id="lista-erros">
          <p class="vazio">${esc(d.dica)}</p></div>`;
        return;
      }
      alvo.outerHTML = `
        <div class="cartao" id="lista-erros">
          <h2>Agrupados por mensagem</h2>
          <p class="legenda">${formatar(d.total)} ocorrências no período · os mais frequentes primeiro</p>
          <div class="tabela-wrap"><table>
            <thead><tr><th>Vezes</th><th>Mensagem</th><th>Rota</th><th>Último</th></tr></thead>
            <tbody>${d.grupos.length ? d.grupos.map((g) => `
              <tr>
                <td class="num"><b>${formatar(g.vezes)}</b></td>
                <td class="trunc" title="${esc(g.mensagem)}">${esc(g.mensagem)}</td>
                <td class="mono">${esc(g.rota || '—')}</td>
                <td>${quando(g.ultimo)}</td>
              </tr>`).join('')
        : '<tr><td colspan="4" class="vazio">Nenhum erro no período. Boa notícia.</td></tr>'}
            </tbody>
          </table></div>
        </div>`;
    } catch (e) {
      const alvo = $('.vazio') || $('#lista-erros');
      alvo.outerHTML = `<div class="cartao" id="lista-erros"><p class="vazio">${esc(e.message)}</p></div>`;
    }
  };

  $('#janela').onchange = carregar;
  carregar();
}

// --------------------------------------------------------------------------
// Tela: usuários
// --------------------------------------------------------------------------

async function telaUsuarios() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('Usuários', 'Buscar, inspecionar e agir sobre contas.') + `
    <div class="barra-acoes">
      <input class="campo" id="busca" placeholder="Buscar por @usuário ou nome…" style="max-width:340px" />
      <button class="botao" id="buscar">Buscar</button>
    </div>
    <div class="cartao" id="lista">${carregando()}</div>`;

  const carregar = async () => {
    $('#lista').innerHTML = carregando();
    try {
      const d = await api(`/api/usuarios?busca=${encodeURIComponent($('#busca').value.trim())}`);
      if (d.indisponivel) { $('#lista').innerHTML = '<p class="vazio">Tabela profiles não encontrada.</p>'; return; }
      $('#lista').innerHTML = `
        <div class="tabela-wrap"><table>
          <thead><tr><th>Usuário</th><th>Entrou</th><th>Visto</th><th>Situação</th><th></th></tr></thead>
          <tbody>${d.linhas.length ? d.linhas.map((u) => `
            <tr>
              <td>
                <div><b>${esc(u.full_name || u.username || 'sem nome')}</b></div>
                <div class="mono" style="color:var(--texto-3)">@${esc(u.username || '—')}</div>
              </td>
              <td>${quando(u.created_at)}</td>
              <td>${quando(u.last_seen)}</td>
              <td>
                ${u.is_banned ? '<span class="etiqueta" data-estado="grave">banido</span>' : ''}
                ${u.is_adult_verified ? '<span class="etiqueta" data-estado="bom">18+ verificado</span>'
              : '<span class="etiqueta" data-estado="atencao">sem verificação</span>'}
                ${u.pq_ativo ? '<span class="etiqueta">🔐 PQ</span>' : ''}
              </td>
              <td><button class="botao botao-mini" data-ver="${esc(u.id)}">Abrir</button></td>
            </tr>`).join('')
          : '<tr><td colspan="5" class="vazio">Nenhum usuário encontrado.</td></tr>'}
          </tbody>
        </table></div>`;
      $$('[data-ver]').forEach((b) => { b.onclick = () => abrirUsuario(b.dataset.ver); });
    } catch (e) {
      $('#lista').innerHTML = `<p class="vazio">${esc(e.message)}</p>`;
    }
  };

  $('#buscar').onclick = carregar;
  $('#busca').onkeydown = (e) => { if (e.key === 'Enter') carregar(); };
  carregar();
}

// --------------------------------------------------------------------------
// Gaveta de detalhe do usuário
// --------------------------------------------------------------------------

function fecharGaveta() {
  $('#gaveta').hidden = true;
  $('#gaveta-fundo').hidden = true;
}

async function abrirUsuario(id) {
  const g = $('#gaveta');
  g.hidden = false; $('#gaveta-fundo').hidden = false;
  g.innerHTML = carregando();

  let d;
  try { d = await api(`/api/usuarios/${id}`); }
  catch (e) { g.innerHTML = `<p class="vazio">${esc(e.message)}</p>`; return; }

  const p = d.perfil;
  const par = (a, b) => `<div class="par"><span>${a}</span><span>${esc(b ?? '—')}</span></div>`;

  g.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
      <div>
        <h2 style="margin:0">${esc(p.full_name || p.username || 'sem nome')}</h2>
        <p class="mono" style="color:var(--texto-3);margin:2px 0 0">@${esc(p.username || '—')}</p>
      </div>
      <button class="botao botao-mini" id="fechar">Fechar</button>
    </div>

    <div style="margin:18px 0">
      ${par('Identificador', p.id)}
      ${par('Entrou em', p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '—')}
      ${par('Visto pela última vez', quando(p.last_seen))}
      ${par('Verificação 18+', p.is_adult_verified ? 'verificado' : 'não verificado')}
      ${par('Banido', p.is_banned ? 'sim' : 'não')}
      ${par('Publicações', formatar(d.contagens.posts))}
      ${par('Mensagens', formatar(d.contagens.mensagens))}
      ${par('Denúncias recebidas', formatar(d.contagens.denuncias))}
    </div>

    <h2 style="font-size:13px;color:var(--texto-2)">Moderação</h2>
    <div class="barra-acoes">
      <button class="botao" data-acao="${p.is_banned ? 'desbanir' : 'banir'}">
        ${p.is_banned ? 'Desbanir conta' : 'Banir conta'}</button>
      <button class="botao" data-acao="${p.is_adult_verified ? 'revogar_verificacao' : 'verificar_idade'}">
        ${p.is_adult_verified ? 'Revogar verificação 18+' : 'Marcar como verificado'}</button>
    </div>

    <h2 style="font-size:13px;color:var(--texto-2);margin-top:22px">Direitos do titular (LGPD)</h2>
    <div class="aviso">
      A exportação traz tudo o que o banco tem sobre esta pessoa. As mensagens
      privadas saem cifradas — a chave está no aparelho dela, e nem o servidor abre.
    </div>
    <div class="barra-acoes">
      <a class="botao" href="/api/usuarios/${esc(id)}/exportar" download>Exportar dados (JSON)</a>
      <button class="botao" data-tipo="perigo" id="excluir">Excluir conta e dados</button>
    </div>`;

  $('#fechar').onclick = fecharGaveta;

  $$('[data-acao]', g).forEach((b) => {
    b.onclick = async () => {
      const motivo = prompt('Motivo (fica registrado na auditoria):');
      if (motivo === null) return;
      try {
        await post(`/api/usuarios/${id}/acao`, { acao: b.dataset.acao, motivo });
        abrirUsuario(id);
      } catch (e) { alert(e.message); }
    };
  });

  $('#excluir').onclick = async () => {
    if (!confirm('Isto apaga a conta e os dados. A ação não pode ser desfeita.\n\nConfirmar?')) return;
    const motivo = prompt('Motivo (obrigatório para a auditoria):');
    if (!motivo) return;
    try {
      const r = await post(`/api/usuarios/${id}/excluir`, { motivo });
      alert(r.aviso || 'Conta removida.');
      fecharGaveta();
      irPara('usuarios');
    } catch (e) { alert(e.message); }
  };
}

// --------------------------------------------------------------------------
// Tela: moderação
// --------------------------------------------------------------------------

async function telaModeracao() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('Moderação', 'Fila automática e denúncias de usuários.') + carregando();

  let d;
  try { d = await api('/api/moderacao'); }
  catch (e) { $('.vazio').textContent = e.message; return; }

  const linhaAuto = (r) => `
    <tr>
      <td>${quando(r.created_at)}</td>
      <td>${esc(r.content_type || '—')}</td>
      <td class="trunc">${esc(r.text_content || r.media_url || '—')}</td>
      <td><span class="etiqueta" data-estado="${r.severity === 'critical' || r.severity === 'high' ? 'grave' : 'atencao'}">${esc(r.severity || '—')}</span></td>
      <td>
        <button class="botao botao-mini" data-dec="manter" data-tipo-item="automatica" data-id="${esc(r.id)}">Manter</button>
        <button class="botao botao-mini" data-tipo="perigo" data-dec="remover" data-tipo-item="automatica" data-id="${esc(r.id)}">Remover</button>
      </td>
    </tr>`;

  const linhaDen = (r) => `
    <tr>
      <td>${quando(r.created_at)}</td>
      <td>${esc(r.reason || r.motivo || '—')}</td>
      <td class="mono trunc">${esc(r.post_id || r.reported_user_id || '—')}</td>
      <td><span class="etiqueta" data-estado="${r.status === 'pending' ? 'atencao' : 'bom'}">${esc(r.status || '—')}</span></td>
      <td>
        <button class="botao botao-mini" data-dec="manter" data-tipo-item="denuncia" data-id="${esc(r.id)}">Arquivar</button>
        <button class="botao botao-mini" data-tipo="perigo" data-dec="remover" data-tipo-item="denuncia" data-id="${esc(r.id)}">Acolher</button>
      </td>
    </tr>`;

  const bloco = (titulo, legenda, dados, cabs, render) => `
    <div class="cartao" style="margin-bottom:16px">
      <h2>${titulo}</h2>
      <p class="legenda">${legenda}</p>
      ${!dados.tabela
    ? '<p class="vazio">Esta tabela não existe neste banco.</p>'
    : `<div class="tabela-wrap"><table>
            <thead><tr>${cabs.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${dados.linhas.length ? dados.linhas.map(render).join('')
      : `<tr><td colspan="${cabs.length}" class="vazio">Nada na fila.</td></tr>`}</tbody>
          </table></div>`}
    </div>`;

  $('.vazio').outerHTML = `
    <div class="aviso">
      A Política de Moderação publicada promete <b>24 horas</b> para casos com menores,
      imagem íntima ou risco à vida, e <b>48 horas</b> para ameaça e assédio. Os prazos
      contam a partir da denúncia.
    </div>
    ${bloco('Aguardando revisão humana',
    'Conteúdo que a análise automática não conseguiu decidir. Enquanto está aqui, fica restrito.',
    d.automatica, ['Quando', 'Tipo', 'Conteúdo', 'Gravidade', 'Decisão'], linhaAuto)}
    ${bloco('Denúncias de usuários', 'Enviadas pelo botão de denúncia do aplicativo.',
      d.denuncias, ['Quando', 'Motivo', 'Alvo', 'Situação', 'Decisão'], linhaDen)}`;

  $$('[data-dec]').forEach((b) => {
    b.onclick = async () => {
      const motivo = prompt('Motivo da decisão (fica registrado):');
      if (motivo === null) return;
      try {
        await post('/api/moderacao/decidir', {
          tipo: b.dataset.tipoItem, id: b.dataset.id, decisao: b.dataset.dec, motivo,
        });
        telaModeracao();
      } catch (e) { alert(e.message); }
    };
  });
}

// --------------------------------------------------------------------------
// Tela: conteúdo
// --------------------------------------------------------------------------

async function telaConteudo() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('Conteúdo', 'Publicações e comunidades mais recentes.') + carregando();

  let d;
  try { d = await api('/api/conteudo'); }
  catch (e) { $('.vazio').textContent = e.message; return; }

  $('.vazio').outerHTML = `
    <div class="cartao" style="margin-bottom:16px">
      <h2>Publicações recentes</h2>
      <p class="legenda">As 40 mais novas</p>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Quando</th><th>Texto</th><th>Mídia</th><th>Aprovado</th><th></th></tr></thead>
        <tbody>${d.posts.length ? d.posts.map((p) => `
          <tr>
            <td>${quando(p.created_at)}</td>
            <td class="trunc" title="${esc(p.content)}">${esc(p.content || '—')}</td>
            <td class="num">${(p.media_urls || []).length}</td>
            <td>${p.is_community_approved
    ? '<span class="etiqueta" data-estado="bom">sim</span>'
    : '<span class="etiqueta" data-estado="atencao">em votação</span>'}</td>
            <td><button class="botao botao-mini" data-tipo="perigo" data-rm="${esc(p.id)}">Remover</button></td>
          </tr>`).join('') : '<tr><td colspan="5" class="vazio">Sem publicações.</td></tr>'}
        </tbody>
      </table></div>
    </div>

    <div class="cartao">
      <h2>Comunidades</h2>
      <p class="legenda">As 40 mais novas</p>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Nome</th><th>Criada</th></tr></thead>
        <tbody>${d.comunidades.length ? d.comunidades.map((x) => `
          <tr><td>${esc(x.name)}</td><td>${quando(x.created_at)}</td></tr>`).join('')
    : '<tr><td colspan="2" class="vazio">Sem comunidades.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  $$('[data-rm]').forEach((b) => {
    b.onclick = async () => {
      const motivo = prompt('Motivo da remoção (fica registrado):');
      if (!motivo) return;
      try { await post('/api/conteudo/remover-post', { id: b.dataset.rm, motivo }); telaConteudo(); }
      catch (e) { alert(e.message); }
    };
  });
}

// --------------------------------------------------------------------------
// Tela: LGPD
// --------------------------------------------------------------------------

async function telaLgpd() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('LGPD', 'Pedidos dos titulares e o prazo de cada um.',
    '<button class="botao" data-tipo="primario" id="novo">Registrar pedido</button>') + carregando();

  let d;
  try { d = await api('/api/lgpd'); }
  catch (e) { $('.vazio').textContent = e.message; return; }

  const prazoEtiqueta = (p) => {
    if (p.status === 'concluido') return '<span class="etiqueta" data-estado="bom">concluído</span>';
    const dias = Math.ceil((new Date(p.prazo_em) - Date.now()) / 86400000);
    if (dias < 0) return `<span class="etiqueta" data-estado="grave">vencido há ${-dias} d</span>`;
    if (dias <= 3) return `<span class="etiqueta" data-estado="grave">${dias} d restantes</span>`;
    if (dias <= 7) return `<span class="etiqueta" data-estado="atencao">${dias} d restantes</span>`;
    return `<span class="etiqueta">${dias} d restantes</span>`;
  };

  $('.vazio').outerHTML = d.indisponivel
    ? `<div class="cartao"><p class="vazio">A tabela <b>lgpd_requests</b> ainda não existe.
        Rode <span class="mono">ADMIN/sql/admin_tables.sql</span> no SQL Editor do Supabase.</p></div>`
    : `<div class="aviso">
         O art. 19 da LGPD dá <b>15 dias</b> para responder a um pedido de acesso.
         Pedidos vencidos aparecem em vermelho.
       </div>
       <div class="cartao"><div class="tabela-wrap"><table>
        <thead><tr><th>Aberto</th><th>Titular</th><th>Tipo</th><th>Prazo</th><th>Situação</th><th></th></tr></thead>
        <tbody>${d.linhas.length ? d.linhas.map((p) => `
          <tr>
            <td>${quando(p.criado_em)}</td>
            <td class="mono trunc">${esc(p.user_id)}</td>
            <td>${esc(p.tipo)}</td>
            <td>${prazoEtiqueta(p)}</td>
            <td>${esc(p.status)}</td>
            <td>${p.status !== 'concluido'
      ? `<button class="botao botao-mini" data-concluir="${esc(p.id)}">Concluir</button>` : ''}</td>
          </tr>`).join('') : '<tr><td colspan="6" class="vazio">Nenhum pedido registrado.</td></tr>'}
        </tbody>
       </table></div></div>`;

  const btnNovo = $('#novo');
  if (btnNovo) {
    btnNovo.onclick = async () => {
      const userId = prompt('Identificador (UUID) do titular:');
      if (!userId) return;
      const tipo = prompt('Tipo: acesso, portabilidade, correcao, exclusao ou revogacao', 'acesso');
      if (!tipo) return;
      try { await post('/api/lgpd', { userId, tipo, observacao: '' }); telaLgpd(); }
      catch (e) { alert(e.message); }
    };
  }

  $$('[data-concluir]').forEach((b) => {
    b.onclick = async () => {
      const resultado = prompt('O que foi feito (fica registrado):');
      if (!resultado) return;
      try { await post('/api/lgpd/concluir', { id: b.dataset.concluir, resultado }); telaLgpd(); }
      catch (e) { alert(e.message); }
    };
  });
}

// --------------------------------------------------------------------------
// Tela: auditoria
// --------------------------------------------------------------------------

async function telaAuditoria() {
  const c = $('#conteudo');
  c.innerHTML = cabecalho('Auditoria', 'Tudo o que foi feito por este painel.') + carregando();

  let d;
  try { d = await api('/api/auditoria'); }
  catch (e) { $('.vazio').textContent = e.message; return; }

  $('.vazio').outerHTML = `
    <div class="aviso">
      Este registro é o que permite responder a um recurso de usuário ou a um
      pedido da ANPD: quem fez, o quê, quando e por quê. Fica em
      <span class="mono">dados/auditoria.jsonl</span>, ao lado do programa.
    </div>
    <div class="cartao"><div class="tabela-wrap"><table>
      <thead><tr><th>Quando</th><th>Ação</th><th>Alvo</th><th>Motivo</th></tr></thead>
      <tbody>${d.linhas.length ? d.linhas.map((l) => `
        <tr>
          <td>${new Date(l.em).toLocaleString('pt-BR')}</td>
          <td class="mono">${esc(l.acao)}</td>
          <td class="mono trunc">${esc(l.alvo || l.pedido || '—')}</td>
          <td class="trunc">${esc(l.motivo || l.resultado || '—')}</td>
        </tr>`).join('') : '<tr><td colspan="4" class="vazio">Nada registrado ainda.</td></tr>'}
      </tbody>
    </table></div></div>`;
}

// --------------------------------------------------------------------------
// Arranque
// --------------------------------------------------------------------------

(async function inicio() {
  const tema = localStorage.getItem('udg_admin_tema');
  if (tema) document.documentElement.dataset.tema = tema;

  try {
    const e = await fetch('/api/estado').then((r) => r.json());
    if (!e.configurado) return mostrarConfiguracao();
    if (!e.autenticado) return mostrarLogin();
    iniciarPainel();
  } catch {
    document.body.innerHTML = '<div class="entrada"><p class="vazio">Não consegui falar com o servidor local. Feche e abra o programa de novo.</p></div>';
  }
})();
