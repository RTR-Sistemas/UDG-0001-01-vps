/**
 * =============================================================================
 * E2E Teste — Sistema de Batalhas ao Vivo (2 usuários no navegador)
 * =============================================================================
 * Roda com puppeteer-core + Chrome local.
 * Contas: batalha1@udgtest.com e batalha2@udgtest.com (senha UDG@Teste2026)
 * =============================================================================
 */

const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:8081";
const EMAIL_A = "batalha1@udgtest.com";
const EMAIL_B = "batalha2@udgtest.com";
const PASS = "UDG@Teste2026";
const OUT_DIR = path.join(__dirname, "..", "testes", "battle-e2e-screenshots");

const envRaw = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const SUPABASE_URL = (envRaw.match(/^VITE_SUPABASE_URL=(.+)/m) ?? [])[1]?.trim();
const ANON_KEY = (envRaw.match(/^VITE_SUPABASE_ANON_KEY=(.+)/m) ?? [])[1]?.trim();

let failures = 0;
let steps = [];

/** Libera o lock de sessão única do app (active_session_id) para a conta: */
async function resetDeviceLock(email) {
  const tok = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASS }),
  }).then((r) => r.json());
  if (!tok?.user?.id) {
    failures++;
    log(`✖ Não conseguiu token de ${email} para resetDeviceLock`);
    return;
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${tok.user.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${tok.access_token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ active_session_id: null }),
    }
  );
  if (!res.ok) {
    failures++;
    log(`✖ resetDeviceLock falhou para ${email}: HTTP ${res.status}`);
  }
}

/** Encerra/cancela batalhas ativas dos usuários de teste (evita already_in_battle) */
async function cleanupTestBattles() {
  const A = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL_A, password: PASS }),
  }).then((r) => r.json());
  if (!A?.access_token) {
    log("  (cleanup: sem token do host, pulando)");
    return;
  }
  const list = await fetch(
    `${SUPABASE_URL}/rest/v1/battles?status=in.(scheduled,live)&select=id,status`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${A.access_token}` } }
  ).then((r) => r.json());
  for (const bt of list ?? []) {
    const rpcName = bt.status === "scheduled" ? "cancel_battle" : "end_battle";
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${A.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_battle_id: bt.id }),
      });
      log(`  (cleanup: ${rpcName} ${bt.id})`);
    } catch (e) {
      log(`  (cleanup: falha ${rpcName} ${bt.id}: ${e.message})`);
    }
  }
}

function log(msg) {
  const t = new Date().toISOString().substring(11, 19);
  console.log(`[${t}] ${msg}`);
}

function step(name) {
  steps.push(name);
  log(`✔ STEP: ${name}`);
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  } catch (e) {
    log(`  (screenshot falhou: ${e.message})`);
  }
}

async function waitFor(page, selector, timeout = 20000, label = selector) {
  try {
    await page.waitForSelector(selector, { timeout, visible: true });
  } catch (e) {
    failures++;
    log(`✖ ERRO: não achou "${label}" em ${timeout}ms`);
    throw e;
  }
}

async function clickByText(page, text, timeout = 8000) {
  const ok = await page.evaluate((t) => {
    const buttons = Array.from(document.querySelectorAll("button, a, [role=button]"));
    const el = buttons.find(
      (b) => b.textContent && b.textContent.trim().toLowerCase().includes(t.toLowerCase())
    );
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, text);
  if (!ok) {
    failures++;
    log(`✖ Não encontrou botão com texto "${text}"`);
    throw new Error(`clickByText falhou: ${text}`);
  }
  await sleep(400);
  return ok;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Polling local (sem CDP) até a URL sair do prefixo */
async function waitForUrlNotStartingWith(page, prefix, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const url = page.url();
    if (!url.startsWith(prefix)) return true;
    await sleep(400);
  }
  return false;
}

/** Fecha modais de onboarding genéricos (intros, tutoriais, LGPD) */
/** Polling local (sem CDP) até a URL conter uma substring */
async function waitForUrlContaining(page, needle, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const url = page.url();
    if (url.includes(needle)) return true;
    await sleep(400);
  }
  failures++;
  log(`✖ URL não continha "${needle}" (URL atual: ${page.url()})`);
  throw new Error(`url sem ${needle}`);
}

async function dismissOverlays(page) {
  // Intro video (X)
  const intro = await page.$('button[aria-label="Pular introdução"]');
  if (intro) {
    await intro.click();
    log("  (intro pulada)");
    await sleep(500);
  }
  // LGPD "Aceitar e Continuar"
  try {
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.textContent && x.textContent.includes("Aceitar e Continuar"));
      if (b) b.click();
    });
    await sleep(600);
  } catch {}
  // modais genéricos com botões "Pular" / "Entendi" / "Fechar"
  for (const t of ["Pular", "Pular tutorial", "Entendi", "Encerrar tutorial", "Fechar"]) {
    try {
      const clicked = await page.evaluate((txt) => {
        const els = Array.from(document.querySelectorAll("button"));
        for (const b of els) {
          if (b.textContent && b.textContent.trim() === txt && b.offsetParent !== null) {
            b.click();
            return true;
          }
        }
        return false;
      }, t);
      if (clicked) {
        log(`  (modal "${t}" fechado)`);
        await sleep(400);
      }
    } catch {}
  }
}

async function login(page, email) {
  try {
    await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    failures++;
    log(`✖ Navigação para /auth falhou (${email}): ${e.message}`);
    throw e;
  }
  await waitFor(page, "#email", 20000, "form de login");
  await page.type("#email", email);
  await page.type("#password", PASS);
  await clickByText(page, "Entrar", 5000);
  log("  (credenciais enviadas)");
  // espera o app robustamente: URL sai de /auth OU aparece UI principal
  try {
    const ok = await waitForUrlNotStartingWith(page, "/auth", 25000);
    if (!ok) {
      failures++;
      log(`✖ Login falhou para ${email} — página continua em /auth`);
      try {
        const body = await page.evaluate(() => document.body?.innerText?.slice(0, 400) ?? "vazio");
        log(`  Texto: ${body.replace(/\n/g, " | ")}`);
      } catch {}
      await shot(page, `login-falhou-${email.split("@")[0]}`);
      throw new Error(`login não redirecionou: ${email}`);
    }
  } catch (e) {
    if (e.message && e.message.startsWith("login não redirecionou")) throw e;
    failures++;
    log(`✖ Erro inesperado no login (${email}): ${e.message}`);
    throw e;
  }
  await sleep(1500);
  await dismissOverlays(page);
  log(`✔ Login OK: ${email}`);
}

async function go(page, pathname) {
  try {
    await page.goto(`${BASE}${pathname}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    failures++;
    log(`✖ Navigação para ${pathname} falhou: ${e.message}`);
    throw e;
  }
  await sleep(1200);
  await dismissOverlays(page);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  log(`=== E2E Batalhas ao Vivo — inicio ===`);
  log(`Screenshots: ${OUT_DIR}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    defaultViewport: { width: 430, height: 900 },
    protocolTimeout: 120000,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const ctxA = await browser.createBrowserContext();
    const ctxB = await browser.createBrowserContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    for (const [name, p] of [["A", pageA], ["B", pageB]]) {
      p.on("dialog", async (d) => {
        log(`  [dialog ${name}] ${d.message()}`);
        await d.dismiss();
      });
      p.on("console", (msg) => {
        if (msg.type() === "error") log(`  [console ${name}] ${msg.text()}`);
      });
      p.on("pageerror", (err) => log(`  [pageerror ${name}] ${err.message}`));
      p.on("requestfailed", (req) =>
        log(`  [reqfail ${name}] ${req.url()} → ${req.failure()?.errorText ?? "?"}`)
      );
      p.on("response", (resp) => {
        if (resp.status() >= 400) {
          log(`  [resp ${name}] ${resp.status()} ${resp.url()}`);
        }
      });
    }

    // ============================ 0. LIMPEZA ===========================
    log("Reset do lock de sessão e batalhas ativas...");
    await cleanupTestBattles();
    await resetDeviceLock(EMAIL_A);
    await resetDeviceLock(EMAIL_B);

    // ============================ 1. LOGIN ============================
    step("Login usuário A (batalha1)");
    await login(pageA, EMAIL_A);

    step("Login usuário B (batalha2)");
    await login(pageB, EMAIL_B);

    // ================== 2. A CRIA CONVITE DE BATALHA ==================
    step("A abre o lobby de Batalhas");
    await go(pageA, "/battles");
    await waitFor(pageA, '[data-testid="new-battle-button"]', 20000, "lobby batalhas");
    await shot(pageA, "01-lobby-batalhas-A");

    step("A cria novo desafio (busca batalha2)");
    await clickByText(pageA, "Desafiar alguém", 5000);
    await waitFor(pageA, 'input[placeholder="Buscar usuário..."]', 10000, "input busca");
    await pageA.type('input[placeholder="Buscar usuário..."]', "batalha2");
    await sleep(1500);
    await shot(pageA, "02-busca-adversario-A");
    const foundedB = await pageA.evaluate(() => {
      const els = Array.from(document.querySelectorAll("button"));
      const b = els.find((x) => x.textContent && x.textContent.includes("@batalha2"));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    if (!foundedB) {
      failures++;
      log("✖ Não encontrou @batalha2 nos resultados da busca");
      await shot(pageA, "02b-busca-vazia-A");
      throw new Error("busca falhou");
    }

    // A cai na sala em estado CONVITE
    await waitForUrlContaining(pageA, "/battle/", 15000);
    await sleep(2500);
    step("A está na sala (estado convite)");
    await waitFor(pageA, '[data-testid="battle-timer"]', 15000, "timer (sala)");
    await shot(pageA, "03-sala-convite-A");

    // ======================== 3. B ACEITA CONVITE =====================
    step("B abre lobby e vê o convite");
    await go(pageB, "/battles");
    await waitFor(pageB, '[data-testid="my-invites"]', 20000, "convites do B");
    await shot(pageB, "04-convite-recebido-B");

    step("B aceita o convite");
    const accepted = await pageB.evaluate(() => {
      const wrap = document.querySelector('[data-testid="my-invites"]');
      if (!wrap) return false;
      const btns = Array.from(wrap.querySelectorAll("button"));
      const b = btns.find((x) => x.textContent && x.textContent.includes("Aceitar"));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    if (!accepted) {
      failures++;
      log("✖ Botão Aceitar não encontrado no convite do B");
    }
    await waitForUrlContaining(pageB, "/battle/", 15000);
    await sleep(2500);
    step("B está na sala ao vivo");
    await waitFor(pageB, '[data-testid="battle-timer"]', 15000, "timer");
    await shot(pageB, "05-sala-ao-vivo-B");

    // A deve ver a batalha virar live (realtime)
    await sleep(2500);
    await shot(pageA, "06-sala-live-A");

    // ================ 4. PRESENTES — B envia para A ====================
    step("B envia 7 Coroas para A (1050 💎 para A)");
    await pageB.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button[aria-label]"));
      const b = btns.find((x) => x.getAttribute("aria-label") === "Enviar presente Coroa");
      if (!b) return false;
      // garante quantidade 1x
      const q = Array.from(document.querySelectorAll("button[aria-label='Alterar quantidade de presentes']"))[0];
      if (q && !q.textContent.includes("1x")) q.click();
      b.click();
      return true;
    });
    await sleep(700);
    for (let i = 0; i < 6; i++) {
      await pageB.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button[aria-label]"));
        const b = btns.find((x) => x.getAttribute("aria-label") === "Enviar presente Coroa");
        if (b) b.click();
      });
      await sleep(450);
    }
    await shot(pageB, "07-presentes-B");

    step("A envia Foguetes para B (2x100 moedas)");
    for (let i = 0; i < 2; i++) {
      await pageA.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button[aria-label]"));
        const b = btns.find((x) => x.getAttribute("aria-label") === "Enviar presente Foguete");
        if (b) b.click();
      });
      await sleep(500);
    }

    // ================== 5. PLACAR AO VIVO (ambos) ======================
    await sleep(2000);
    const scoreA = await pageB.evaluate(() => ({
      host: document.querySelector('[data-testid="host-score"]')?.textContent ?? "?",
      guest: document.querySelector('[data-testid="guest-score"]')?.textContent ?? "?",
    }));
    log(`Placar visto pela página B → host: ${scoreA.host} pts (A) · guest: ${scoreA.guest} pts (B)`);
    await shot(pageA, "08-placar-A");
    await shot(pageB, "09-placar-B");

    if (scoreA.host === "0" || scoreA.guest === "0") {
      failures++;
      log("✖ Placar não atualizou em tempo real");
    } else {
      step("Placar em tempo real OK");
    }

    /** Clique via DOM com diagnóstico (evita falhas de geometria no headless) */
async function domClick(page, selector, label) {
  const res = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "nao-encontrado";
    const btn = el.closest("button, [role=button]") || el;
    if (btn.disabled) return "disabled";
    btn.click();
    return "ok";
  }, selector);
  if (res !== "ok") {
    failures++;
    log(`✖ domClick(${label}): ${res}`);
    throw new Error(`domClick falhou: ${label}`);
  }
  await sleep(500);
  return res;
}

// ============================ 6. EXTENSÃO DE TEMPO =======================
    step("B solicita extensão +60s");
    await waitFor(pageB, '[data-testid="extend-battle"]', 10000, "botão estender");
    await domClick(pageB, '[data-testid="extend-battle"]', "estender +60s");
    await sleep(2500);

    step("A aprova a extensão");
    await waitFor(pageA, '[data-testid="extension-approval"]', 20000, "pedido de extensão");
    await shot(pageA, "10-pedido-extensao-A");
    const approved = await pageA.evaluate(() => {
      const wrap = document.querySelector('[data-testid="extension-approval"]');
      if (!wrap) return false;
      const btns = Array.from(wrap.querySelectorAll("button"));
      const b = btns.find((x) => x.textContent && x.textContent.includes("Aprovar"));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    if (!approved) {
      failures++;
      log("✖ Botão Aprovar não encontrado");
    }
    await sleep(2000);
    step("Extensão aprovada");

    // ========================= 7. ENCERRAR ==============================
    step("A encerra a batalha");
    await waitFor(pageA, '[data-testid="end-battle"]', 10000, "botão encerrar");
    await domClick(pageA, '[data-testid="end-battle"]', "encerrar batalha");
    await sleep(3000);
    await shot(pageA, "11-batalha-encerrada-A");

    await sleep(3000);
    await shot(pageB, "12-batalha-encerrada-B");

    const endedA = await pageA.evaluate(
      () => document.body.textContent.includes("VITÓRIA")
        || document.body.textContent.includes("perdeu")
        || document.body.textContent.includes("Empate")
        || document.body.textContent.includes("Encerrada")
        || document.body.textContent.includes("eu venceu")
    );
    if (endedA) {
      step("Resultado da batalha exibido para A");
    } else {
      failures++;
      log("✖ Resultado não visível na página A");
    }

    // ======================== 8. CARTEIRA (A) ===========================
    step("A abre a Carteira");
    await go(pageA, "/wallet");
    await waitFor(pageA, '[data-testid="wallet-diamonds"]', 20000, "carteira diamantes");
    const walletBefore = await pageA.evaluate(() => ({
      coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent ?? "?",
      diamonds: document.querySelector('[data-testid="wallet-diamonds"]')?.textContent ?? "?",
    }));
    log(`Carteira A (antes da compra): moedas=${walletBefore.coins}, diamantes=${walletBefore.diamonds}`);
    await shot(pageA, "13-carteira-A");

    if (walletBefore.diamonds === "0" || walletBefore.diamonds === "?") {
      failures++;
      log("✖ A deveria ter diamantes após receber presentes (esperado ~1050)");
    }

    step("A compra 100 moedas (mock gateway)");
    await domClick(pageA, '[data-testid="buy-100"]', "comprar 100 moedas");
    await sleep(3000);
    const walletAfter = await pageA.evaluate(() => ({
      coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent ?? "?",
    }));
    log(`Carteira A (depois): moedas=${walletAfter.coins}`);
    if (walletAfter.coins === walletBefore.coins) {
      failures++;
      log("✖ Compra de moedas não refletiu no saldo");
    } else {
      step("Compra de moedas OK");
    }

    step("A solicita saque de 1000 diamantes");
    await domClick(pageA, '[data-testid="open-withdrawal"]', "abrir saque");
    await waitFor(pageA, '[data-testid="withdraw-amount"]', 10000, "campo saque");
    await pageA.type('[data-testid="withdraw-amount"]', "1000");
    await domClick(pageA, '[data-testid="confirm-withdrawal"]', "confirmar saque");
    await sleep(3000);
    await shot(pageA, "14-saque-solicitado-A");
    const withdrawalOk = await pageA.evaluate(
      () => document.body.textContent.includes("Saque solicitado") || document.body.textContent.includes("pending")
    );
    if (withdrawalOk) {
      step("Saque solicitado com sucesso");
    } else {
      failures++;
      log("✖ Saque não confirmado na UI");
    }

    // ==================== 9. VALIDAÇÃO NO BANCO =========================
    step("Resumo Execução");
    log(`  Placar final page B: host=${scoreA.host} guest=${scoreA.guest}`);
    log(`  Carteira A antes: ${JSON.stringify(walletBefore)}`);
    log(`  Carteira A depois: ${JSON.stringify(walletAfter)}`);

    // ============================ FIM ===================================
    log(`\n=== RESULTADO: ${failures === 0 ? "✅ SUCESSO — todos os passos passaram" : `❌ ${failures} falha(s) detectada(s)`} ===`);
    log(`Screenshots em: ${OUT_DIR}`);
  } finally {
    await browser.close();
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E abortado:", e.message);
  process.exit(1);
});