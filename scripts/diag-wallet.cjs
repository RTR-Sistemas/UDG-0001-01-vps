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
  // reset lock
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
  page.on("console", (m) => log(`[console:${m.type()}] ${m.text().slice(0, 300)}`));
  page.on("pageerror", (e) => log(`[pageerror] ${e.message.slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) log(`[resp ${r.status()}] ${r.url()}`);
  });
  page.on("request", (req) => {
    if (req.url().includes("netlify/functions/purchase-coins") || req.url().includes("rpc/create_coin")) {
      log(`[REQ INICIO] ${req.method()} ${req.url()}`);
    }
  });
  page.on("requestfinished", (req) => {
    if (req.url().includes("netlify/functions/purchase-coins") || req.url().includes("rpc/create_coin")) {
      log(`[REQ FIM] ${req.url()} -> ${req.response()?.status()}`);
    }
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
  await new Promise((r) => setTimeout(r, 8000));
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Pular introdução"]');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  await page.goto(`${BASE}/wallet`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));
  const before = await page.evaluate(() => ({
    coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent,
    diamonds: document.querySelector('[data-testid="wallet-diamonds"]')?.textContent,
  }));
  log(`ANTES: ${JSON.stringify(before)}`);

  log("ANTES do clique, teste direto do fetch:");
  const ff = await page.evaluate(async () => {
    const t0 = performance.now();
    try {
      const r = await fetch("/.netlify/functions/purchase-coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCoins: 100 }),
      });
      const txt = await r.text();
      return { status: r.status, ms: Math.round(performance.now() - t0), body: txt.slice(0, 80) };
    } catch (e) {
      return { erro: e.message, ms: Math.round(performance.now() - t0) };
    }
  });
  log(`fetch direto: ${JSON.stringify(ff)}`);

  log("clicando buy-100");
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('[data-testid="buy-100"]'));
    all.forEach((b) => {
      b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window }));
    });
  });
  await new Promise((r) => setTimeout(r, 6000));
  const info = await page.evaluate(() => ({
    disabled: document.querySelector('[data-testid="buy-100"]')?.disabled ?? "?",
    coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent,
  }));
  log(`pós-clique: ${JSON.stringify(info)}`);
  const after = await page.evaluate(() => ({
    coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent,
    toasts: Array.from(document.querySelectorAll("[data-sonner-toast], [role=status]"))
      .map((n) => n.textContent)
      .slice(0, 3),
  }));
  log(`DEPOIS: ${JSON.stringify(after)}`);
  await page.screenshot({ path: "C:\\Users\\PODERO~1\\AppData\\Local\\Temp\\opencode\\wallet-diag.png" });

  // verifica no banco via REST
  const url = "";
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});