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
  log(`lock resetado (user ${tokA.user.id.slice(0, 8)})`);

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
    const t = m.text();
    if (/wallet-diag/.test(t)) log(`[console] ${t.slice(0, 300)}`);
    else if (m.type() === "error") log(`[console:error] ${t.slice(0, 200)}`);
  });
  page.on("pageerror", (e) => log(`[pageerror] ${String(e).slice(0, 300)}`));
  page.on("request", (req) => {
    if (req.url().includes("rest/v1/rpc/")) log(`[REQ-RPC] ${req.url().split("rpc/")[1]}`);
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

  const estado = await page.evaluate(async () => {
    const botoes = Array.from(document.querySelectorAll('[data-testid^="buy-"]')).map((b) => ({
      testid: b.getAttribute("data-testid"),
      disabled: b.disabled,
      ariaDisabled: (b.getAttribute("aria-disabled") ?? "") === "true",
    }));
    const storageKeys = Object.keys(localStorage).filter((k) => /sb-|supabase/i.test(k));
    let tokenInfo = null;
    for (const k of storageKeys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        let parsed = raw;
        if (raw.startsWith("base64url-json-")) parsed = atob(raw.slice(14));
        const obj = JSON.parse(parsed);
        tokenInfo = {
          key: k.slice(0, 40),
          hasToken: !!(obj?.access_token),
          exp: obj?.expires_at ? new Date(obj.expires_at * 1000).toISOString() : null,
          refresh: !!(obj?.refresh_token),
        };
        break;
      } catch {}
    }
    const demo = document.body.innerText.includes("Modo demonstração") || document.body.innerText.includes("modo demo");
    const textoPagina = document.body.innerText.slice(0, 120);
    return { botoes, storageKeys, tokenInfo, demo, textoPagina };
  });
  log(`ESTADO: ${JSON.stringify(estado, null, 1)}`);
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});