/* ==========================================================================
   charts.js — gráficos em SVG puro, sem biblioteca externa.

   Por que escrever à mão em vez de carregar uma biblioteca: este painel roda
   offline, dentro de um .exe, e segura a chave mestra do sistema. Cada script
   de terceiro seria mais uma dependência para auditar. São três formas apenas
   — área, barras e minigráfico — e todas cabem em poucas linhas.

   Regras seguidas (as mesmas de qualquer gráfico bem feito):
     • uma série por gráfico, com o título nomeando o que é — cor nunca é a
       única forma de identificar;
     • o último valor sempre aparece escrito, não só desenhado;
     • marcas finas, grade discreta, sem terceira dimensão, sem eixo duplo;
     • camada de interação por padrão: cruz de mira e balão ao passar o mouse.
   ========================================================================== */

const NS = 'http://www.w3.org/2000/svg';

function el(nome, atributos = {}) {
  const n = document.createElementNS(NS, nome);
  for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, v);
  return n;
}

function formatar(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function dataCurta(iso) {
  const [, m, d] = String(iso).split('-');
  return `${d}/${m}`;
}

// --------------------------------------------------------------------------
// Balão de informação (um só, reaproveitado por todos os gráficos)
// --------------------------------------------------------------------------

let balao;
function mostrarBalao(html, x, y) {
  if (!balao) {
    balao = document.createElement('div');
    balao.className = 'dica';
    document.body.appendChild(balao);
  }
  balao.innerHTML = html;
  balao.hidden = false;
  const r = balao.getBoundingClientRect();
  const esq = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
  balao.style.left = `${esq}px`;
  balao.style.top = `${Math.max(8, y - r.height - 12)}px`;
}
function esconderBalao() { if (balao) balao.hidden = true; }

// --------------------------------------------------------------------------
// Gráfico de área — para evolução no tempo
// --------------------------------------------------------------------------

export function grafico(container, dados, opcoes = {}) {
  const {
    cor = 'var(--s1)',
    titulo = '',
    unidade = '',
    forma = 'area',
  } = opcoes;

  container.innerHTML = '';
  if (!dados || !dados.length) {
    container.innerHTML = '<p class="vazio">Sem dados para o período.</p>';
    return;
  }

  const L = 640, A = 190;
  const M = { cima: 16, direita: 44, baixo: 24, esquerda: 40 };
  const larg = L - M.esquerda - M.direita;
  const alt = A - M.cima - M.baixo;

  const maximo = Math.max(1, ...dados.map((d) => d.valor));
  const x = (i) => M.esquerda + (dados.length === 1 ? larg / 2 : (i / (dados.length - 1)) * larg);
  const y = (v) => M.cima + alt - (v / maximo) * alt;

  const svg = el('svg', {
    class: 'grafico', viewBox: `0 0 ${L} ${A}`,
    preserveAspectRatio: 'none', role: 'img',
    'aria-label': `${titulo}: ${dados.length} dias, máximo ${maximo}`,
  });

  // --- grade horizontal, recessiva ---
  for (let i = 0; i <= 2; i++) {
    const v = (maximo / 2) * i;
    svg.appendChild(el('line', {
      class: 'grade-linha', x1: M.esquerda, x2: M.esquerda + larg,
      y1: y(v), y2: y(v),
    }));
    const t = el('text', { class: 'rotulo', x: M.esquerda - 7, y: y(v) + 3.5, 'text-anchor': 'end' });
    t.textContent = formatar(Math.round(v));
    svg.appendChild(t);
  }

  if (forma === 'barras') {
    const largBarra = Math.max(2, (larg / dados.length) * 0.62);
    dados.forEach((d, i) => {
      const h = Math.max(d.valor > 0 ? 2 : 0, (d.valor / maximo) * alt);
      svg.appendChild(el('rect', {
        x: x(i) - largBarra / 2, y: M.cima + alt - h,
        width: largBarra, height: h, rx: 3, fill: cor,
      }));
    });
  } else {
    const linha = dados.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.valor)}`).join(' ');
    const area = `${linha} L${x(dados.length - 1)},${M.cima + alt} L${x(0)},${M.cima + alt} Z`;

    const grad = `g-${Math.random().toString(36).slice(2, 8)}`;
    const defs = el('defs');
    const lg = el('linearGradient', { id: grad, x1: '0', y1: '0', x2: '0', y2: '1' });
    lg.appendChild(el('stop', { offset: '0%', 'stop-color': cor, 'stop-opacity': '.22' }));
    lg.appendChild(el('stop', { offset: '100%', 'stop-color': cor, 'stop-opacity': '0' }));
    defs.appendChild(lg);
    svg.appendChild(defs);

    svg.appendChild(el('path', { d: area, fill: `url(#${grad})` }));
    svg.appendChild(el('path', {
      d: linha, fill: 'none', stroke: cor, 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));
  }

  // --- eixo de baixo ---
  svg.appendChild(el('line', {
    class: 'eixo', x1: M.esquerda, x2: M.esquerda + larg,
    y1: M.cima + alt, y2: M.cima + alt,
  }));

  const primeiro = el('text', { class: 'rotulo', x: M.esquerda, y: A - 6 });
  primeiro.textContent = dataCurta(dados[0].data);
  svg.appendChild(primeiro);

  const ultimo = el('text', { class: 'rotulo', x: M.esquerda + larg, y: A - 6, 'text-anchor': 'end' });
  ultimo.textContent = dataCurta(dados[dados.length - 1].data);
  svg.appendChild(ultimo);

  // --- último valor escrito (identidade sem depender de cor) ---
  const fim = dados[dados.length - 1];
  svg.appendChild(el('circle', {
    class: 'marcador', cx: x(dados.length - 1), cy: y(fim.valor), r: 4, fill: cor,
  }));
  const rotuloFim = el('text', {
    class: 'rotulo-valor', x: x(dados.length - 1) + 8, y: y(fim.valor) + 4,
  });
  rotuloFim.textContent = formatar(fim.valor);
  svg.appendChild(rotuloFim);

  // --- camada de interação ---
  const mira = el('line', {
    class: 'grade-linha', y1: M.cima, y2: M.cima + alt,
    x1: 0, x2: 0, opacity: 0,
  });
  svg.appendChild(mira);
  const ponto = el('circle', { class: 'marcador', r: 5, fill: cor, opacity: 0 });
  svg.appendChild(ponto);

  const area = el('rect', {
    x: M.esquerda, y: M.cima, width: larg, height: alt,
    fill: 'transparent', style: 'cursor:crosshair',
  });
  svg.appendChild(area);

  area.addEventListener('mousemove', (ev) => {
    const caixa = svg.getBoundingClientRect();
    const rel = ((ev.clientX - caixa.left) / caixa.width) * L;
    const i = Math.round(((rel - M.esquerda) / larg) * (dados.length - 1));
    const idx = Math.min(dados.length - 1, Math.max(0, i));
    const d = dados[idx];

    mira.setAttribute('x1', x(idx));
    mira.setAttribute('x2', x(idx));
    mira.setAttribute('opacity', 1);
    ponto.setAttribute('cx', x(idx));
    ponto.setAttribute('cy', y(d.valor));
    ponto.setAttribute('opacity', 1);

    mostrarBalao(
      `${dataCurta(d.data)} · <b>${formatar(d.valor)}</b> ${unidade}`,
      ev.clientX, ev.clientY,
    );
  });

  area.addEventListener('mouseleave', () => {
    mira.setAttribute('opacity', 0);
    ponto.setAttribute('opacity', 0);
    esconderBalao();
  });

  container.appendChild(svg);
}

// --------------------------------------------------------------------------
// Minigráfico — cabe dentro de um cartão de número
// --------------------------------------------------------------------------

export function spark(container, dados, cor = 'var(--s1)') {
  container.innerHTML = '';
  if (!dados || dados.length < 2) return;

  const L = 84, A = 34, p = 3;
  const maximo = Math.max(1, ...dados.map((d) => d.valor));
  const x = (i) => p + (i / (dados.length - 1)) * (L - p * 2);
  const y = (v) => A - p - (v / maximo) * (A - p * 2);

  const svg = el('svg', {
    viewBox: `0 0 ${L} ${A}`, width: '100%', height: '100%',
    'aria-hidden': 'true', preserveAspectRatio: 'none',
  });
  const d = dados.map((pt, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(pt.valor)}`).join(' ');
  svg.appendChild(el('path', {
    d, fill: 'none', stroke: cor, 'stroke-width': 1.75,
    'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: '.85',
  }));
  svg.appendChild(el('circle', {
    cx: x(dados.length - 1), cy: y(dados[dados.length - 1].valor), r: 2.5, fill: cor,
  }));
  container.appendChild(svg);
}

export { formatar };
