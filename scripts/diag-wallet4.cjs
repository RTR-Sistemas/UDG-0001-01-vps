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
    const t = m.text();
    if (/wallet-diag/.test(t)) log(`[console] ${t.slice(0, 300)}`);
    else if (m.type() === "error") log(`[console:error] ${t.slice(0, 200)}`);
  });
  page.on("request", (req) => {
    if (req.url().includes("netlify/functions/purchase-coins")) log(`[REQ] POST purchase-coins`);
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

  const probe = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="buy-100"]');
    const keys = Object.keys(btn).filter((k) => k.startsWith("__react"));
    const propsKey = keys.find((k) => k.includes("Props") || k.includes("Handlers"));
    const fakeEvent = { type: "click", target: btn, currentTarget: btn, bubbles: true };
    let chamada = false;
    try {
      if (propsKey && btn[propsKey] && typeof btn[propsKey].onClick === "function") {
        btn[propsKey].onClick(fakeEvent);
        chamada = true;
      }
    } catch (e) {
      return { keys, propsKey, onClickType: btn[propsKey] ? typeof btn[propsKey].onClick : "n/a", erro: e.message };
    }
    return { keys, propsKey, onClickType: btn[propsKey] ? typeof btn[propsKey].onClick : "n/a", chamada };
  });
  log(`probe React onClick: ${JSON.stringify(probe)}`);
  await new Promise((r) => setTimeout(r, 6000));
  const after = await page.evaluate(() => ({
    coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent,
    toasts: Array.from(document.querySelectorAll("[data-sonner-toast], [role=status]"))
      .map((n) => n.textContent)
      .slice(0, 4),
  }));
  log(`DEPOIS: ${JSON.stringify(after)}`);
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});