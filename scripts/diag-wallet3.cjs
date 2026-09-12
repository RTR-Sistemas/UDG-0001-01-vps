const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:8081";
const EMAIL = "batalha1@udgtest.com";
const PASS = "UDG@Teste2026";

const envRaw = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const SUPABASE_URL = (envRaw.match(/^VITE_SUPABASE_URL=(.+)/m) ?? [])[1]?.trim();
const ANON_KEY = (envRaw.match(/^VITE_SUPABASE_ANON_KEY=(.+)/m) ?? [])[1]?.trim();

const t0 = Date.now();
const log = (m) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

(async () => {
  const tokA = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${tokA.user.id}`, {
    method: "PATCH",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${tokA.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ active_session_id: null }),
  });
  log("lock resetado");

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    defaultViewport: { width: 430, height: 900 },
    protocolTimeout: 90000,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  page.on("dialog", async (d) => {
    log(`[dialog] ${d.message()}`);
    await d.dismiss();
  });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warn") log(`[console:${m.type()}] ${m.text().slice(0, 200)}`);
  });
  page.on("request", (req) => {
    if (req.url().includes("netlify/functions/purchase-coins")) log(`[REQ] ${req.method()} purchase-coins`);
  });

  await page.goto(`${BASE}/auth`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#email", { timeout: 30000, visible: true });
  await page.type("#email", EMAIL);
  await page.type("#password", PASS);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("button"));
    const b = els.find((x) => x.textContent && x.textContent.trim().includes("Entrar"));
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 9000));
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Pular introdução"]');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  await page.goto(`${BASE}/wallet`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));

  const info = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="buy-100"]');
    if (!btn) return "sem botao";
    let rootName = null;
    let cur = btn;
    while (cur) {
      if (cur.id === "root") {
        rootName = "root(id)";
        break;
      }
      if (cur.classList && cur.classList.contains("slide-in")) {
        rootName = "slide-in";
        break;
      }
      cur = cur.parentElement;
    }
    const rect = btn.getBoundingClientRect();
    const over = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      rootDesc: rootName,
      ancestors: (function () {
        const arr = [];
        let c = btn;
        for (let i = 0; i < 8 && c; i++) {
          arr.push({
            tag: c.tagName,
            id: c.id,
            cls: (c.className && c.className.toString().slice(0, 60)) || "",
            pe: getComputedStyle(c).pointerEvents,
          });
          c = c.parentElement;
        }
        return arr;
      })(),
      elementoNoPonto: over ? `${over.tagName}#${over.id}.${(over.className?.toString() || "").slice(0, 60)}` : "?",
      btnPe: getComputedStyle(btn).pointerEvents,
    };
  });
  log(JSON.stringify(info, null, 1));

  // clique físico real do Puppeteer nas coordenadas
  const rect = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="buy-100"]').getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const stack = document.elementsFromPoint(cx, cy).map((el) => ({
      tag: el.tagName,
      id: el.id,
      cls: (el.className && el.className.toString().slice(0, 70)) || "",
      pe: getComputedStyle(el).pointerEvents,
      fixed: getComputedStyle(el).position === "fixed",
      z: getComputedStyle(el).zIndex,
      txt: (el.textContent || "").slice(0, 40),
    }));
    return { x: r.x, y: r.y, w: r.width, h: r.height, stack };
  });
  log(`pilha no ponto do buy-100: ${JSON.stringify(rect.stack, null, 1)}`);
  await page.mouse.click(rect.x + rect.w / 2, rect.y + rect.h / 2);
  await new Promise((r) => setTimeout(r, 4000));
  const after = await page.evaluate(() => ({
    coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent,
    toasts: Array.from(document.querySelectorAll("[data-sonner-toast], [role=status]"))
      .map((n) => n.textContent)
      .slice(0, 4),
  }));
  log(`DEPOIS buy físico: ${JSON.stringify(after)}`);

  // agora open-withdrawal físico
  const r2 = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="open-withdrawal"]');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  log(`clique físico open-withdrawal em (${r2.x + r2.w / 2}, ${r2.y + r2.h / 2})`);
  await page.mouse.click(r2.x + r2.w / 2, r2.y + r2.h / 2);
  await new Promise((r) => setTimeout(r, 3000));
  const formAberto = await page.evaluate(() => ({
    campo: !!document.querySelector('[data-testid="withdraw-amount"]'),
  }));
  log(`form saque aberto? ${JSON.stringify(formAberto)}`);
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});