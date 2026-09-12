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
  page.on("pageerror", (e) => log(`[pageerror] ${String(e).slice(0, 300)}`));
  page.on("request", (req) => {
    if (req.url().includes("netlify/functions/purchase-coins")) log(`[REQ] POST purchase-coins`);
    if (req.url().includes("rest/v1/rpc/")) log(`[REQ-RPC] ${req.url().split("rpc/")[1]}`);
  });
  page.on("response", async (res) => {
    if (res.url().includes("purchase-coins")) log(`[RESP purchase-coins] ${res.status()}`);
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

  const lgpd = await page.evaluate(() => {
    const modal = document.querySelector("div.fixed.inset-0.z-\\[9999\\]");
    return {
      modalExiste: !!modal,
      textoModal: modal ? modal.textContent?.slice(0, 100) : null,
      btnAceitar: !!Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Aceitar e Continuar")),
    };
  });
  log(`LGPD modal: ${JSON.stringify(lgpd)}`);

  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Pular introdução"]');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  await page.goto(`${BASE}/wallet`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 4000));

  const estado2 = await page.evaluate(() => ({
    modalExiste: !!document.querySelector("div.fixed.inset-0.z-\\[9999\\]"),
    btnBuy: !!document.querySelector('[data-testid="buy-100"]'),
    coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent,
  }));
  log(`wallet: ${JSON.stringify(estado2)}`);

  if (estado2.modalExiste) {
    log("MODAL LGPD ABERTO NA WALLET — tentando aceitar via DOM");
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll("input[type=checkbox]"));
      checkboxes.forEach((c) => {
        if (!c.checked) {
          const label = c.closest("label");
          if (label) label.click();
          else c.click();
        }
      });
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.includes("Aceitar e Continuar"));
      if (b && !b.disabled) b.click();
    });
    await new Promise((r) => setTimeout(r, 4000));
    const apos = await page.evaluate(() => ({ modalExiste: !!document.querySelector("div.fixed.inset-0.z-\\[9999\\]") }));
    log(`após aceitar: ${JSON.stringify(apos)}`);
  }

  const estado3 = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="buy-100"]');
    const r = btn.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((el) => ({
      tag: el.tagName,
      id: el.id,
      cls: (el.className && el.className.toString().slice(0, 60)) || "",
      pe: getComputedStyle(el).pointerEvents,
      txt: (el.textContent || "").slice(0, 30),
    }));
    const rootCount = document.querySelectorAll("#root").length;
    const btnCount = document.querySelectorAll('[data-testid="buy-100"]').length;
    return {
      modalExiste: !!document.querySelector("div.fixed.inset-0.z-\\[9999\\]"),
      disabled: btn.disabled,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      stack,
      rootCount,
      btnCount,
    };
  });
  log(`antes do clique físico: ${JSON.stringify(estado3, null, 1)}`);

  const modalInfo = await page.evaluate(() => {
    const div = document.querySelector("div.fixed.inset-0.z-\\[100\\]") || document.querySelector("div.absolute.inset-0.bg-black\\/60");
    if (!div) return { existe: false };
    const sheet = div.closest("div") && div.parentElement;
    const txt = (sheet?.textContent || div.textContent || "").trim().slice(0, 200);
    const btns = Array.from(sheet?.querySelectorAll("button") || []).map((b) => b.textContent?.trim().slice(0, 40));
    return { existe: true, txt, btns };
  });
  log(`modal z-100: ${JSON.stringify(modalInfo)}`);
  if (modalInfo.existe) {
    await page.evaluate(() => {
      const sheet = Array.from(document.querySelectorAll("div")).find(
        (d) => getComputedStyle(d).position === "fixed" && getComputedStyle(d).zIndex === "100"
      );
      if (!sheet) return;
      const bts = Array.from(sheet.querySelectorAll("button"));
      const fechar = bts.find((b) => /fechar|close|×|x|depois|agora não|not now/i.test(b.textContent || ""));
      if (fechar) fechar.click();
      else if (bts[0]) bts[0].click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    log(`modal após tentativa de fechar: ${await page.evaluate(() => !!document.querySelector("div.fixed.inset-0.z-\\[100\\]"))}`);
  }
  if (!estado3.modalExiste && estado3.rect) {
    const x = estado3.rect.x + estado3.rect.w / 2;
    const y = estado3.rect.y + estado3.rect.h / 2;
    log(`clique físico em (${x}, ${y})`);
    await page.mouse.click(x, y);
    await new Promise((r) => setTimeout(r, 6000));
    const depois = await page.evaluate(() => ({
      coins: document.querySelector('[data-testid="wallet-coins"]')?.textContent,
      toasts: Array.from(document.querySelectorAll("[data-sonner-toast], [role=status]")).map((n) => n.textContent),
    }));
    log(`DEPOIS clique: ${JSON.stringify(depois)}`);
  }
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});